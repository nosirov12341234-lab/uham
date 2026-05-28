import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { CollectionMeta } from '../hooks/useCollection';

interface Props {
  collection: CollectionMeta;
  index: number;
}

export default function CollectionCard({ collection, index }: Props) {
  const pct = Math.min((collection.minted / collection.maxSupply) * 100, 100);
  const remaining = collection.maxSupply - collection.minted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to={`/mint/${collection.address}`} className="block group">
        <div className="card transition-all duration-200 group-hover:border-g-blue/30
          group-hover:shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_0_1px_rgba(79,142,255,0.15)]
          overflow-hidden">

          {/* Cover image */}
          <div className="relative aspect-square overflow-hidden bg-g-surface">
            {collection.image ? (
              <img src={collection.image} alt={collection.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#111118,#16161f)' }}>
                <svg viewBox="0 0 80 80" className="w-16 h-16 opacity-20">
                  <circle cx="40" cy="40" r="30" stroke="#4f8eff" strokeWidth="2" fill="none" />
                  <circle cx="40" cy="40" r="16" fill="#4f8eff" opacity=".4" />
                </svg>
              </div>
            )}

            {/* Mint price badge */}
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-white"
              style={{ background: 'rgba(10,10,15,0.85)', border: '1px solid rgba(79,142,255,0.3)' }}>
              {collection.mintPriceTon} TON
            </div>
          </div>

          {/* Info */}
          <div className="p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-g-white text-sm truncate">{collection.name}</h3>
              <p className="text-g-muted text-xs mt-0.5 line-clamp-2 leading-relaxed">
                {collection.description}
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-g-muted font-mono">{collection.minted} minted</span>
                <span className="text-g-muted font-mono">{remaining} left</span>
              </div>
              <div className="h-1 bg-g-border rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg,#4f8eff,#7c3aed)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.2 + index * 0.06 }} />
              </div>
            </div>

            {/* Footer stats */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-g-green animate-pulse-slow" />
                <span className="text-g-green text-xs font-mono">Live</span>
              </div>
              <span className="text-g-muted text-xs font-mono">
                {collection.royaltyPercent}% royalty
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
