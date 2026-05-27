/**
 * MintCard.tsx
 *
 * The centrepiece UI component for the NFT Minting Platform.
 * Renders:
 *  - Live NFT preview with animated glow and floating effect
 *  - Collection metadata (name, supply, price breakdown)
 *  - Progress bar for remaining supply
 *  - Trait badges
 *  - Connect Wallet / Mint NFT CTA button
 *  - Real-time transaction status feedback
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { useTonMint } from '../hooks/useTonMint';
import type { MintStatus } from '../hooks/useTonMint';

// ─── Env ─────────────────────────────────────────────────────────────────────

const COLLECTION_NAME = import.meta.env.VITE_COLLECTION_NAME ?? 'CyberGenesis';
const COLLECTION_DESC =
  import.meta.env.VITE_COLLECTION_DESCRIPTION ??
  'A limited collection of generative cyberpunk NFTs on TON.';
const COLLECTION_IMAGE = import.meta.env.VITE_COLLECTION_IMAGE ?? '';
const MAX_SUPPLY = parseInt(import.meta.env.VITE_MAX_SUPPLY ?? '1000', 10);

// Simulated minted count — in production replace with on-chain `next_item_index`
// fetched via TonClient.runMethod('get_collection_data') in a useEffect
const DEMO_MINTED = 342;

// ─── Sub-components ───────────────────────────────────────────────────────────

function HexagonBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-cyber-border/30 border border-cyber-border rounded-lg px-3 py-2 backdrop-blur-sm">
      <span className="text-cyber-muted text-[10px] uppercase tracking-widest font-display">
        {label}
      </span>
      <span className="text-cyber-glow text-sm font-display font-bold">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: MintStatus }) {
  const config: Record<MintStatus, { color: string; label: string; pulse: boolean }> = {
    idle: { color: 'bg-cyber-muted', label: 'Ready', pulse: false },
    preparing: { color: 'bg-yellow-400', label: 'Preparing...', pulse: true },
    awaiting: { color: 'bg-cyber-glow', label: 'Confirm in Wallet', pulse: true },
    submitted: { color: 'bg-blue-400', label: 'Broadcasting...', pulse: true },
    success: { color: 'bg-green-400', label: 'Minted!', pulse: false },
    error: { color: 'bg-cyber-danger', label: 'Error', pulse: false },
  };

  const { color, label, pulse } = config[status];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`}
      />
      <span className="text-xs font-display text-cyber-text/70 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

function ProgressBar({ minted, max }: { minted: number; max: number }) {
  const pct = Math.min((minted / max) * 100, 100);
  return (
    <div className="w-full">
      <div className="flex justify-between mb-1.5">
        <span className="text-xs text-cyber-muted font-display uppercase tracking-wider">
          Minted
        </span>
        <span className="text-xs font-display">
          <span className="text-cyber-glow">{minted.toLocaleString()}</span>
          <span className="text-cyber-muted"> / {max.toLocaleString()}</span>
        </span>
      </div>
      <div className="h-1.5 bg-cyber-border rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #7b2fff 0%, #00e5ff 100%)',
            boxShadow: '0 0 8px rgba(0,229,255,0.5)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
        />
      </div>
    </div>
  );
}

// ─── NFT Preview Image ────────────────────────────────────────────────────────

function NftPreviewImage({ src }: { src: string }) {
  const placeholder = !src || src.includes('YOUR_COLLECTION_IMAGE_CID');

  return (
    <div className="relative w-full aspect-square rounded-2xl overflow-hidden">
      {/* Glow ring behind image */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(0,229,255,0.15) 0%, rgba(123,47,255,0.1) 50%, transparent 70%)',
        }}
      />

      {placeholder ? (
        /* Generative placeholder art */
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            background:
              'linear-gradient(135deg, #0d1524 0%, #131e33 40%, #0a1628 100%)',
          }}
        >
          <svg viewBox="0 0 400 400" className="w-4/5 h-4/5 opacity-90">
            <defs>
              <linearGradient id="cg1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7b2fff" />
                <stop offset="100%" stopColor="#00e5ff" />
              </linearGradient>
              <linearGradient id="cg2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#7b2fff" stopOpacity="0.4" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Outer hexagon */}
            <polygon
              points="200,30 360,115 360,285 200,370 40,285 40,115"
              fill="none"
              stroke="url(#cg1)"
              strokeWidth="2"
              filter="url(#glow)"
            />
            {/* Inner hexagon */}
            <polygon
              points="200,80 320,147 320,253 200,320 80,253 80,147"
              fill="url(#cg2)"
              stroke="url(#cg1)"
              strokeWidth="1"
            />
            {/* Center gem */}
            <polygon
              points="200,130 260,165 260,235 200,270 140,235 140,165"
              fill="url(#cg1)"
              opacity="0.9"
              filter="url(#glow)"
            />
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map((i) => (
              <line
                key={i}
                x1={80 + i * 60}
                y1="80"
                x2={80 + i * 60}
                y2="320"
                stroke="rgba(0,229,255,0.06)"
                strokeWidth="1"
              />
            ))}
            {[0, 1, 2, 3, 4].map((i) => (
              <line
                key={i}
                x1="80"
                y1={80 + i * 60}
                x2="320"
                y2={80 + i * 60}
                stroke="rgba(0,229,255,0.06)"
                strokeWidth="1"
              />
            ))}
            {/* Corner accents */}
            {[
              [40, 115], [360, 115], [360, 285], [40, 285],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="4" fill="#00e5ff" opacity="0.7" />
            ))}
          </svg>
        </div>
      ) : (
        <img
          src={src}
          alt={COLLECTION_NAME}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      )}

      {/* Scan line overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute left-0 right-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(0,229,255,0.5), transparent)',
          }}
          animate={{ top: ['0%', '100%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Corner brackets */}
      {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map(
        (pos, i) => (
          <div key={i} className={`absolute ${pos} w-5 h-5`}>
            <svg viewBox="0 0 20 20" className="w-full h-full">
              <path
                d={
                  i === 0
                    ? 'M0 8 L0 0 L8 0'
                    : i === 1
                    ? 'M12 0 L20 0 L20 8'
                    : i === 2
                    ? 'M0 12 L0 20 L8 20'
                    : 'M12 20 L20 20 L20 12'
                }
                fill="none"
                stroke="#00e5ff"
                strokeWidth="1.5"
                opacity="0.7"
              />
            </svg>
          </div>
        )
      )}
    </div>
  );
}

