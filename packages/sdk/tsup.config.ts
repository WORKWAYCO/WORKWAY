import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
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