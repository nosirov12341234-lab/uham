/**
 * App.tsx
 *
 * Root application component.
 * Sets up TonConnectUIProvider with the correct manifest URL and network,
 * then renders the full cyberpunk NFT minting UI around MintCard.
 */

import { TonConnectUIProvider, TonConnectButton } from '@tonconnect/ui-react';
import { Toaster } from 'react-hot-toast';
import { motion } from 'framer-motion';
import MintCard from './components/MintCard';

// ─── Env ──────────────────────────────────────────────────────────────────────

const MANIFEST_URL =
  import.meta.env.VITE_MANIFEST_URL ??
  `${window.location.origin}/tonconnect-manifest.json`;

const NETWORK = (import.meta.env.VITE_TON_NETWORK ?? 'testnet') as
  | 'testnet'
  | 'mainnet';

// ─── Background Canvas ────────────────────────────────────────────────────────

function CyberBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* Deep radial background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(123,47,255,0.15) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(0,229,255,0.08) 0%, transparent 60%), #080c14',
        }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,229,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating orbs */}
      <motion.div
        className="absolute w-96 h-96 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(123,47,255,0.12) 0%, transparent 70%)',
          top: '10%',
          left: '5%',
          filter: 'blur(40px)',
        }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-80 h-80 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(0,229,255,0.08) 0%, transparent 70%)',
          bottom: '15%',
          right: '8%',
          filter: 'blur(40px)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />

      {/* Diagonal scan line */}
      <motion.div
        className="absolute left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(0,229,255,0.15) 30%, rgba(123,47,255,0.15) 70%, transparent 100%)',
        }}
        animate={{ top: ['-1%', '101%'] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-5xl mx-auto px-4 py-5 flex items-center justify-between"
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(123,47,255,0.3), rgba(0,229,255,0.2))',
            border: '1px solid rgba(0,229,255,0.3)',
            boxShadow: '0 0 16px rgba(0,229,255,0.2)',
          }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
            <polygon
              points="12,2 22,7 22,17 12,22 2,17 2,7"
              stroke="url(#logoGrad)"
              strokeWidth="1.5"
              fill="url(#logoFill)"
            />
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7b2fff" />
                <stop offset="100%" stopColor="#00e5ff" />
              </linearGradient>
              <linearGradient id="logoFill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7b2fff" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.1" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div>
          <span
            className="font-display font-bold text-sm block"
            style={{
              background: 'linear-gradient(135deg, #00e5ff, #7b2fff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            CyberGenesis
          </span>
          <span className="text-cyber-muted text-[10px] font-display uppercase tracking-widest block -mt-0.5">
            NFT Platform
          </span>
        </div>
      </div>

      {/* Network badge + TonConnect button */}
      <div className="flex items-center gap-3">
        {/* Network indicator */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
          style={{
            background:
              NETWORK === 'testnet'
                ? 'rgba(245,197,66,0.08)'
                : 'rgba(52,211,153,0.08)',
            border: `1px solid ${
              NETWORK === 'testnet'
                ? 'rgba(245,197,66,0.25)'
                : 'rgba(52,211,153,0.25)'
            }`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{
              background: NETWORK === 'testnet' ? '#f5c542' : '#34d399',
            }}
          />
          <span
            className="text-[11px] font-display uppercase tracking-wider"
            style={{ color: NETWORK === 'testnet' ? '#f5c542' : '#34d399' }}
          >
            {NETWORK}
          </span>
        </div>

        {/* Official TonConnect button (styled via CSS variables) */}
        <div className="ton-connect-btn-wrapper">
          <TonConnectButton />
        </div>
      </div>
    </motion.header>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar() {
  const stats = [
    { label: 'Total Minted', value: '342' },
    { label: 'Floor Price', value: '0.5 TON' },
    { label: 'Holders', value: '289' },
    { label: 'Network', value: 'TON' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="w-full max-w-5xl mx-auto px-4 mb-8"
    >
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden"
        style={{ background: 'rgba(0,229,255,0.08)' }}
      >
        {stats.map((s, i) => (
          <div
            key={i}
            className="flex flex-col items-center py-4 gap-1"
            style={{ background: 'rgba(8,12,20,0.95)' }}
          >
            <span className="text-cyber-muted text-[10px] font-display uppercase tracking-widest">
              {s.label}
            </span>
            <span
              className="text-sm font-display font-bold"
              style={{
                background: 'linear-gradient(135deg, #00e5ff, #7b2fff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Feature Pills ────────────────────────────────────────────────────────────

function FeaturePills() {
  const pills = [
    '⬡ TEP-62 Standard',
    '🔐 On-chain Metadata',
    '⚡ Instant Minting',
    '🌐 IPFS Storage',
  ];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="flex flex-wrap justify-center gap-2 mt-8 px-4"
    >
      {pills.map((p, i) => (
        <span
          key={i}
          className="text-[11px] font-display text-cyber-muted px-3 py-1.5 rounded-full"
          style={{
            background: 'rgba(0,229,255,0.04)',
            border: '1px solid rgba(0,229,255,0.1)',
          }}
        >
          {p}
        </span>
      ))}
    </motion.div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="w-full text-center py-8 px-4"
    >
      <p className="text-cyber-muted text-[11px] font-display">
        Built on{' '}
        <a
          href="https://ton.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyber-glow hover:underline"
        >
          TON Blockchain
        </a>{' '}
        · Powered by{' '}
        <a
          href="https://tonconnect.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyber-accent hover:underline"
        >
          TonConnect
        </a>
      </p>
    </motion.footer>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <TonConnectUIProvider
      manifestUrl={MANIFEST_URL}
      /**
       * actionsConfiguration lets us customise the TonConnect modal behaviour.
       * `twaReturnUrl` is important for Telegram Mini Apps — set to your bot URL.
       */
      actionsConfiguration={{
        twaReturnUrl: 'https://t.me/YOUR_BOT_USERNAME',
      }}
    >
      {/* Toast notifications (positioned top-center) */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#0d1524',
            color: '#c8d8f0',
            border: '1px solid rgba(0,229,255,0.2)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            borderRadius: '12px',
          },
        }}
      />

      {/* Full-page layout */}
      <div className="relative min-h-screen flex flex-col">
        <CyberBackground />

        {/* Content layer (above background) */}
        <div className="relative z-10 flex flex-col min-h-screen">
          <Header />

          <main className="flex-1 flex flex-col items-center justify-start px-4 pb-8">
            <StatsBar />

            {/* Page headline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-center mb-8 px-4"
            >
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold mb-3 leading-tight">
                <span
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #c8d8f0 40%, #00e5ff 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Mint Your
                </span>{' '}
                <span
                  style={{
                    background: 'linear-gradient(135deg, #7b2fff 0%, #00e5ff 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Genesis NFT
                </span>
              </h1>
              <p className="text-cyber-muted text-sm sm:text-base max-w-md mx-auto leading-relaxed">
                Secure your place in the CyberGenesis collection — 1,000 unique
                generative NFTs permanently stored on the TON blockchain.
              </p>
            </motion.div>

            {/* The Mint Card */}
            <MintCard />

            <FeaturePills />
          </main>

          <Footer />
        </div>
      </div>
    </TonConnectUIProvider>
  );
}
