import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTonAddress } from '@tonconnect/ui-react';
import { useDeploy } from '../hooks/useDeploy';
import { saveCollection } from '../hooks/useCollection';
import toast from 'react-hot-toast';

const PLATFORM_FEE = parseFloat(import.meta.env.VITE_PLATFORM_FEE_PERCENT ?? '5');

interface FormData {
  name: string;
  description: string;
  image: File | null;
  imagePreview: string;
  nftName: string;
  nftDescription: string;
  mintPriceTon: string;
  royaltyPercent: string;
  maxSupply: string;
}

const INITIAL_FORM: FormData = {
  name: '',
  description: '',
  image: null,
  imagePreview: '',
  nftName: '',
  nftDescription: '',
  mintPriceTon: '1',
  royaltyPercent: '5',
  maxSupply: '1000',
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-g-muted text-xs leading-relaxed">{hint}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <motion.svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5}
      animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
    </motion.svg>
  );
}

export default function Create() {
  const navigate = useNavigate();
  const userAddress = useTonAddress();
  const { state, deploy, reset } = useDeploy();
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof FormData, value: string | File | null) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleImage = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file.'); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error('Image must be under 50MB.'); return; }
    const url = URL.createObjectURL(file);
    setForm(prev => ({ ...prev, image: file, imagePreview: url }));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImage(file);
  }, [handleImage]);

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Collection name is required.';
    if (!form.description.trim()) return 'Description is required.';
    if (!form.image) return 'Cover image is required.';
    if (!form.nftName.trim()) return 'NFT name is required.';
    const price = parseFloat(form.mintPriceTon);
    if (isNaN(price) || price < 0.1) return 'Mint price must be at least 0.1 TON.';
    const supply = parseInt(form.maxSupply);
    if (isNaN(supply) || supply < 1 || supply > 100000) return 'Supply must be between 1 and 100,000.';
    const royalty = parseFloat(form.royaltyPercent);
    if (isNaN(royalty) || royalty < 0 || royalty > 50) return 'Royalty must be 0–50%.';
    return null;
  };

  const handleSubmit = async () => {
    if (!userAddress) { toast.error('Connect your wallet first.'); return; }
    const err = validate();
    if (err) { toast.error(err); return; }

    await deploy({
      name: form.name.trim(),
      description: form.description.trim(),
      image: form.image!,
      nftName: form.nftName.trim(),
      nftDescription: form.nftDescription.trim() || form.description.trim(),
      mintPriceTon: form.mintPriceTon,
      royaltyPercent: parseFloat(form.royaltyPercent),
      maxSupply: parseInt(form.maxSupply),
    });
  };

  // On success: save to localStorage and redirect
  if (state.status === 'success' && state.collectionAddress) {
    saveCollection({
      address: state.collectionAddress,
      name: form.name.trim(),
      description: form.description.trim(),
      image: form.imagePreview,
      mintPriceTon: form.mintPriceTon,
      maxSupply: parseInt(form.maxSupply),
      minted: 0,
      royaltyPercent: parseFloat(form.royaltyPercent),
      metadataCid: state.ipfsCid ?? '',
      owner: userAddress ?? '',
      createdAt: Date.now(),
    });
    toast.success('Collection deployed!');
    navigate(`/mint/${state.collectionAddress}`);
  }

  const busy = state.status === 'uploading' || state.status === 'awaiting' || state.status === 'submitted';

  const creatorReceives = (
    (parseFloat(form.mintPriceTon) || 0) * (1 - PLATFORM_FEE / 100)
  ).toFixed(3);
  const platformReceives = (
    (parseFloat(form.mintPriceTon) || 0) * (PLATFORM_FEE / 100)
  ).toFixed(3);

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* Page title */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-g-white">Create Collection</h1>
        <p className="text-g-muted text-sm mt-1">
          Deploy your NFT collection contract directly on the TON blockchain.
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }} className="space-y-6">

        {/* ── Collection info ── */}
        <div className="card p-6 space-y-5">
          <h2 className="text-g-white font-semibold text-sm uppercase tracking-wider">
            Collection Info
          </h2>

          {/* Image upload */}
          <Field label="Cover Image" hint="Recommended: 1:1 ratio, min 500×500px. Max 50MB.">
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              className="relative rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 overflow-hidden"
              style={{ borderColor: form.image ? '#4f8eff' : '#1e1e2e' }}
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && handleImage(e.target.files[0])} />

              {form.imagePreview ? (
                <div className="relative aspect-video">
                  <img src={form.imagePreview} alt="preview"
                    className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.6)' }}>
                    <span className="text-white text-sm font-medium">Change image</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: '#111118' }}>
                    <svg className="w-6 h-6 text-g-muted" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth={1.5}>
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" />
                      <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-g-text text-sm font-medium">Click to upload</p>
                    <p className="text-g-muted text-xs">or drag and drop</p>
                  </div>
                </div>
              )}
            </div>
          </Field>

          {/* Name */}
          <Field label="Collection Name">
            <input className="input-field" placeholder="e.g. Cosmic Apes"
              value={form.name} onChange={e => set('name', e.target.value)} maxLength={64} />
          </Field>

          {/* Description */}
          <Field label="Description">
            <textarea className="input-field resize-none" rows={3}
              placeholder="Describe your collection..."
              value={form.description}
              onChange={e => set('description', e.target.value)} maxLength={500} />
          </Field>
        </div>

        {/* ── NFT Info ── */}
        <div className="card p-6 space-y-5">
          <h2 className="text-g-white font-semibold text-sm uppercase tracking-wider">NFT Item Info</h2>

          <Field label="NFT Name Prefix"
            hint='Each NFT will be named "{NFT Name} #1", "{NFT Name} #2", etc.'>
            <input className="input-field" placeholder="e.g. Cosmic Ape"
              value={form.nftName} onChange={e => set('nftName', e.target.value)} maxLength={64} />
          </Field>

          <Field label="NFT Description" hint="Optional. Falls back to collection description.">
            <textarea className="input-field resize-none" rows={2}
              placeholder="Description for individual NFT items..."
              value={form.nftDescription}
              onChange={e => set('nftDescription', e.target.value)} maxLength={300} />
          </Field>
        </div>

        {/* ── Mint Settings ── */}
        <div className="card p-6 space-y-5">
          <h2 className="text-g-white font-semibold text-sm uppercase tracking-wider">Mint Settings</h2>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Mint Price (TON)">
              <input className="input-field" type="number" min="0.1" step="0.1"
                placeholder="1.0" value={form.mintPriceTon}
                onChange={e => set('mintPriceTon', e.target.value)} />
            </Field>

            <Field label="Max Supply">
              <input className="input-field" type="number" min="1" max="100000"
                placeholder="1000" value={form.maxSupply}
                onChange={e => set('maxSupply', e.target.value)} />
            </Field>
          </div>

          <Field label="Royalty %" hint="Percentage you receive on secondary sales (0–50%).">
            <div className="flex items-center gap-3">
              <input className="input-field" type="number" min="0" max="50" step="0.5"
                placeholder="5" value={form.royaltyPercent}
                onChange={e => set('royaltyPercent', e.target.value)} />
              <span className="text-g-muted text-sm font-mono shrink-0">%</span>
            </div>
          </Field>

          {/* Revenue breakdown */}
          {parseFloat(form.mintPriceTon) > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-xl p-4 space-y-2.5"
              style={{ background: '#111118', border: '1px solid #1e1e2e' }}>
              <p className="text-g-muted text-xs font-mono uppercase tracking-wider">
                Revenue per mint
              </p>
              <div className="space-y-2">
                {[
                  { label: 'You receive', value: `${creatorReceives} TON`, color: '#10b981' },
                  { label: `Platform fee (${PLATFORM_FEE}%)`, value: `${platformReceives} TON`, color: '#4a4a6a' },
                  { label: 'Total mint price', value: `${parseFloat(form.mintPriceTon).toFixed(3)} TON`, color: '#4f8eff' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-g-muted text-xs font-mono">{label}</span>
                    <span className="text-xs font-mono font-bold" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Error */}
        <AnimatePresence>
          {state.status === 'error' && state.error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-xl p-4 flex items-start gap-3"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <span className="text-g-red mt-0.5">⚠</span>
              <div>
                <p className="text-g-red text-sm">{state.error}</p>
                <button onClick={reset} className="text-xs text-g-red/60 hover:text-g-red mt-1 underline">
                  Dismiss
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status progress */}
        <AnimatePresence>
          {busy && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-xl p-4"
              style={{ background: 'rgba(79,142,255,0.06)', border: '1px solid rgba(79,142,255,0.2)' }}>
              <div className="flex items-center gap-3">
                <Spinner />
                <div>
                  <p className="text-g-blue text-sm font-medium">
                    {state.status === 'uploading' && 'Uploading to IPFS...'}
                    {state.status === 'awaiting' && 'Confirm in your wallet...'}
                    {state.status === 'submitted' && 'Broadcasting transaction...'}
                  </p>
                  <p className="text-g-muted text-xs mt-0.5">
                    {state.status === 'uploading' && 'This may take 30–60 seconds.'}
                    {state.status === 'awaiting' && 'Approve the transaction in Tonkeeper.'}
                    {state.status === 'submitted' && 'Waiting for blockchain confirmation.'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit button */}
        <button onClick={handleSubmit} disabled={busy || !userAddress}
          className="btn-primary w-full py-4 text-base">
          {busy ? (
            <><Spinner />
              {state.status === 'uploading' ? 'Uploading...' : 'Deploying...'}
            </>
          ) : !userAddress ? (
            'Connect Wallet to Deploy'
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2}>
                <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Deploy Collection
            </>
          )}
        </button>

        <p className="text-center text-g-muted text-xs">
          Deploying costs ~0.05 TON for gas and storage on the TON blockchain.
        </p>
      </motion.div>
    </div>
  );
}
