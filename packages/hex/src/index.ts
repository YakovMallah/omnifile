import { definePlugin, type OmniPlugin } from '@omnifile/core';
import type { HexModel } from './impl';

export type { HexModel } from './impl';

/**
 * A hex dump of the raw bytes. It registers as a fallback, so listing it
 * gives every file without a renderer something to show instead of the
 * "no preview" state. Pass format ids to use it for specific formats too.
 */
export function hex(options: { formats?: readonly string[] } = {}): OmniPlugin<HexModel> {
  return definePlugin({
    id: 'omnifile/hex',
    formats: options.formats ?? ['*'],
    load: () => import('./impl').then((module) => module.implementation),
    frame: { url: () => new URL('./frame.js', import.meta.url).href },
  });
}
