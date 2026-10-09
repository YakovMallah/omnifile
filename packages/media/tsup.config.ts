import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    splitting: true,
    target: 'es2022',
  },
  {
    // One self-contained file, dependencies included, for the sandbox frame.
    entry: { frame: 'src/frame.ts' },
    format: ['esm'],
    splitting: false,
    noExternal: [/./],
    minify: true,
    platform: 'browser',
    target: 'es2022',
  },
]);
