import { definePlugin, type OmniPlugin } from '@omnifile/core';
import type { ImageModel } from './impl';

export type { ImageModel } from './impl';

/** Formats every current browser decodes natively. */
const NATIVE_FORMATS = ['png', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg'] as const;

/** Images, shown with the browser's own decoders. */
export function image(): OmniPlugin<ImageModel> {
  return definePlugin({
    id: 'omnifile/image',
    formats: NATIVE_FORMATS,
    load: () => import('./impl').then((module) => module.implementation),
    frame: { url: () => new URL('./frame.js', import.meta.url).href },
  });
}
