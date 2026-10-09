import { definePlugin, type OmniPlugin } from '@omnifile/core';
import type { FontModel } from './impl';

export type { FontModel } from './impl';
export { readFontInfo, type FontInfo } from './sfnt';

/** A specimen page for a font file, with a line you can type into. */
export function font(): OmniPlugin<FontModel> {
  return definePlugin({
    id: 'omnifile/font',
    formats: ['ttf', 'otf', 'woff', 'woff2'],
    load: () => import('./impl').then((module) => module.implementation),
    frame: { url: () => new URL('./frame.js', import.meta.url).href },
  });
}
