import { definePlugin, type OmniPlugin } from '@omnifile/core';
import type { PptxModel } from './impl';

export type { PptxModel } from './impl';

/**
 * PowerPoint presentations, each slide drawn to a canvas by PptxViewJS.
 * Text, shapes, images, tables and charts are drawn; animations, transitions
 * and embedded video are not, and fonts missing from the device are
 * substituted.
 */
export function pptx(): OmniPlugin<PptxModel> {
  return definePlugin({
    id: 'omnifile/pptx',
    formats: ['pptx'],
    load: () => import('./impl').then((module) => module.implementation),
    frame: { url: () => new URL('./frame.js', import.meta.url).href },
  });
}
