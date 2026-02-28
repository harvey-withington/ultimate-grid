import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'src/ultimate-grid-angularjs.js',
  external: ['angular'],
  plugins: [nodeResolve()],
  output: [
    {
      file: 'dist/ultimate-grid-angularjs.js',
      format: 'es',
      sourcemap: true,
    },
    {
      file: 'dist/ultimate-grid-angularjs.cjs',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/ultimate-grid-angularjs.umd.js',
      format: 'umd',
      name: 'UltimateGridAngularJS',
      globals: { angular: 'angular' },
      sourcemap: true,
    },
  ],
};
