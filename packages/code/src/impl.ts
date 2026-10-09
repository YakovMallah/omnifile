import { decodeText, ensureStyle, type PluginImplementation } from '@omnifile/core';
import hljs from 'highlight.js/lib/common';
import { languageFor } from './languages';

export interface CodeModel {
  text: string;
  language: string | undefined;
  /** Highlighted HTML from highlight.js (escaped), or undefined for plain. */
  html: string | undefined;
}

/** Highlighting is synchronous; beyond this size it would stall the page. */
const MAX_HIGHLIGHT_CHARS = 400_000;
const MAX_RENDERED_CHARS = 2_000_000;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

const LIGHT = `--tok-keyword:#cf222e;--tok-string:#0a3069;--tok-number:#0550ae;--tok-comment:#6e7781;--tok-title:#8250df;--tok-attr:#116329;--tok-meta:#953800;`;
const DARK = `--tok-keyword:#ff7b72;--tok-string:#a5d6ff;--tok-number:#79c0ff;--tok-comment:#8b949e;--tok-title:#d2a8ff;--tok-attr:#7ee787;--tok-meta:#ffa657;`;

const CSS = `
.omnifile-code { ${LIGHT} min-height: 100%; background: var(--omnifile-surface); font-family: var(--omnifile-mono); line-height: 1.5; }
@media (prefers-color-scheme: dark) { .omnifile:not([data-theme="light"]) .omnifile-code { ${DARK} } }
.omnifile[data-theme="dark"] .omnifile-code { ${DARK} }
.omnifile-code-grid { display: flex; align-items: flex-start; min-width: max-content; }
.omnifile-code pre { margin: 0; font: inherit; }
.omnifile-code-gutter { padding: 12px 10px 12px 14px; text-align: right; user-select: none; color: var(--omnifile-muted); border-right: 1px solid var(--omnifile-border); position: sticky; left: 0; background: var(--omnifile-surface); }
.omnifile-code-text { padding: 12px 16px; tab-size: 4; white-space: pre; }
.omnifile-code .hljs-keyword, .omnifile-code .hljs-selector-tag, .omnifile-code .hljs-literal, .omnifile-code .hljs-doctag, .omnifile-code .hljs-built_in { color: var(--tok-keyword); }
.omnifile-code .hljs-string, .omnifile-code .hljs-regexp, .omnifile-code .hljs-char.escape_, .omnifile-code .hljs-template-variable { color: var(--tok-string); }
.omnifile-code .hljs-number, .omnifile-code .hljs-symbol, .omnifile-code .hljs-bullet, .omnifile-code .hljs-variable.constant_ { color: var(--tok-number); }
.omnifile-code .hljs-comment, .omnifile-code .hljs-quote { color: var(--tok-comment); font-style: italic; }
.omnifile-code .hljs-title, .omnifile-code .hljs-section, .omnifile-code .hljs-type, .omnifile-code .hljs-selector-class, .omnifile-code .hljs-selector-id { color: var(--tok-title); }
.omnifile-code .hljs-attr, .omnifile-code .hljs-attribute, .omnifile-code .hljs-name, .omnifile-code .hljs-tag { color: var(--tok-attr); }
.omnifile-code .hljs-meta, .omnifile-code .hljs-params, .omnifile-code .hljs-property, .omnifile-code .hljs-variable { color: var(--tok-meta); }
.omnifile-code .hljs-emphasis { font-style: italic; }
.omnifile-code .hljs-strong { font-weight: 700; }
.omnifile-code-notice { padding: 10px 16px; font-family: var(--omnifile-font); color: var(--omnifile-muted); border-top: 1px solid var(--omnifile-border); }
`;

export const implementation: PluginImplementation<CodeModel> = {
  parse(file) {
    const { text } = decodeText(file.bytes);
    const language = languageFor(file.format.id, file.name);
    let html: string | undefined;
    if (language && hljs.getLanguage(language) && text.length <= MAX_HIGHLIGHT_CHARS) {
      html = hljs.highlight(text, { language, ignoreIllegals: true }).value;
    }
    return { text, language, html };
  },

  render(model, { container }) {
    const doc = container.ownerDocument;
    ensureStyle(doc, 'omnifile-code-styles', CSS);
    const truncated = model.html === undefined && model.text.length > MAX_RENDERED_CHARS;
    const shown = truncated ? model.text.slice(0, MAX_RENDERED_CHARS) : model.text;
    const lineCount = shown.length === 0 ? 1 : shown.split('\n').length;

    const wrapper = doc.createElement('div');
    wrapper.className = 'omnifile-code';
    const grid = doc.createElement('div');
    grid.className = 'omnifile-code-grid';

    const gutter = doc.createElement('pre');
    gutter.className = 'omnifile-code-gutter';
    gutter.setAttribute('aria-hidden', 'true');
    let numbers = '';
    for (let line = 1; line <= lineCount; line++) numbers += line === 1 ? '1' : `\n${line}`;
    gutter.textContent = numbers;

    const text = doc.createElement('pre');
    text.className = 'omnifile-code-text';
    text.tabIndex = 0;
    // highlight.js escapes the source and emits only <span class> wrappers.
    if (model.html !== undefined) text.innerHTML = model.html;
    else text.textContent = shown;

    grid.append(gutter, text);
    wrapper.append(grid);
    if (truncated) {
      const notice = doc.createElement('div');
      notice.className = 'omnifile-code-notice';
      notice.textContent = 'Only the beginning of this large file is shown. Download it to see the rest.';
      wrapper.append(notice);
    }

    let zoom = 1;
    const apply = () => {
      wrapper.style.fontSize = `${13 * zoom}px`;
    };
    apply();
    container.append(wrapper);
    return {
      destroy: () => wrapper.remove(),
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
