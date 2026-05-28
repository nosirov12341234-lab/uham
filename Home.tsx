import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCollections } from '../hooks/useCollection';
import CollectionCard from '../components/CollectionCard';

export default function Home() {
  const { collections } = useCollections();
  const [search, setSearch] = useState('');

  const filtered = collections.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center py-10 space-y-4"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-2"
          style={{ background: 'rgba(79,142,255,0.08)', border: '1px solid rgba(79,142,255,0.2)', color: '#4f8eff' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-g-blue animate-pulse" />
          TON Blockchain · Testnet
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-g-white tracking-tight">
          Create & Mint NFTs on TON
        </h1>
        <p className="text-g-muted text-base max-w-md mx-auto leading-relaxed">
          Deploy your NFT collection in minutes. Set your price, supply, and royalties.
          Anyone can mint directly on-chain.
        </p>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link to="/create" className="btn-primary">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Create Collection
          </Link>
          <a href="https://ton.org" target="_blank" rel="noopener noreferrer"
            className="btn-secondary">
            Learn TON
          </a>
        </div>
      </motion.div>

      {/* Stats bar */}
      {collections.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-px rounded-2xl overflow-hidden"
          style={{ background: '#1e1e2e' }}
        >
          {[
            { label: 'Collections', value: collections.length },
            { label: 'Total Minted', value: collections.reduce((s, c) => s + c.minted, 0) },
            { label: 'Total Supply', value: collections.reduce((s, c) => s + c.maxSupply, 0) },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center py-4 gap-1" style={{ background: '#111118' }}>
              <span className="text-xs font-mono text-g-muted uppercase tracking-wider">{label}</span>
              <span className="text-lg font-bold text-g-white font-mono">{value.toLocaleString()}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Search */}
      {collections.length > 0 && (
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-g-muted"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search collections..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      )}

      {/* Collections grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((col, i) => (
            <CollectionCard key={col.address} collection={col} index={i} />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 gap-5"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: '#16161f', border: '1px solid #1e1e2e' }}>
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-g-muted" fill="none"
              stroke="currentColor" strokeWidth={1.5}>
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-g-white font-semibold mb-1">
              {search ? 'No collections found' : 'No collections yet'}
            </p>
            <p className="text-g-muted text-sm">
              {search ? 'Try a different search term' : 'Be the first to create one!'}
            </p>
          </div>
          {!search && (
            <Link to="/create" className="btn-primary mt-2">
              Create First Collection
            </Link>
          )}
        </motion.div>
      )}
    </div>
  );
}
