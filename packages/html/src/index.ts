import { definePlugin, type OmniPlugin } from '@omnifile/core';
import type { HtmlModel, HtmlOptions } from './impl';

export type { HtmlModel, HtmlOptions } from './impl';
export { withContentPolicy } from './impl';

/**
 * Previews an HTML page inside a sandboxed frame. Its scripts never run, and
 * by default it cannot load anything from the network. List this after
 * `text()` or `code()` to preview HTML files instead of showing their source.
 */
export function html(options: HtmlOptions = {}): OmniPlugin<HtmlModel> {
  return definePlugin({
    id: 'omnifile/html',
    formats: ['html'],
    load: () => import('./impl').then((module) => module.createImplementation(options)),
    frame: { url: () => new URL('./frame.js', import.meta.url).href, options: options },
  });
}
