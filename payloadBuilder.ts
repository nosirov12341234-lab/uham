/**
 * ton/payloadBuilder.ts
 *
 * Builds Cell payloads for:
 *  1. NFT Collection deployment (TEP-62)
 *  2. NFT Mint message to collection contract
 *
 * All amounts are in nanoTON (BigInt).
 */

import { beginCell, Cell, toNano, Address } from '@ton/core';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Encodes string as TEP-64 snake-cell (off-chain metadata, prefix 0x01) */
function encodeOffChainContent(url: string): Cell {
  const encoded = new TextEncoder().encode(url);
  const MAX = 126;

  const build = (offset: number): Cell => {
    const b = beginCell();
    if (offset === 0) b.storeUint(0x01, 8); // off-chain prefix
    const chunk = encoded.slice(offset, offset + MAX);
    for (const byte of chunk) b.storeUint(byte, 8);
    if (offset + MAX < encoded.length) b.storeRef(build(offset + MAX));
    return b.endCell();
  };

  return build(0);
}

/** Convert TON string/number to nanoTON BigInt */
export function toNanoSafe(amount: string | number): bigint {
  const s = typeof amount === 'number' ? amount.toFixed(9) : amount;
  if (isNaN(parseFloat(s)) || parseFloat(s) < 0) throw new RangeError(`Invalid amount: ${amount}`);
  return toNano(s);
}

// ─── Collection Deploy State Init ────────────────────────────────────────────

export interface CollectionDeployParams {
  /** Owner address (connected wallet) */
  ownerAddress: string;
  /** Collection content IPFS URL (points to collection.json) */
  collectionContentUrl: string;
  /** Base URL for individual NFT metadata (e.g. https://ipfs.io/ipfs/CID/) */
  nftItemContentBaseUrl: string;
  /** Royalty percent 0–100 */
  royaltyPercent: number;
  /** Royalty recipient address */
  royaltyAddress: string;
  /** Mint price in TON (string, e.g. "0.5") */
  mintPriceTon: string;
}

/**
 * Builds the StateInit cell for deploying a new NFT Collection contract.
 *
 * We use the standard TON NFT Collection contract code (pre-compiled hex).
 * This is the official reference implementation from ton-blockchain/token-contract.
 *
 * The collection data layout:
 *   owner_address       MsgAddress
 *   next_item_index     uint64
 *   collection_content  ^Cell  (TEP-64 off-chain)
 *   nft_item_code       ^Cell  (NFT Item contract code)
 *   royalty_params      ^Cell  (royalty_factor uint16, royalty_base uint16, royalty_address MsgAddress)
 */

// Official TON NFT Collection contract code (hex-encoded BOC)
// Source: https://github.com/ton-blockchain/token-contract/blob/main/nft/nft-collection.fc
const NFT_COLLECTION_CODE_HEX =
  'b5ee9c724102140100021f000114ff00f4a413f4bcf2c80b0102016202030202cd04050201200e0f04e7d10638048adf000e8698180b8d848adf07d201800e98fe99ff6a2687d20699fea6a6a184108349e9ca829405d47141baf8280e8410854658056b84008646582a802e78b127d010a65b509e58fe59f80e78b64c0207d80701b28b9e382f970c892e000f18112e001718112e001f181181981e0024060708090201200a0b72fb021307e07e51202b38c7f80b0b47af0b5001f02de8fef3cef800b2003ef900f80e7a19c001f2001f0f001a08007d8301d0d3030178b470e4702b08f80718102a905d47141823f47010b78b664c02d5b808703018205220d2081010088d43f6103db3c53a1526e46a2820e8060835e06a01830c2085e2208a01285221d0d3030135b498203e900c0408f886602260e0b2093cc020c0a08d43f6103db3c53a1526e46';

