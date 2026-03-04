import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname, 'demo'),
  plugins: [svelte({ preprocess: vitePreprocess() })],
  server: {
    port: 5177,
    fs: {
      allow: [resolve(__dirname, '..'), resolve(__dirname, '../../core')],
    },
  },
});
