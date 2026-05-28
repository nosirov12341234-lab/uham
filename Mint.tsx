import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { useCollection } from '../hooks/useCollection';
import { useMint } from '../hooks/useMint';

const PLATFORM_FEE = parseFloat(import.meta.env.VITE_PLATFORM_FEE_PERCENT ?? '5');

function Spinner() {
  return (
    <motion.svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5}
      animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
    </motion.svg>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-xl"
      style={{ background: '#111118', border: '1px solid #1e1e2e' }}>
      <span className="text-g-muted text-xs font-mono uppercase tracking-wider">{label}</span>
      <span className="text-g-white font-bold text-base font-mono">{value}</span>
    </div>
  );
}

export default function Mint() {
  const { address } = useParams<{ address: string }>();
  const userAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const { meta, loading } = useCollection(address);
  const { state, mint, reset, platformFeePercent } = useMint(
    address ?? '',
    meta?.mintPriceTon ?? '1',
    meta?.metadataCid ?? ''
  );

  const isSoldOut = meta ? meta.minted >= meta.maxSupply : false;
  const remaining = meta ? meta.maxSupply - meta.minted : 0;
  const pct = meta ? Math.min((meta.minted / meta.maxSupply) * 100, 100) : 0;
  const busy = state.status === 'preparing' || state.status === 'awaiting';

  const creatorReceives = meta
    ? (parseFloat(meta.mintPriceTon) * (1 - platformFeePercent / 100)).toFixed(3)
    : '0';
  const platformReceives = meta
    ? (parseFloat(meta.mintPriceTon) * (platformFeePercent / 100)).toFixed(3)
    : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3">
        <Spinner />
        <span className="text-g-muted text-sm">Loading collection...</span>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-g-white font-semibold">Collection not found</p>
        <p className="text-g-muted text-sm">This collection address doesn't exist in our records.</p>
        <Link to="/" className="btn-secondary">← Back to Explore</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* ── Left: NFT Preview ── */}
        <div className="space-y-4">
          {/* Image */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="relative aspect-square rounded-2xl overflow-hidden"
            style={{ background: '#111118', border: '1px solid #1e1e2e' }}>
            {meta.image ? (
              <img src={meta.image} alt={meta.name}
                className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg viewBox="0 0 120 120" className="w-24 h-24 opacity-20">
                  <circle cx="60" cy="60" r="50" stroke="#4f8eff" strokeWidth="2" fill="none" />
                  <circle cx="60" cy="60" r="28" fill="#4f8eff" opacity=".3" />
                  <circle cx="60" cy="60" r="12" fill="#4f8eff" opacity=".7" />
                </svg>
              </div>
            )}

            {/* Scan line */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div className="absolute left-0 right-0 h-px opacity-40"
                style={{ background: 'linear-gradient(90deg,transparent,#4f8eff,transparent)' }}
                animate={{ top: ['-1%', '101%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} />
            </div>

            {/* Sold out overlay */}
            {isSoldOut && (
              <div className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.75)' }}>
                <span className="px-4 py-2 rounded-xl font-mono font-bold text-sm"
                  style={{ background: '#16161f', border: '1px solid #ef4444', color: '#ef4444' }}>
                  SOLD OUT
                </span>
              </div>
            )}
          </motion.div>

          {/* Contract address */}
          <div className="rounded-xl p-3 flex items-center justify-between gap-2"
            style={{ background: '#111118', border: '1px solid #1e1e2e' }}>
            <span className="text-g-muted text-xs font-mono">Contract</span>
            <a href={`https://${import.meta.env.VITE_TON_NETWORK === 'mainnet' ? '' : 'testnet.'}tonscan.org/address/${meta.address}`}
              target="_blank" rel="noopener noreferrer"
              className="text-g-blue text-xs font-mono hover:underline truncate max-w-[200px]">
              {meta.address.slice(0, 8)}...{meta.address.slice(-6)} ↗
            </a>
          </div>
        </div>

        {/* ── Right: Info + Mint ── */}
        <div className="space-y-5">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="badge text-xs font-mono"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-g-green animate-pulse" />
                Live
              </span>
              <span className="badge"
                style={{ background: 'rgba(79,142,255,0.08)', border: '1px solid rgba(79,142,255,0.2)', color: '#4f8eff' }}>
                TEP-62
              </span>
            </div>
            <h1 className="text-2xl font-bold text-g-white">{meta.name}</h1>
            <p className="text-g-muted text-sm mt-1.5 leading-relaxed">{meta.description}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Mint Price" value={`${meta.mintPriceTon} TON`} />
            <StatBox label="Remaining" value={remaining.toLocaleString()} />
            <StatBox label="Total Supply" value={meta.maxSupply.toLocaleString()} />
            <StatBox label="Royalty" value={`${meta.royaltyPercent}%`} />
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-g-muted">{meta.minted} minted</span>
              <span className="text-g-muted">{Math.round(pct)}%</span>
            </div>
            <div className="h-2 bg-g-border rounded-full overflow-hidden">
              <motion.div className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg,#4f8eff,#7c3aed)' }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: 'easeOut' }} />
            </div>
          </div>

          {/* Revenue breakdown */}
          <div className="rounded-xl p-4 space-y-2"
            style={{ background: '#111118', border: '1px solid #1e1e2e' }}>
            <p className="text-g-muted text-xs font-mono uppercase tracking-wider">Per mint</p>
            {[
              { label: 'Creator receives', value: `${creatorReceives} TON`, color: '#10b981' },
              { label: `Platform (${PLATFORM_FEE}%)`, value: `${platformReceives} TON`, color: '#4a4a6a' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between">
                <span className="text-g-muted text-xs font-mono">{label}</span>
                <span className="text-xs font-mono font-bold" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Success state */}
          <AnimatePresence>
            {state.status === 'success' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl p-4"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <p className="text-g-green font-semibold text-sm">
                  🎉 NFT #{state.itemIndex} minted successfully!
                </p>
                <p className="text-g-muted text-xs mt-1">
                  Your NFT has been sent to your wallet.
                </p>
                <button onClick={reset}
                  className="text-xs text-g-green/70 hover:text-g-green mt-2 underline">
                  Mint another
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error state */}
          <AnimatePresence>
            {state.status === 'error' && state.error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="rounded-xl p-4"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <p className="text-g-red text-sm">{state.error}</p>
                <button onClick={reset}
                  className="text-xs text-g-red/60 hover:text-g-red mt-1 underline">
                  Try again
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA Button */}
          {!isSoldOut && state.status !== 'success' && (
            <>
              {!userAddress ? (
                <button onClick={() => tonConnectUI.openModal()} className="btn-primary w-full py-4 text-base">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
                    <circle cx="12" cy="14" r="2" fill="currentColor" stroke="none" />
                  </svg>
                  Connect Wallet to Mint
                </button>
              ) : (
                <motion.button
                  onClick={mint}
                  disabled={busy}
                  whileHover={!busy ? { scale: 1.01 } : {}}
                  whileTap={!busy ? { scale: 0.99 } : {}}
                  className="btn-primary w-full py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? (
                    <>
                      <Spinner />
                      {state.status === 'preparing' ? 'Preparing...' : 'Confirm in wallet...'}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Mint NFT — {meta.mintPriceTon} TON
                    </>
                  )}
                </motion.button>
              )}
            </>
          )}

          {isSoldOut && (
            <div className="rounded-xl py-4 text-center"
              style={{ background: '#16161f', border: '1px solid #1e1e2e' }}>
              <p className="text-g-muted text-sm font-mono">This collection is sold out</p>
            </div>
          )}

          {/* Back link */}
          <Link to="/" className="flex items-center gap-1.5 text-g-muted text-xs hover:text-g-text transition-colors w-fit">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Explore
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
