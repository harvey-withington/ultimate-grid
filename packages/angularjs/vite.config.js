import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname, 'demo'),
  server: {
    port: 5174,
    open: true,
    fs: {
      allow: [resolve(__dirname, '..'), resolve(__dirname, '../../core')],
    },
  },
});
