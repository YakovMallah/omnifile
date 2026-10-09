import { definePlugin, type OmniPlugin } from '@omnifile/core';
import type { CodeModel } from './impl';

export type { CodeModel } from './impl';
export { languageFor } from './languages';

const FORMATS = [
  'json', 'html', 'xml', 'yaml', 'css', 'javascript', 'typescript', 'code', 'ipynb',
] as const;

/**
 * Source files with syntax colours and line numbers. List it after `text()`
 * so it takes these formats over.
 */
export function code(): OmniPlugin<CodeModel> {
  return definePlugin({
    id: 'omnifile/code',
    formats: FORMATS,
    load: () => import('./impl').then((module) => module.implementation),
    frame: { url: () => new URL('./frame.js', import.meta.url).href },
  });
}
