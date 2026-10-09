import { definePlugin, type OmniPlugin } from '@omnifile/core';
import type { TextModel } from './impl';

export type { TextModel } from './impl';
export { decodeText } from './decode';

const FORMATS = [
  'text', 'markdown', 'json', 'csv', 'tsv', 'html', 'xml', 'yaml', 'css', 'javascript',
  'typescript', 'code',
] as const;

/**
 * Text and source files, shown as plain text with line numbers. HTML and
 * Markdown are shown as source, never executed or rendered.
 */
export function text(): OmniPlugin<TextModel> {
  return definePlugin({
    id: 'omnifile/text',
    formats: FORMATS,
    load: () => import('./impl').then((module) => module.implementation),
  });
}
