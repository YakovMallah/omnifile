import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Point the workspace packages at their sources so the playground hot-reloads
// without a build step.
const src = (name: string, entry = 'index.ts') =>
  fileURLToPath(new URL(`../packages/${name}/src/${entry}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@omnifile/core': src('core'),
      '@omnifile/react': src('react', 'index.tsx'),
      '@omnifile/image': src('image'),
      '@omnifile/media': src('media'),
      '@omnifile/text': src('text'),
      '@omnifile/pdf': src('pdf'),
      '@omnifile/archive': src('archive'),
      '@omnifile/code': src('code'),
      '@omnifile/docx': src('docx'),
      '@omnifile/email': src('email'),
      '@omnifile/font': src('font'),
      '@omnifile/hex': src('hex'),
      '@omnifile/html': src('html'),
      '@omnifile/markdown': src('markdown'),
      '@omnifile/pptx': src('pptx'),
      '@omnifile/sheet': src('sheet'),
      '@omnifile/all': src('all'),
    },
  },
});
