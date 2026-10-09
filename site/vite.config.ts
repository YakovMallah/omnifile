import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// GitHub Pages serves a project site from /<repository>/, so the deploy
// workflow passes that path in. Locally the site lives at the root.
const base = process.env.SITE_BASE ? `${process.env.SITE_BASE.replace(/\/$/, '')}/` : '/';

// The site uses the built packages, exactly as an app installing them from
// npm would, so run `pnpm build` first (the `site` scripts do).
export default defineConfig({
  base,
  plugins: [react()],
  // The sample files are shared with the playground.
  publicDir: fileURLToPath(new URL('../playground/public', import.meta.url)),
});
