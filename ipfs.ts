/**
 * lib/ipfs.ts
 * Uploads images and metadata JSON to IPFS via NFT.Storage (free).
 * Returns ipfs:// URIs which are universally supported by NFT marketplaces.
 */

const NFT_STORAGE_KEY = import.meta.env.VITE_NFT_STORAGE_KEY as string;
const NFT_STORAGE_API = 'https://api.nft.storage';

if (!NFT_STORAGE_KEY) {
  console.error('[IPFS] VITE_NFT_STORAGE_KEY is not set in .env');
}

/**
 * Uploads a single File/Blob to NFT.Storage and returns the IPFS CID URL.
 */
export async function uploadFileToIPFS(file: File | Blob, filename = 'file'): Promise<string> {
  const formData = new FormData();
  formData.append('file', file, filename);

  const res = await fetch(`${NFT_STORAGE_API}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${NFT_STORAGE_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NFT.Storage upload failed: ${err}`);
  }

  const data = (await res.json()) as { value: { cid: string } };
  return `https://ipfs.io/ipfs/${data.value.cid}`;
}

/**
 * Uploads a directory of NFT metadata JSONs + collection image.
 * Returns { collectionImageUrl, metadataBaseUrl }
 *
 * metadataBaseUrl usage: `${metadataBaseUrl}/{index}.json`
 */
export async function uploadCollectionToIPFS(params: {
  collectionImage: File;
  collectionName: string;
  collectionDescription: string;
  nftName: string;
  nftDescription: string;
  totalSupply: number;
}): Promise<{ collectionImageUrl: string; metadataCid: string }> {
  const {
    collectionImage,
    collectionName,
    collectionDescription,
    nftName,
    nftDescription,
    totalSupply,
  } = params;

  // 1. Upload collection cover image first
  const collectionImageUrl = await uploadFileToIPFS(collectionImage, collectionImage.name);

  // 2. Build metadata JSONs for all NFT items and upload as a directory
  // We use NFT.Storage's /upload endpoint with multipart for directory
  const formData = new FormData();

  // collection.json — collection-level metadata
  const collectionMeta = JSON.stringify({
    name: collectionName,
    description: collectionDescription,
    image: collectionImageUrl,
    external_link: '',
  });
  formData.append(
    'file',
    new Blob([collectionMeta], { type: 'application/json' }),
    'collection.json'
  );

  // Individual NFT metadata files: 0.json, 1.json, ... (totalSupply-1).json
  for (let i = 0; i < totalSupply; i++) {
    const meta = JSON.stringify({
      name: `${nftName} #${i + 1}`,
      description: nftDescription,
      image: collectionImageUrl,
      attributes: [],
    });
    formData.append(
      'file',
      new Blob([meta], { type: 'application/json' }),
      `${i}.json`
    );
  }

  const res = await fetch(`${NFT_STORAGE_API}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${NFT_STORAGE_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NFT.Storage metadata upload failed: ${err}`);
  }

  const data = (await res.json()) as { value: { cid: string } };
  return {
    collectionImageUrl,
    metadataCid: data.value.cid,
  };
}

/**
 * Builds a gateway URL from an IPFS CID and optional path.
 */
export function ipfsUrl(cid: string, path = ''): string {
  return `https://ipfs.io/ipfs/${cid}${path}`;
}
