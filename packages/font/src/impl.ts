import { ensureStyle, type PluginImplementation } from '@omnifile/core';
import { readFontInfo, type FontInfo } from './sfnt';

export interface FontModel {
  info: FontInfo;
  bytes: Uint8Array;
}

const CSS = `
.omnifile-font { min-height: 100%; background: var(--omnifile-surface); padding: 20px 24px 32px; }
.omnifile-font-meta { color: var(--omnifile-muted); margin: 0 0 16px; }
.omnifile-font-meta strong { color: var(--omnifile-text); font-size: 16px; }
.omnifile-font-input { width: 100%; font: inherit; padding: 8px 10px; border: 1px solid var(--omnifile-border); border-radius: 6px; background: var(--omnifile-bg); color: var(--omnifile-text); margin-bottom: 20px; }
.omnifile-font-input:focus-visible { outline: 2px solid var(--omnifile-accent); outline-offset: 1px; }
.omnifile-font-row { display: grid; grid-template-columns: 44px minmax(0, 1fr); align-items: baseline; gap: 12px; padding: 8px 0; border-top: 1px solid var(--omnifile-border); }
.omnifile-font-size { color: var(--omnifile-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.omnifile-font-sample { line-height: 1.25; overflow-wrap: anywhere; }
.omnifile-font-glyphs { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--omnifile-border); font-size: 26px; line-height: 1.5; overflow-wrap: anywhere; }
`;

const DEFAULT_SAMPLE = 'The quick brown fox jumps over the lazy dog';
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 .,:;!?@#&%()[]{}/*+-=';
const SIZES = [72, 48, 32, 24, 16, 12];
let instances = 0;

export const implementation: PluginImplementation<FontModel> = {
  parse: (file) => ({ info: readFontInfo(file.bytes), bytes: file.bytes }),

  async render(model, { container, file }) {
    const doc = container.ownerDocument;
    const view = doc.defaultView ?? window;
    ensureStyle(doc, 'omnifile-font-styles', CSS);

    // A unique family name keeps this font from colliding with the page's.
    const family = `omnifile-font-${++instances}`;
    const face = new view.FontFace(family, model.bytes as Uint8Array<ArrayBuffer>);
    try {
      await face.load();
    } catch {
      throw new Error('This font file is damaged or in a format this browser cannot load.');
    }
    doc.fonts.add(face);

    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
      const node = doc.createElement(tag);
      node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const stack = `"${family}", sans-serif`;
    const wrapper = el('div', 'omnifile-font');

    const { info } = model;
    const meta = el('p', 'omnifile-font-meta');
    meta.append(el('strong', '', info.name ?? info.family ?? file.name));
    const details = [
      info.name && info.style && !info.name.includes(info.style) ? info.style : undefined,
      info.glyphs ? `${info.glyphs.toLocaleString()} glyphs` : undefined,
      info.version,
    ].filter(Boolean);
    if (details.length) meta.append(doc.createElement('br'), details.join(', '));
    wrapper.append(meta);

    const input = el('input', 'omnifile-font-input');
    input.type = 'text';
    input.value = DEFAULT_SAMPLE;
    input.setAttribute('aria-label', 'Sample text');
    wrapper.append(input);

    const samples: HTMLElement[] = [];
    for (const size of SIZES) {
      const row = el('div', 'omnifile-font-row');
      const sample = el('div', 'omnifile-font-sample', DEFAULT_SAMPLE);
      sample.style.fontFamily = stack;
      sample.style.fontSize = `${size}px`;
      samples.push(sample);
      row.append(el('span', 'omnifile-font-size', `${size}px`), sample);
      wrapper.append(row);
    }
    input.addEventListener('input', () => {
      const text = input.value || DEFAULT_SAMPLE;
      for (const sample of samples) sample.textContent = text;
    });

    const glyphs = el('div', 'omnifile-font-glyphs', GLYPHS);
    glyphs.style.fontFamily = stack;
    wrapper.append(glyphs);

    container.append(wrapper);
    return {
      destroy() {
        wrapper.remove();
        doc.fonts.delete(face);
      },
    };
  },
};
