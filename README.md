# CyberGenesis — TON NFT Minting Platform

Production-ready NFT minting platform built on the TON blockchain with TonConnect integration.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Styling**: TailwindCSS + Framer Motion
- **TON Integration**: `@tonconnect/ui-react`, `@ton/core`, `@ton/ton`, `@ton/crypto`
- **Deploy**: Vercel (zero-config)

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env` and fill in your values:

```bash
cp .env .env.local
```

| Variable | Description |
|---|---|
| `VITE_ADMIN_WALLET` | Your platform wallet address (EQ...) |
| `VITE_ADMIN_FEE` | Commission fee in TON (e.g. `0.05`) |
| `VITE_NFT_COLLECTION_ADDRESS` | Deployed TEP-62 collection contract address |
| `VITE_MINT_PRICE` | NFT price in TON (e.g. `0.5`) |
| `VITE_TON_NETWORK` | `testnet` or `mainnet` |
| `VITE_MANIFEST_URL` | Full URL to your `/tonconnect-manifest.json` |
| `VITE_COLLECTION_NAME` | Display name for the collection |
| `VITE_COLLECTION_IMAGE` | IPFS/HTTPS URL for collection preview image |
| `VITE_NFT_BASE_METADATA_URL` | Base URL for individual token metadata JSON |
| `VITE_MAX_SUPPLY` | Maximum NFT supply |

### 3. Update TonConnect manifest

Edit `public/tonconnect-manifest.json` with your production domain.

### 4. Run locally

```bash
npm run dev
```

### 5. Build for production

```bash
npm run build
```

---

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard or via CLI:
vercel env add VITE_ADMIN_WALLET
vercel env add VITE_NFT_COLLECTION_ADDRESS
# ... (add all VITE_ vars)

# Redeploy with env vars
vercel --prod
```

---

## Architecture

### Multi-message Transaction Flow

When a user clicks "Mint NFT", a **single TonConnect transaction** is submitted containing **two messages**:

```
User Wallet
    │
    ├──► Message 1: Admin Fee (VITE_ADMIN_FEE TON)
    │         └─► VITE_ADMIN_WALLET
    │
    └──► Message 2: Mint Request (VITE_MINT_PRICE TON + payload)
              └─► VITE_NFT_COLLECTION_ADDRESS
                      └─► Deploys new NFT Item contract (TEP-62)
```

### Payload Structure (TEP-62)

```
Cell {
  uint32  op         = 1          // mint op-code
  uint64  query_id               // dedup ID
  uint64  item_index             // next NFT index (from get_collection_data)
  coins   amount     = 0.03 TON  // forwarded to NFT item for storage
  ref Cell {
    ref Cell {                   // TEP-64 off-chain metadata
      uint8  0x01                // snake prefix
      bytes  "ipfs://.../{n}.json"
    }
  }
}
```

---

## NFT Collection Contract Requirements

Your collection contract must implement the **TEP-62** standard:

- `get_collection_data()` → returns `(next_item_index, collection_content, owner_address)`
- Accept `op=1` (mint) messages with the payload structure above
- Deploy individual NFT item contracts per mint

Recommended: use [TON NFT Collection](https://github.com/ton-blockchain/token-contract/tree/main/nft) reference implementation.

---

## Telegram Mini App (TMA)

For TMA deployment:
1. Update `actionsConfiguration.twaReturnUrl` in `App.tsx` to your bot URL
2. Add the Telegram SDK: `npm install @twa-dev/sdk`
3. Initialize it in `main.tsx` before render

---

## License

MIT
