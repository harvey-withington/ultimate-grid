import { defineConfig } from 'vite';

export default defineConfig({
  root: 'demo',
  server: {
    fs: {
      // Allow serving files from the package root (so ../src/ is accessible)
      allow: ['..'],
    },
  },
});
