import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  base: '/ultimate-grid/',
  build: {
    outDir: resolve(__dirname, '../dist/site'),
    emptyOutDir: true,
  },
  server: {
    port: 5180,
    fs: {
      allow: ['..'],
    },
  },
});
