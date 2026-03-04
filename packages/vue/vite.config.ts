import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import vue from '@vitejs/plugin-vue';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname, 'demo'),
  plugins: [vue()],
  server: {
    port: 5176,
    open: true,
    fs: {
      allow: [resolve(__dirname, '..'), resolve(__dirname, '../../core')],
    },
  },
});
