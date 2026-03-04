import { defineConfig } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import svelte from 'rollup-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';

export default defineConfig({
  input: 'src/index.ts',
  external: ['svelte', 'svelte/internal'],
  plugins: [
    svelte({ preprocess: sveltePreprocess() }),
    nodeResolve({ browser: true }),
    typescript({ tsconfig: './tsconfig.json', declaration: true, declarationDir: './dist' }),
  ],
  output: [
    {
      file:    'dist/index.js',
      format:  'esm',
      sourcemap: true,
    },
    {
      file:    'dist/index.cjs',
      format:  'cjs',
      sourcemap: true,
      exports: 'named',
    },
  ],
});
