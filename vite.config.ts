import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Force Rolldown to resolve all peer-dep variants to the same root instance.
    dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled', '@emotion/cache'],
  },

  // Pre-bundle ESM-only unified/remark packages so Vite doesn't fail in dev.
  optimizeDeps: {
    include: ['react-markdown', 'remark-gfm'],
  },

  // Tauri dev server settings
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Tell Vite to not watch src-tauri (Rust rebuilds handled by cargo)
      ignored: ['**/src-tauri/**'],
    },
  },
});
