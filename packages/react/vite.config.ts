import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname, 'demo'),
  plugins: [react()],
  server: {
    port: 5175,
    open: true,
    fs: {
      allow: [resolve(__dirname, '..'), resolve(__dirname, '../../core')],
    },
  },
});
