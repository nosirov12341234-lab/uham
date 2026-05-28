/**
 * hooks/useCollection.ts
 *
 * Fetches live collection data from the TON blockchain:
 *  - next_item_index (how many minted so far)
 *  - Collection metadata from IPFS (name, description, image)
 *
 * Also stores user-created collections in localStorage so they
 * appear on the home page without a backend.
 */

import { useState, useEffect, useCallback } from 'react';
import { TonClient, Address } from '@ton/ton';

const NETWORK = (import.meta.env.VITE_TON_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const STORAGE_KEY = 'ton_nft_platform_collections';

export interface CollectionMeta {
  address: string;
  name: string;
  description: string;
  image: string;
  mintPriceTon: string;
  maxSupply: number;
  minted: number;
  royaltyPercent: number;
  metadataCid: string;
  owner: string;
  createdAt: number;
}

function createClient(): TonClient {
  return new TonClient({
    endpoint:
      NETWORK === 'mainnet'
        ? 'https://toncenter.com/api/v2/jsonRPC'
        : 'https://testnet.toncenter.com/api/v2/jsonRPC',
  });
}

// ─── Local storage helpers ────────────────────────────────────────────────────

export function saveCollection(col: CollectionMeta) {
  const existing = loadCollections();
  const updated = [col, ...existing.filter(c => c.address !== col.address)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function loadCollections(): CollectionMeta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CollectionMeta[]) : [];
  } catch {
    return [];
  }
}

export function loadCollection(address: string): CollectionMeta | null {
  return loadCollections().find(c => c.address === address) ?? null;
}

// ─── Hook: all collections ────────────────────────────────────────────────────

export function useCollections() {
  const [collections, setCollections] = useState<CollectionMeta[]>([]);

  const refresh = useCallback(() => {
    setCollections(loadCollections());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { collections, refresh };
}

// ─── Hook: single collection with live on-chain minted count ─────────────────

export function useCollection(address: string | undefined) {
  const [meta, setMeta] = useState<CollectionMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);

    try {
      // Load cached meta from localStorage
      const cached = loadCollection(address);
      if (cached) setMeta(cached);

      // Fetch live next_item_index from chain
      const client = createClient();
      const addr = Address.parse(address);
      const result = await client.runMethod(addr, 'get_collection_data');
      const nextIndex = result.stack.readNumber();

      if (cached) {
        const updated = { ...cached, minted: Math.max(nextIndex, 0) };
        setMeta(updated);
        saveCollection(updated);
      }
    } catch (err) {
      // Contract might not be confirmed yet — use cached data
      if (!meta) setError('Could not load collection data.');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { meta, loading, error, refetch: fetch };
}