// ─── Mint Button ──────────────────────────────────────────────────────────────

interface MintButtonProps {
  isConnected: boolean;
  status: MintStatus;
  totalCost: string;
  onConnect: () => void;
  onMint: () => void;
}

function MintButton({
  isConnected,
  status,
  totalCost,
  onConnect,
  onMint,
}: MintButtonProps) {
  const isLoading =
    status === 'preparing' || status === 'awaiting' || status === 'submitted';
  const isSuccess = status === 'success';

  if (!isConnected) {
    return (
      <motion.button
        onClick={onConnect}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-4 rounded-xl font-display text-sm uppercase tracking-widest font-bold relative overflow-hidden group"
        style={{
          background: 'linear-gradient(135deg, #7b2fff 0%, #00e5ff 100%)',
          boxShadow: '0 0 30px rgba(123,47,255,0.4), 0 0 60px rgba(0,229,255,0.2)',
        }}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          <WalletIcon />
          Connect Wallet
        </span>
        <motion.div
          className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"
          style={{ mixBlendMode: 'overlay' }}
        />
      </motion.button>
    );
  }

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full py-4 rounded-xl font-display text-sm uppercase tracking-widest font-bold text-center"
        style={{
          background: 'linear-gradient(135deg, #0d2b1a 0%, #0a2416 100%)',
          border: '1px solid rgba(52, 211, 153, 0.4)',
          boxShadow: '0 0 30px rgba(52,211,153,0.2)',
          color: '#34d399',
        }}
      >
        <span className="flex items-center justify-center gap-2">
          <CheckIcon />
          NFT Minted Successfully!
        </span>
      </motion.div>
    );
  }

  return (
    <motion.button
      onClick={onMint}
      disabled={isLoading}
      whileHover={!isLoading ? { scale: 1.02 } : {}}
      whileTap={!isLoading ? { scale: 0.98 } : {}}
      className="w-full py-4 rounded-xl font-display text-sm uppercase tracking-widest font-bold relative overflow-hidden disabled:cursor-not-allowed"
      style={{
        background: isLoading
          ? 'linear-gradient(135deg, #1a1a2e 0%, #1a2740 100%)'
          : 'linear-gradient(135deg, #7b2fff 0%, #00e5ff 100%)',
        boxShadow: isLoading
          ? 'none'
          : '0 0 30px rgba(123,47,255,0.4), 0 0 60px rgba(0,229,255,0.2)',
        border: isLoading ? '1px solid rgba(0,229,255,0.2)' : 'none',
        color: isLoading ? 'rgba(200,216,240,0.5)' : '#fff',
      }}
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-3"
          >
            <SpinnerIcon />
            {status === 'preparing'
              ? 'Preparing Mint...'
              : status === 'awaiting'
              ? 'Confirm in Wallet...'
              : 'Broadcasting...'}
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2"
          >
            <DiamondIcon />
            Mint NFT — {totalCost} TON
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────

function WalletIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
      <circle cx="12" cy="13" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 3L2 9l10 12L22 9l-4-6H6z" />
      <path d="M2 9h20M6 3l4 6M18 3l-4 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <motion.svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
    </motion.svg>
  );
}

// ─── Main MintCard Component ──────────────────────────────────────────────────

