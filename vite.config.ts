import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      stream: 'stream-browserify',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
    esbuildOptions: { target: 'esnext' },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          ton: ['@ton/core', '@ton/crypto', '@ton/ton'],
          tonconnect: ['@tonconnect/ui-react'],
          router: ['react-router-dom'],
        },
      },
    },
  },
});
