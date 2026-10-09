import { decodeText, type PluginImplementation } from '@omnifile/core';

export interface HtmlOptions {
  /**
   * Let the page load images, styles and fonts from the network. Off by
   * default, so opening a file never contacts another server.
   */
  allowRemote?: boolean;
}

export interface HtmlModel {
  html: string;
}

const POLICY =
  "default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; font-src data:";

/** Insert a Content-Security-Policy that blocks every network request. */
export function withContentPolicy(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${POLICY}">`;
  // The policy must come first in <head>, and must not precede the doctype.
  const head = /<head[^>]*>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + meta + html.slice(head.index + head[0].length);
  const root = /<html[^>]*>/i.exec(html);
  if (root) return html.slice(0, root.index + root[0].length) + `<head>${meta}</head>` + html.slice(root.index + root[0].length);
  const doctype = /<!doctype[^>]*>/i.exec(html);
  const at = doctype ? doctype.index + doctype[0].length : 0;
  return html.slice(0, at) + meta + html.slice(at);
}

export function createImplementation(options: HtmlOptions): PluginImplementation<HtmlModel> {
  return {
    parse: (file) => ({ html: decodeText(file.bytes).text }),

    render(model, { container, file }) {
      const doc = container.ownerDocument;
      const frame = doc.createElement('iframe');
      frame.title = file.name;
      // An empty sandbox: no scripts, no forms, no navigation of the host
      // page, and a unique origin that cannot read the host's storage.
      frame.setAttribute('sandbox', '');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.style.cssText = 'display:block;width:100%;height:100%;border:0;background:#fff;';
      frame.srcdoc = options.allowRemote ? model.html : withContentPolicy(model.html);

      const source = doc.createElement('pre');
      source.tabIndex = 0;
      source.style.cssText =
        'margin:0;padding:12px 16px;height:100%;overflow:auto;box-sizing:border-box;' +
        'background:var(--omnifile-surface);font:13px/1.5 var(--omnifile-mono);white-space:pre;tab-size:4;';
      source.textContent = model.html;
      source.hidden = true;

      // Each view scrolls on its own; stop the viewport adding a second bar.
      const previous = container.style.overflow;
      container.style.overflow = 'hidden';
      container.append(frame, source);

      let view = 'preview';
      return {
        destroy() {
          frame.remove();
          source.remove();
          container.style.overflow = previous;
        },
        views: {
          options: [
            { id: 'preview', label: 'Preview' },
            { id: 'source', label: 'Source' },
          ],
          get: () => view,
          set(id) {
            view = id === 'source' ? 'source' : 'preview';
            frame.style.display = view === 'preview' ? 'block' : 'none';
            source.hidden = view !== 'source';
          },
        },
      };
    },
  };
}
