import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Required for @ton/core and buffer-dependent libs in browser
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Polyfill Node.js Buffer for browser environment
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          ton: ['@ton/core', '@ton/crypto', '@ton/ton'],
          tonconnect: ['@tonconnect/ui-react'],
          framer: ['framer-motion'],
        },
      },
    },
  },
});