export default function MintCard() {
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const isConnected = !!userAddress;

  const { mintState, mint, reset, totalCostTon, mintPriceTon, adminFeeTon } =
    useTonMint();

  // Shorten address for display
  const shortAddress = userAddress
    ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
    : null;

  const handleConnect = () => {
    tonConnectUI.openModal();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-md mx-auto"
    >
      {/* Card */}
      <div
        className="rounded-2xl border border-cyber-border/50 overflow-hidden relative"
        style={{
          background:
            'linear-gradient(160deg, rgba(13,21,36,0.95) 0%, rgba(8,12,20,0.98) 100%)',
          boxShadow:
            '0 0 0 1px rgba(0,229,255,0.08), 0 32px 64px rgba(0,0,0,0.6), 0 0 80px rgba(123,47,255,0.1)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Top accent line */}
        <div
          className="h-px w-full"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(0,229,255,0.6), rgba(123,47,255,0.6), transparent)',
          }}
        />

        <div className="p-6 space-y-5">
          {/* Header row */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-display uppercase tracking-widest px-2 py-0.5 rounded"
                  style={{
                    background: 'rgba(0,229,255,0.08)',
                    border: '1px solid rgba(0,229,255,0.2)',
                    color: '#00e5ff',
                  }}
                >
                  TON Blockchain
                </span>
                <StatusBadge status={mintState.status} />
              </div>
              <h2
                className="text-xl font-display font-bold"
                style={{
                  background: 'linear-gradient(135deg, #00e5ff 0%, #7b2fff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {COLLECTION_NAME}
              </h2>
            </div>

            {/* Connected address chip */}
            <AnimatePresence>
              {isConnected && shortAddress && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                  style={{
                    background: 'rgba(0,229,255,0.06)',
                    border: '1px solid rgba(0,229,255,0.15)',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[11px] font-display text-cyber-text/70">
                    {shortAddress}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* NFT Preview */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <NftPreviewImage src={COLLECTION_IMAGE} />
          </motion.div>

          {/* Collection description */}
          <p className="text-cyber-muted text-sm leading-relaxed">{COLLECTION_DESC}</p>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <HexagonBadge label="Supply" value={MAX_SUPPLY.toLocaleString()} />
            <HexagonBadge label="Price" value={`${mintPriceTon} TON`} />
            <HexagonBadge
              label="Remaining"
              value={(MAX_SUPPLY - DEMO_MINTED).toLocaleString()}
            />
          </div>

          {/* Progress bar */}
          <ProgressBar minted={DEMO_MINTED} max={MAX_SUPPLY} />

          {/* Price breakdown */}
          <div
            className="rounded-xl p-3 space-y-2"
            style={{
              background: 'rgba(0,229,255,0.03)',
              border: '1px solid rgba(0,229,255,0.08)',
            }}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs text-cyber-muted font-display">Mint Price</span>
              <span className="text-xs text-cyber-text font-display">
                {mintPriceTon} TON
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-cyber-muted font-display">Platform Fee</span>
              <span className="text-xs text-cyber-text font-display">
                {adminFeeTon} TON
              </span>
            </div>
            <div
              className="h-px w-full"
              style={{ background: 'rgba(0,229,255,0.1)' }}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs font-display font-bold text-cyber-text">
                Total
              </span>
              <span
                className="text-sm font-display font-bold"
                style={{
                  background: 'linear-gradient(135deg, #f5c542, #e88c00)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {totalCostTon} TON
              </span>
            </div>
          </div>

          {/* Error message */}
          <AnimatePresence>
            {mintState.status === 'error' && mintState.error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div
                  className="rounded-xl p-3 flex items-start gap-2"
                  style={{
                    background: 'rgba(255,56,96,0.08)',
                    border: '1px solid rgba(255,56,96,0.25)',
                  }}
                >
                  <span className="text-cyber-danger text-sm mt-0.5">⚠</span>
                  <div className="flex-1">
                    <p className="text-cyber-danger text-xs leading-relaxed">
                      {mintState.error}
                    </p>
                    <button
                      onClick={reset}
                      className="text-[11px] text-cyber-danger/60 hover:text-cyber-danger mt-1 underline underline-offset-2"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success info */}
          <AnimatePresence>
            {mintState.status === 'success' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div
                  className="rounded-xl p-3 space-y-1"
                  style={{
                    background: 'rgba(52,211,153,0.06)',
                    border: '1px solid rgba(52,211,153,0.2)',
                  }}
                >
                  <p className="text-green-400 text-xs font-display">
                    NFT #{mintState.itemIndex} minted successfully!
                  </p>
                  {mintState.txHash && (
                    <p className="text-cyber-muted text-[11px] font-display">
                      Tx: {mintState.txHash}
                    </p>
                  )}
                  <button
                    onClick={reset}
                    className="text-[11px] text-green-400/60 hover:text-green-400 underline underline-offset-2"
                  >
                    Mint another
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA Button */}
          <MintButton
            isConnected={isConnected}
            status={mintState.status}
            totalCost={totalCostTon}
            onConnect={handleConnect}
            onMint={mint}
          />

          {/* Footer note */}
          <p className="text-center text-cyber-muted text-[11px] font-display">
            Transactions secured by TON blockchain · TEP-62 standard
          </p>
        </div>

        {/* Bottom accent line */}
        <div
          className="h-px w-full"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(123,47,255,0.4), rgba(0,229,255,0.4), transparent)',
          }}
        />
      </div>
    </motion.div>
  );
}
