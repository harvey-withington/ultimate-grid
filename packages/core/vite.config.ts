import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname, 'demo'),
  server: {
    fs: {
      // Allow serving files from the package root (so ../src/ is accessible)
      allow: [__dirname],
    },
  },
});
