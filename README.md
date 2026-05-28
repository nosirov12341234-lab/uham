# TON NFT Platform

Deploy and mint NFT collections on the TON blockchain. No backend required.

## Features

- Create NFT Collections (TEP-62) directly from the browser
- Upload metadata to IPFS via NFT.Storage (free)
- Public minting page per collection (`/mint/:address`)
- Platform commission taken automatically from each mint
- TonConnect — Tonkeeper, MyTonWallet, Telegram Wallet support

## Setup

### 1. Install
```bash
npm install
```

### 2. Configure `.env`
```env
VITE_ADMIN_WALLET=EQD...your_wallet_here
VITE_PLATFORM_FEE_PERCENT=5
VITE_TON_NETWORK=testnet
VITE_MANIFEST_URL=https://your-domain.vercel.app/tonconnect-manifest.json
VITE_NFT_STORAGE_KEY=your_nft_storage_key
```

Get your free NFT.Storage key at https://nft.storage

### 3. Dev
```bash
npm run dev
```

### 4. Deploy to Vercel
```bash
vercel
# Add all VITE_ env vars in Vercel dashboard
vercel --prod
```

After first deploy, update:
1. `VITE_MANIFEST_URL` → your Vercel URL
2. `public/tonconnect-manifest.json` → your Vercel URL
Then redeploy.

## Flow

```
User creates collection (/create)
  → Uploads image to NFT.Storage (IPFS)
  → Deploys TEP-62 contract on TON
  → Gets unique mint page (/mint/:address)

Anyone mints (/mint/:address)
  → TonConnect sends 2 messages in 1 tx:
      Msg 1 → Admin wallet (platform fee %)
      Msg 2 → Collection contract (mint)
  → NFT deployed to buyer's wallet
```

## Pages

| Route | Description |
|---|---|
| `/` | Explore all collections |
| `/create` | Deploy new collection |
| `/mint/:address` | Public mint page |
