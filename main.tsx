import { Buffer } from 'buffer';
(window as unknown as Record<string, unknown>).Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

const MANIFEST_URL =
  import.meta.env.VITE_MANIFEST_URL ??
  `${window.location.origin}/tonconnect-manifest.json`;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <BrowserRouter>
        <App />
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: '#16161f',
              color: '#e8e8f8',
              border: '1px solid #1e1e2e',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              borderRadius: '14px',
              padding: '14px 18px',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#16161f' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#16161f' },
            },
          }}
        />
      </BrowserRouter>
    </TonConnectUIProvider>
  </React.StrictMode>
);
