import { Link, useLocation } from 'react-router-dom';
import { TonConnectButton } from '@tonconnect/ui-react';
import { motion } from 'framer-motion';

export default function Header() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-g-border/60 backdrop-blur-xl"
      style={{ background: 'rgba(10,10,15,0.85)' }}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#4f8eff,#7c3aed)' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" opacity=".3" />
            </svg>
          </div>
          <span className="font-semibold text-g-white text-sm tracking-tight hidden sm:block">
            TON NFT
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {[
            { to: '/', label: 'Explore' },
            { to: '/create', label: 'Create' },
          ].map(({ to, label }) => {
            const active = pathname === to;
            return (
              <Link key={to} to={to}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-g-hover text-g-white'
                    : 'text-g-muted hover:text-g-text hover:bg-g-surface'
                }`}>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Wallet */}
        <div className="shrink-0">
          <TonConnectButton />
        </div>
      </div>

      {/* Active page indicator */}
      <motion.div
        layoutId="nav-indicator"
        className="h-px"
        style={{ background: 'linear-gradient(90deg, transparent, #4f8eff, #7c3aed, transparent)' }}
      />
    </header>
  );
}
