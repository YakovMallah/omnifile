import { decodeText, ensureStyle, type PluginImplementation } from '@omnifile/core';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

export interface MarkdownOptions {
  /**
   * Load images the document links to on other servers. On by default, as in
   * most Markdown previews; turn it off so opening a file contacts nobody.
   */
  remoteImages?: boolean;
}

export interface MarkdownModel {
  /** Sanitised HTML. */
  html: string;
  source: string;
}

const CSS = `
.omnifile-markdown { min-height: 100%; background: var(--omnifile-surface); padding: 28px clamp(16px, 5%, 56px) 48px; }
.omnifile-markdown-body { max-width: 780px; margin: 0 auto; font-size: 1em; line-height: 1.65; overflow-wrap: break-word; }
.omnifile-markdown-body > :first-child { margin-top: 0; }
.omnifile-markdown-body h1, .omnifile-markdown-body h2, .omnifile-markdown-body h3,
.omnifile-markdown-body h4, .omnifile-markdown-body h5, .omnifile-markdown-body h6 { line-height: 1.25; margin: 1.6em 0 0.6em; font-weight: 650; }
.omnifile-markdown-body h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid var(--omnifile-border); }
.omnifile-markdown-body h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--omnifile-border); }
.omnifile-markdown-body h3 { font-size: 1.25em; }
.omnifile-markdown-body p, .omnifile-markdown-body ul, .omnifile-markdown-body ol,
.omnifile-markdown-body blockquote, .omnifile-markdown-body pre, .omnifile-markdown-body table { margin: 0 0 1em; }
.omnifile-markdown-body ul, .omnifile-markdown-body ol { padding-left: 1.6em; }
.omnifile-markdown-body li + li { margin-top: 0.25em; }
.omnifile-markdown-body a { color: var(--omnifile-accent); }
.omnifile-markdown-body img { max-width: 100%; height: auto; }
.omnifile-markdown-body code { font-family: var(--omnifile-mono); font-size: 0.88em; background: var(--omnifile-bg); padding: 0.15em 0.4em; border-radius: 4px; }
.omnifile-markdown-body pre { background: var(--omnifile-bg); border: 1px solid var(--omnifile-border); border-radius: 6px; padding: 12px 14px; overflow: auto; line-height: 1.5; }
.omnifile-markdown-body pre code { background: none; padding: 0; font-size: 0.86em; }
.omnifile-markdown-body blockquote { padding: 0 1em; color: var(--omnifile-muted); border-left: 4px solid var(--omnifile-border); }
.omnifile-markdown-body hr { border: 0; border-top: 1px solid var(--omnifile-border); margin: 2em 0; }
.omnifile-markdown-body table { border-collapse: collapse; display: block; overflow-x: auto; max-width: 100%; }
.omnifile-markdown-body th, .omnifile-markdown-body td { border: 1px solid var(--omnifile-border); padding: 6px 12px; text-align: left; }
.omnifile-markdown-body th { background: var(--omnifile-bg); font-weight: 600; }
.omnifile-markdown-body input[type="checkbox"] { margin-right: 0.4em; }
.omnifile-markdown-source { margin: 0 auto; max-width: 780px; font: 0.9em/1.6 var(--omnifile-mono); white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 4; }
.omnifile-markdown [hidden] { display: none; }
`;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const REMOTE = /^(?:https?:)?\/\//i;

export function createImplementation(options: MarkdownOptions): PluginImplementation<MarkdownModel> {
  return {
    parse(file) {
      const source = decodeText(file.bytes).text;
      const raw = marked.parse(source, { async: false, gfm: true });
      // Markdown may contain raw HTML, so the output is untrusted.
      return { source, html: DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } }) };
    },

    render(model, { container }) {
      const doc = container.ownerDocument;
      ensureStyle(doc, 'omnifile-markdown-styles', CSS);
      const wrapper = doc.createElement('div');
      wrapper.className = 'omnifile-markdown';
      const body = doc.createElement('article');
      body.className = 'omnifile-markdown-body';

      // Build the tree detached, so blocked images are never requested.
      const template = doc.createElement('template');
      template.innerHTML = model.html;
      for (const link of template.content.querySelectorAll('a[href]')) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
      for (const img of template.content.querySelectorAll('img')) {
        const src = img.getAttribute('src') ?? '';
        img.setAttribute('referrerpolicy', 'no-referrer');
        img.setAttribute('loading', 'lazy');
        if (options.remoteImages === false && REMOTE.test(src)) {
          const placeholder = doc.createElement('span');
          placeholder.textContent = img.getAttribute('alt') || 'image';
          placeholder.style.cssText = 'color:var(--omnifile-muted);font-style:italic;';
          img.replaceWith(placeholder);
        }
      }
      body.append(template.content);

      const source = doc.createElement('pre');
      source.className = 'omnifile-markdown-source';
      source.tabIndex = 0;
      source.textContent = model.source;
      source.hidden = true;
      wrapper.append(body, source);

      let view = 'rendered';
      let zoom = 1;
      const apply = () => {
        wrapper.style.fontSize = `${15 * zoom}px`;
      };
      apply();
      container.append(wrapper);
      return {
        destroy: () => wrapper.remove(),
        views: {
          options: [
            { id: 'rendered', label: 'Rendered' },
            { id: 'source', label: 'Source' },
          ],
          get: () => view,
          set(id) {
            view = id === 'source' ? 'source' : 'rendered';
            body.hidden = view !== 'rendered';
            source.hidden = view !== 'source';
          },
        },
        zoom: {
          min: MIN_ZOOM,
          max: MAX_ZOOM,
          get: () => zoom,
          set(value) {
            zoom = value;
            apply();
          },
        },
      };
    },
  };
}
