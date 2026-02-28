import typescript from '@rollup/plugin-typescript';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('rollup').RollupOptions[]} */
export default [
  {
    input: resolve(__dirname, 'src/index.ts'),
    output: [
      {
        file: resolve(__dirname, 'dist/index.js'),
        format: 'esm',
        sourcemap: true,
      },
      {
        file: resolve(__dirname, 'dist/index.cjs'),
        format: 'cjs',
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({
        tsconfig: resolve(__dirname, 'tsconfig.json'),
        declaration: false,
        declarationMap: false,
      }),
    ],
  },
];
