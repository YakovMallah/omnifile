import { definePlugin, type OmniPlugin } from '@omnifile/core';
import type { MarkdownModel, MarkdownOptions } from './impl';

export type { MarkdownModel, MarkdownOptions } from './impl';

/**
 * Markdown rendered as a formatted document. The generated HTML is
 * sanitised, so scripts and event handlers in the file never run.
 */
export function markdown(options: MarkdownOptions = {}): OmniPlugin<MarkdownModel> {
  return definePlugin({
    id: 'omnifile/markdown',
    formats: ['markdown'],
    load: () => import('./impl').then((module) => module.createImplementation(options)),
    frame: { url: () => new URL('./frame.js', import.meta.url).href, options: options },
  });
}
