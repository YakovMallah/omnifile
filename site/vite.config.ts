import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const src = (name: string, entry = 'index.ts') =>
  fileURLToPath(new URL(`../packages/${name}/src/${entry}`, import.meta.url));

// GitHub Pages serves a project site from /<repository>/, so the deploy
// workflow passes that path in. Locally the site lives at the root.
const base = process.env.SITE_BASE ? `${process.env.SITE_BASE.replace(/\/$/, '')}/` : '/';

export default defineConfig({
  base,
  plugins: [react()],
  // The sample files are shared with the playground.
  publicDir: fileURLToPath(new URL('../playground/public', import.meta.url)),
  resolve: {
    alias: {
      '@omnifile/core': src('core'),
      '@omnifile/react': src('react', 'index.tsx'),
      '@omnifile/image': src('image'),
      '@omnifile/media': src('media'),
      '@omnifile/text': src('text'),
      '@omnifile/pdf': src('pdf'),
    },
  },
});
