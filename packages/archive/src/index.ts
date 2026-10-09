import { definePlugin, type OmniPlugin } from '@omnifile/core';
import type { ArchiveModel } from './impl';

export type { ArchiveEntry, ArchiveModel } from './zip';
export { readZipDirectory } from './zip';
export { buildTree, type TreeNode } from './tree';

/**
 * Shows what is inside a ZIP archive as a folder tree, like a file explorer.
 * Nothing is extracted.
 */
export function archive(): OmniPlugin<ArchiveModel> {
  return definePlugin({
    id: 'omnifile/archive',
    formats: ['zip'],
    load: () => import('./impl').then((module) => module.implementation),
    frame: { url: () => new URL('./frame.js', import.meta.url).href },
  });
}
