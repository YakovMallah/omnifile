import { definePlugin, type OmniPlugin } from '@omnifile/core';
import type { ArchiveModel } from './impl';

export type { ArchiveEntry, ArchiveModel } from './zip';
export { readZipDirectory } from './zip';

/** Lists what is inside a ZIP archive, without extracting it. */
export function archive(): OmniPlugin<ArchiveModel> {
  return definePlugin({
    id: 'omnifile/archive',
    formats: ['zip'],
    load: () => import('./impl').then((module) => module.implementation),
    frame: { url: () => new URL('./frame.js', import.meta.url).href },
  });
}
