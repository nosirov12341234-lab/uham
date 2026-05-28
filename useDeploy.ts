/**
 * hooks/useDeploy.ts
 *
 * Handles the full flow of deploying a new NFT Collection:
 *  1. Upload image + metadata to IPFS via NFT.Storage
 *  2. Build StateInit for the collection contract
 *  3. Send deploy transaction via TonConnect
 *  4. Return the derived collection address
 */

import { useState, useCallback } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { buildCollectionStateInit, toNanoSafe } from '../ton/payloadBuilder';
import { uploadCollectionToIPFS, ipfsUrl } from '../lib/ipfs';

export type DeployStatus =
  | 'idle'
  | 'uploading'   // uploading to IPFS
  | 'awaiting'    // waiting for wallet confirmation
  | 'submitted'   // tx sent to network
  | 'success'
  | 'error';

export interface DeployState {
  status: DeployStatus;
  error: string | null;
  collectionAddress: string | null;
  ipfsCid: string | null;
}

export interface DeployParams {
  name: string;
  description: string;
  image: File;
  nftName: string;
  nftDescription: string;
  mintPriceTon: string;
  royaltyPercent: number;
  maxSupply: number;
}

const INITIAL: DeployState = {
  status: 'idle',
  error: null,
  collectionAddress: null,
  ipfsCid: null,
};

// Deploy cost: enough TON to cover storage + gas for collection contract
const DEPLOY_AMOUNT_TON = '0.05';

export function useDeploy() {
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const [state, setState] = useState<DeployState>(INITIAL);

  const reset = useCallback(() => setState(INITIAL), []);

  const deploy = useCallback(
    async (params: DeployParams) => {
      if (!userAddress) {
        setState({ ...INITIAL, status: 'error', error: 'Connect your wallet first.' });
        return;
      }

      try {
        // ── Step 1: Upload to IPFS ──────────────────────────────────────────
        setState({ ...INITIAL, status: 'uploading' });

        const { collectionImageUrl, metadataCid } = await uploadCollectionToIPFS({
          collectionImage: params.image,
          collectionName: params.name,
          collectionDescription: params.description,
          nftName: params.nftName,
          nftDescription: params.nftDescription,
          totalSupply: params.maxSupply,
        });

        const collectionContentUrl = ipfsUrl(metadataCid, '/collection.json');
        const nftItemContentBaseUrl = ipfsUrl(metadataCid, '/');

        // ── Step 2: Build StateInit ─────────────────────────────────────────
        const { stateInit, collectionAddress } = buildCollectionStateInit({
          ownerAddress: userAddress,
          collectionContentUrl,
          nftItemContentBaseUrl,
          royaltyPercent: params.royaltyPercent,
          royaltyAddress: userAddress, // royalties go to collection owner
          mintPriceTon: params.mintPriceTon,
        });

        // StateInit as base64 BOC for TonConnect
        const stateInitBoc = stateInit.toBoc().toString('base64');

        // ── Step 3: Send deploy transaction ────────────────────────────────
        setState(prev => ({ ...prev, status: 'awaiting', collectionAddress, ipfsCid: metadataCid }));

        await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 300,
          messages: [
            {
              address: collectionAddress,
              amount: toNanoSafe(DEPLOY_AMOUNT_TON).toString(),
              stateInit: stateInitBoc,
              // Empty payload = deploy message
            },
          ],
        });

        setState(prev => ({ ...prev, status: 'success' }));
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message.includes('Reject') || err.message.includes('cancel')
              ? 'Transaction cancelled.'
              : err.message
            : 'Unexpected error. Try again.';
        setState(prev => ({ ...prev, status: 'error', error: msg }));
      }
    },
    [tonConnectUI, userAddress]
  );

  return { state, deploy, reset };
}
