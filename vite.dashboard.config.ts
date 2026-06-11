import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'dashboard',
  base: '/dashboard/',
  plugins: [react()],
  build: {
    outDir: '../dist/dashboard',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Keep the app's own main chunk small (< 350 kB): the two big
        // static vendors get their own long-lived cacheable chunks.
        // recharts (PriceHistoryChart) and xlsx are dynamic imports and
        // already split into lazy chunks automatically.
        manualChunks(id: string) {
          const norm = id.replace(/\\/g, '/');
          if (!norm.includes('node_modules')) return undefined;
          if (
            norm.includes('node_modules/firebase/') ||
            norm.includes('node_modules/@firebase/')
          ) {
            return 'vendor-firebase';
          }
          if (
            norm.includes('node_modules/react-dom/') ||
            norm.includes('node_modules/react/') ||
            norm.includes('node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }
          return undefined;
        },
      },
    },
  },
});
