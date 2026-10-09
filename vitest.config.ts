import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const pkg = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@omnifile/core': pkg('core'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts'],
  },
});
