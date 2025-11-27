import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/workers-ai.ts',
    'src/vectorize.ts',
    'src/testing.ts',
  ],
  format: ['cjs', 'esm'],
  dts: false, // Disabled due to namespace hoisting issues - will use tsc for types
  sourcemap: true,
  clean: true,
  minify: false,
  splitting: false,
  external: [],
  treeshake: true,
  target: 'es2022',
  platform: 'neutral',
  shims: false,
});