// Official TON NFT Item contract code (hex-encoded BOC)
const NFT_ITEM_CODE_HEX =
  'b5ee9c7241020d010001d0000114ff00f4a413f4bcf2c80b0102016202030202ce04050009a11f9fe00502012006070201200b0c02d70c8871c02497c0f83434c0c05c6c2497c0f83e903e900c7e800c5c75c87e800c7e800c00b4c7e08403e29fa954882ea54c4d167c0238208405e3514654882ea58c511100fc02780d60841657c1ef2ea4d67c02b817c12103fcbc2000113e910c1c2ebcb853600201200d0e0009a1dc9634b1c00105e8b8b18310310010b7e1d8a1c72c';

function buildNftItemCode(): Cell {
  // Parse the hex BOC into a Cell
  return Cell.fromBoc(Buffer.from(NFT_ITEM_CODE_HEX, 'hex'))[0];
}

function buildCollectionCode(): Cell {
  return Cell.fromBoc(Buffer.from(NFT_COLLECTION_CODE_HEX, 'hex'))[0];
}

export function buildCollectionStateInit(params: CollectionDeployParams): {
  stateInit: Cell;
  collectionAddress: string;
} {
  const ownerAddr = Address.parse(params.ownerAddress);
  const royaltyAddr = Address.parse(params.royaltyAddress);

  // Royalty: factor/base = percent/100 → use base 1000
  const royaltyFactor = Math.round(params.royaltyPercent * 10);
  const royaltyBase = 1000;

  // Royalty params cell
  const royaltyCell = beginCell()
    .storeUint(royaltyFactor, 16)
    .storeUint(royaltyBase, 16)
    .storeAddress(royaltyAddr)
    .endCell();

  // Collection content cell (TEP-64 off-chain)
  const collectionContentCell = encodeOffChainContent(params.collectionContentUrl);

  // NFT item base content cell
  const nftItemContentCell = encodeOffChainContent(params.nftItemContentBaseUrl);

  // Combined content cell
  const contentCell = beginCell()
    .storeRef(collectionContentCell)
    .storeRef(nftItemContentCell)
    .endCell();

  const nftItemCode = buildNftItemCode();
  const collectionCode = buildCollectionCode();

  // Collection data cell
  const dataCell = beginCell()
    .storeAddress(ownerAddr)
    .storeUint(0, 64)           // next_item_index starts at 0
    .storeRef(contentCell)
    .storeRef(nftItemCode)
    .storeRef(royaltyCell)
    .endCell();

  // StateInit = { code, data }
  const stateInit = beginCell()
    .storeUint(0, 2)            // no split_depth, no special
    .storeMaybeRef(collectionCode)
    .storeMaybeRef(dataCell)
    .storeUint(0, 1)            // no libraries
    .endCell();

  // Derive collection address: workchain 0, hash of stateInit
  const address = new Address(0, stateInit.hash());
  return { stateInit, collectionAddress: address.toString({ urlSafe: true, bounceable: true }) };
}

// ─── Mint Payload ─────────────────────────────────────────────────────────────

export interface MintPayloadParams {
  itemIndex: number;
  metadataUrl: string;
  itemOwnerAddress: string;
}

/**
 * Builds TEP-62 mint message body Cell.
 * Returns base64 BOC for TonConnect `payload` field.
 */
export function buildMintPayload(params: MintPayloadParams): string {
  const { itemIndex, metadataUrl, itemOwnerAddress } = params;

  const ownerAddr = Address.parse(itemOwnerAddress);
  const queryId = BigInt(Date.now() % Number.MAX_SAFE_INTEGER);

  // Individual NFT content
  const nftContent = encodeOffChainContent(metadataUrl);

  // NFT item init message body
  const nftItemMessage = beginCell()
    .storeAddress(ownerAddr)
    .storeRef(nftContent)
    .endCell();

  // Mint body: op=1
  const mintCell = beginCell()
    .storeUint(1, 32)                     // op = mint
    .storeUint(queryId, 64)               // query_id
    .storeUint(itemIndex, 64)             // item_index
    .storeCoins(toNano('0.03'))           // forward amount for NFT item storage
    .storeRef(nftItemMessage)             // NFT item init data
    .endCell();

  return mintCell.toBoc().toString('base64');
}
