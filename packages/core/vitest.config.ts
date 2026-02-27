import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['src/render/__tests__/**', 'jsdom'],
      ['src/__tests__/createGrid*', 'jsdom'],
      ['demo/__tests__/**', 'jsdom'],
    ],
    include: ['src/**/__tests__/**/*.test.ts', 'demo/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**'],
    },
  },
});
