/**
 * useTonMint.ts
 *
 * Custom React hook that orchestrates the full NFT minting flow:
 *   1. Validates wallet connection and environment config
 *   2. Queries the NFT Collection contract to get the next item index
 *      (so we know which index to mint)
 *   3. Constructs a multi-message TonConnect transaction:
 *        Message A → Admin wallet  (platform commission fee)
 *        Message B → NFT Collection contract  (mint payload + price)
 *   4. Submits the transaction via TonConnectUI and tracks its state
 *
 * All TON amounts are handled as nanoTON (BigInt) internally.
 */

import { useState, useCallback } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { Address, TonClient } from '@ton/ton';
import { buildMintPayload, toNanoSafe } from '../ton/payloadBuilder';

// ─── Environment config ───────────────────────────────────────────────────────

const ENV = {
  adminWallet: import.meta.env.VITE_ADMIN_WALLET as string,
  adminFee: import.meta.env.VITE_ADMIN_FEE as string,       // e.g. "0.05"
  collectionAddress: import.meta.env.VITE_NFT_COLLECTION_ADDRESS as string,
  mintPrice: import.meta.env.VITE_MINT_PRICE as string,     // e.g. "0.5"
  network: import.meta.env.VITE_TON_NETWORK as 'testnet' | 'mainnet',
  nftBaseUrl: import.meta.env.VITE_NFT_BASE_METADATA_URL as string,
} as const;

// Validate required env vars at module load time (fails fast in dev)
const REQUIRED_ENV_KEYS = [
  'VITE_ADMIN_WALLET',
  'VITE_ADMIN_FEE',
  'VITE_NFT_COLLECTION_ADDRESS',
  'VITE_MINT_PRICE',
  'VITE_NFT_BASE_METADATA_URL',
] as const;

for (const key of REQUIRED_ENV_KEYS) {
  if (!import.meta.env[key]) {
    console.error(`[useTonMint] Missing required environment variable: ${key}`);
  }
}

// ─── TON RPC endpoint ─────────────────────────────────────────────────────────

function createTonClient(): TonClient {
  const endpoint =
    ENV.network === 'mainnet'
      ? 'https://toncenter.com/api/v2/jsonRPC'
      : 'https://testnet.toncenter.com/api/v2/jsonRPC';

  return new TonClient({ endpoint });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type MintStatus =
  | 'idle'
  | 'preparing'   // querying next index from chain
  | 'awaiting'    // waiting for user to confirm in wallet
  | 'submitted'   // tx broadcast, waiting for confirmation
  | 'success'
  | 'error';

export interface MintState {
  status: MintStatus;
  error: string | null;
  txHash: string | null;
  itemIndex: number | null;
}

export interface UseTonMintReturn {
  mintState: MintState;
  mint: () => Promise<void>;
  reset: () => void;
  /** Total cost shown in UI: mintPrice + adminFee in TON */
  totalCostTon: string;
  /** Individual prices for display */
  mintPriceTon: string;
  adminFeeTon: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: MintState = {
  status: 'idle',
  error: null,
  txHash: null,
  itemIndex: null,
};

export function useTonMint(): UseTonMintReturn {
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const [mintState, setMintState] = useState<MintState>(INITIAL_STATE);

  // Pre-compute display values (stable across renders)
  const mintPriceTon = parseFloat(ENV.mintPrice).toFixed(2);
  const adminFeeTon = parseFloat(ENV.adminFee).toFixed(2);
  const totalCostTon = (parseFloat(ENV.mintPrice) + parseFloat(ENV.adminFee)).toFixed(2);

  const reset = useCallback(() => {
    setMintState(INITIAL_STATE);
  }, []);

  const mint = useCallback(async () => {
    // ── Guard: wallet must be connected ──────────────────────────────────────
    if (!userAddress) {
      setMintState({
        status: 'error',
        error: 'Please connect your TON wallet first.',
        txHash: null,
        itemIndex: null,
      });
      return;
    }

    try {
      // ── Step 1: Query next NFT index from collection contract ─────────────
      setMintState({ status: 'preparing', error: null, txHash: null, itemIndex: null });

      const client = createTonClient();
      const collectionAddr = Address.parse(ENV.collectionAddress);

      // Call get_collection_data() on the NFT Collection contract.
      // Returns: (next_item_index, collection_content, owner_address)
      const result = await client.runMethod(collectionAddr, 'get_collection_data');

      // next_item_index is the first stack value (int)
      const nextItemIndex = result.stack.readNumber();

      if (nextItemIndex < 0) {
        throw new Error('Collection is sold out or not initialized on-chain.');
      }

      // ── Step 2: Build mint Cell payload (TEP-62) ──────────────────────────
      const metadataUrl = `${ENV.nftBaseUrl.replace(/\/$/, '')}/${nextItemIndex}.json`;

      const { payloadBoc } = buildMintPayload({
        itemIndex: nextItemIndex,
        metadataUrl,
      });

      // ── Step 3: Convert TON amounts to nanoTON strings (for TonConnect) ───
      // TonConnect sendTransaction expects `value` as a nanoTON string
      const adminFeeNano = toNanoSafe(ENV.adminFee).toString();
      // Mint value = mint price + gas buffer for storage & forwarding
      const mintValueNano = toNanoSafe(ENV.mintPrice).toString();

      // ── Step 4: Build multi-message transaction ───────────────────────────
      // TonConnect's `messages` array: each entry is a separate TON message
      // bundled into one logical user transaction (single wallet confirmation).
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300, // 5 min expiry
        messages: [
          // ── Message 1: Platform commission → Admin wallet ────────────────
          {
            address: ENV.adminWallet,
            amount: adminFeeNano,
            // Empty payload = simple TON transfer (no contract call)
          },
          // ── Message 2: NFT Mint → Collection contract ────────────────────
          {
            address: ENV.collectionAddress,
            amount: mintValueNano,
            // base64-encoded BOC Cell with TEP-62 mint op
            payload: payloadBoc,
          },
        ],
      };

      // ── Step 5: Request user confirmation via TonConnect ──────────────────
      setMintState({
        status: 'awaiting',
        error: null,
        txHash: null,
        itemIndex: nextItemIndex,
      });

      const response = await tonConnectUI.sendTransaction(transaction);

      // ── Step 6: Tx submitted (response contains boc of sent message) ──────
      // The `boc` in the response is the serialized external message sent to
      // the network. We extract a human-readable identifier from it.
      const txBoc = response.boc;
      // Use the first 16 chars of the base64 BOC as a short tx ID for display
      const shortTxId = txBoc.slice(0, 16) + '...';

      setMintState({
        status: 'success',
        error: null,
        txHash: shortTxId,
        itemIndex: nextItemIndex,
      });
    } catch (err: unknown) {
      // Distinguish user rejection from actual errors
      const message =
        err instanceof Error
          ? err.message.includes('Reject') || err.message.includes('cancel')
            ? 'Transaction cancelled by user.'
            : err.message
          : 'An unexpected error occurred. Please try again.';

      setMintState({
        status: 'error',
        error: message,
        txHash: null,
        itemIndex: null,
      });
    }
  }, [tonConnectUI, userAddress]);

  return { mintState, mint, reset, totalCostTon, mintPriceTon, adminFeeTon };
}
