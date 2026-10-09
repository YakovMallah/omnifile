import { definePlugin, type OmniPlugin } from '@omnifile/core';
import type { DocxModel } from './impl';

export type { DocxModel } from './impl';

/**
 * Word documents, laid out as pages in the browser with docx-preview.
 * Layout is close to Word's but not identical; complex documents can differ.
 */
export function docx(): OmniPlugin<DocxModel> {
  return definePlugin({
    id: 'omnifile/docx',
    formats: ['docx'],
    load: () => import('./impl').then((module) => module.implementation),
    frame: { url: () => new URL('./frame.js', import.meta.url).href },
  });
}
