/**
 * payloadBuilder.ts
 *
 * Builds the binary Cell payload for NFT minting on a TEP-62 compliant
 * NFT Collection smart-contract deployed on the TON blockchain.
 *
 * TEP-62 mint op-code: 1  (0x00000001)
 * Message body structure:
 *   uint32  op          = 1
 *   uint64  query_id    = random / 0
 *   uint256 item_index  = next token index
 *   coins   amount      = forwarded TON for storage + gas of the new NFT item
 *   ref     nft_content = Cell containing the individual NFT metadata URL
 *
 * The NFT content cell follows the on-chain metadata standard (TEP-64):
 *   uint8   prefix = 0x01 (off-chain snake format)
 *   bytes   url    = UTF-8 encoded metadata URI
 */

import { beginCell, toNano, Cell } from '@ton/core';

/** Minimum TON forwarded to the new NFT item contract for storage/gas */
const NFT_ITEM_FORWARD_AMOUNT = toNano('0.03');

/**
 * Encodes a UTF-8 string into a TON Cell using the snake-cell encoding
 * required by TEP-64 off-chain metadata standard.
 * Strings longer than 126 bytes are split across linked cells.
 */
function encodeSnakeString(text: string): Cell {
  const encoded = new TextEncoder().encode(text);
  const MAX_BYTES_PER_CELL = 126; // 1023 bits / 8 − 1 byte prefix

  const buildChain = (offset: number): Cell => {
    const slice = encoded.slice(offset, offset + MAX_BYTES_PER_CELL);
    const builder = beginCell();

    if (offset === 0) {
      // First cell: prefix byte 0x01 = off-chain content
      builder.storeUint(0x01, 8);
    }

    for (const byte of slice) {
      builder.storeUint(byte, 8);
    }

    if (offset + MAX_BYTES_PER_CELL < encoded.length) {
      builder.storeRef(buildChain(offset + MAX_BYTES_PER_CELL));
    }

    return builder.endCell();
  };

  return buildChain(0);
}

export interface MintPayloadParams {
  /** Zero-based index of the NFT item to mint (next available index) */
  itemIndex: number;
  /** Full metadata URI, e.g. https://ipfs.io/ipfs/CID/1.json */
  metadataUrl: string;
  /**
   * Optional query ID for deduplication (defaults to current timestamp
   * truncated to uint64 range)
   */
  queryId?: bigint;
}

export interface MintPayloadResult {
  /** Hex-encoded BOC (Bag of Cells) to pass into TonConnect sendTransaction */
  payloadBoc: string;
  /** Raw Cell object (useful for debugging / unit tests) */
  cell: Cell;
}

/**
 * Builds a TEP-62 compliant `mint` message body as a TON Cell and returns
 * it encoded as a base64 BOC string ready for TonConnect's `payload` field.
 *
 * @example
 * const { payloadBoc } = buildMintPayload({
 *   itemIndex: 42,
 *   metadataUrl: 'https://ipfs.io/ipfs/Qm.../42.json',
 * });
 */
export function buildMintPayload(params: MintPayloadParams): MintPayloadResult {
  const { itemIndex, metadataUrl, queryId } = params;

  if (itemIndex < 0 || !Number.isInteger(itemIndex)) {
    throw new RangeError(`itemIndex must be a non-negative integer, got: ${itemIndex}`);
  }
  if (!metadataUrl || metadataUrl.trim().length === 0) {
    throw new Error('metadataUrl must not be empty');
  }

  const resolvedQueryId =
    queryId ?? BigInt(Date.now() % Number.MAX_SAFE_INTEGER);

  // Build the individual NFT content cell (TEP-64 off-chain snake format)
  const nftContentCell = encodeSnakeString(metadataUrl.trim());

  // Build the mint message body according to TEP-62 collection interface
  const mintCell = beginCell()
    .storeUint(1, 32)                           // op = 1 (mint)
    .storeUint(resolvedQueryId, 64)             // query_id
    .storeUint(itemIndex, 64)                   // item_index (uint64 in most impls)
    .storeCoins(NFT_ITEM_FORWARD_AMOUNT)        // amount forwarded to NFT item
    .storeRef(                                  // nft_content ref
      beginCell()
        .storeRef(nftContentCell)               // individual content cell
        .endCell()
    )
    .endCell();

  // Serialize to base64 BOC (the format TonConnect expects in `payload`)
  const payloadBoc = mintCell.toBoc().toString('base64');

  return { payloadBoc, cell: mintCell };
}

/**
 * Converts a TON amount (string or number) to nanoTON BigInt.
 * Wraps toNano() with validation.
 */
export function toNanoSafe(amount: string | number): bigint {
  const str = typeof amount === 'number' ? amount.toFixed(9) : amount;
  const parsed = parseFloat(str);
  if (isNaN(parsed) || parsed < 0) {
    throw new RangeError(`Invalid TON amount: ${amount}`);
  }
  return toNano(str);
}
