import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  dts: true,
  splitting: true,
  clean: true,
  target: 'es2022',
});
