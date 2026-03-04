import { defineConfig } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default defineConfig({
  input: 'src/index.ts',
  external: [
    '@angular/core',
    '@angular/common',
    '@angular/platform-browser',
    '@angular/platform-browser-dynamic',
  ],
  plugins: [
    nodeResolve(),
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
