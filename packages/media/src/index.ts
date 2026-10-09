import { definePlugin, type OmniPlugin } from '@omnifile/core';
import type { MediaModel } from './impl';

export type { MediaModel } from './impl';

const FORMATS = ['mp4', 'webm', 'mov', 'mkv', 'ogv', 'mp3', 'wav', 'ogg', 'm4a', 'flac'] as const;

/**
 * Video and audio, played by the browser. Which codecs work depends on the
 * browser; an unsupported one shows the standard error state.
 */
export function media(): OmniPlugin<MediaModel> {
  return definePlugin({
    id: 'omnifile/media',
    formats: FORMATS,
    load: () => import('./impl').then((module) => module.implementation),
    frame: { url: () => new URL('./frame.js', import.meta.url).href },
  });
}
