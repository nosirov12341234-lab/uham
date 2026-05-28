/**
 * hooks/useMint.ts
 *
 * Handles minting an NFT from a deployed collection:
 *  1. Fetch next_item_index from collection contract on-chain
 *  2. Build multi-message transaction:
 *       Msg A → Admin wallet (platform fee = X% of mint price)
 *       Msg B → Collection contract (mint payload + remaining amount)
 *  3. Submit via TonConnect
 */

import { useState, useCallback } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { TonClient, Address } from '@ton/ton';
import { buildMintPayload, toNanoSafe } from '../ton/payloadBuilder';
import { ipfsUrl } from '../lib/ipfs';

const ADMIN_WALLET = import.meta.env.VITE_ADMIN_WALLET as string;
const PLATFORM_FEE_PERCENT = parseFloat(import.meta.env.VITE_PLATFORM_FEE_PERCENT ?? '5');
const NETWORK = (import.meta.env.VITE_TON_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

function createClient(): TonClient {
  return new TonClient({
    endpoint:
      NETWORK === 'mainnet'
        ? 'https://toncenter.com/api/v2/jsonRPC'
        : 'https://testnet.toncenter.com/api/v2/jsonRPC',
  });
}

export type MintStatus =
  | 'idle'
  | 'preparing'
  | 'awaiting'
  | 'success'
  | 'error';

export interface MintState {
  status: MintStatus;
  error: string | null;
  itemIndex: number | null;
  txBoc: string | null;
}

const INITIAL: MintState = {
  status: 'idle',
  error: null,
  itemIndex: null,
  txBoc: null,
};

export function useMint(collectionAddress: string, mintPriceTon: string, metadataCid: string) {
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const [state, setState] = useState<MintState>(INITIAL);

  const reset = useCallback(() => setState(INITIAL), []);

  /**
   * Computes platform fee and creator amount from mint price.
   * Returns both as nanoTON strings.
   */
  function computeAmounts(priceTon: string): { adminNano: string; creatorNano: string } {
    const priceNano = toNanoSafe(priceTon);
    const adminNano = (priceNano * BigInt(Math.round(PLATFORM_FEE_PERCENT * 10))) / BigInt(1000);
    const creatorNano = priceNano - adminNano;
    return { adminNano: adminNano.toString(), creatorNano: creatorNano.toString() };
  }

  const mint = useCallback(async () => {
    if (!userAddress) {
      setState({ ...INITIAL, status: 'error', error: 'Connect your wallet first.' });
      return;
    }
    if (!collectionAddress) {
      setState({ ...INITIAL, status: 'error', error: 'Invalid collection address.' });
      return;
    }

    try {
      // ── Step 1: Get next item index from chain ───────────────────────────
      setState({ ...INITIAL, status: 'preparing' });

      const client = createClient();
      const addr = Address.parse(collectionAddress);
      const result = await client.runMethod(addr, 'get_collection_data');
      const nextIndex = result.stack.readNumber();

      if (nextIndex < 0) throw new Error('Collection is sold out or not initialized.');

      // ── Step 2: Build mint payload ───────────────────────────────────────
      const metadataUrl = ipfsUrl(metadataCid, `/${nextIndex}.json`);
      const payloadBoc = buildMintPayload({
        itemIndex: nextIndex,
        metadataUrl,
        itemOwnerAddress: userAddress,
      });

      // ── Step 3: Compute fee split ────────────────────────────────────────
      const { adminNano, creatorNano } = computeAmounts(mintPriceTon);

      // ── Step 4: Send multi-message transaction ───────────────────────────
      setState(prev => ({ ...prev, status: 'awaiting', itemIndex: nextIndex }));

      const response = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          // Message 1 → Platform admin (fee)
          {
            address: ADMIN_WALLET,
            amount: adminNano,
          },
          // Message 2 → Collection contract (mint)
          {
            address: collectionAddress,
            amount: creatorNano,
            payload: payloadBoc,
          },
        ],
      });

      setState(prev => ({ ...prev, status: 'success', txBoc: response.boc }));
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message.includes('Reject') || err.message.includes('cancel')
            ? 'Transaction cancelled.'
            : err.message
          : 'Unexpected error. Try again.';
      setState(prev => ({ ...prev, status: 'error', error: msg }));
    }
  }, [tonConnectUI, userAddress, collectionAddress, mintPriceTon, metadataCid]);

  return { state, mint, reset, platformFeePercent: PLATFORM_FEE_PERCENT };
}
