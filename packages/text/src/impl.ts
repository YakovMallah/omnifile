import type { PluginImplementation } from '@omnifile/core';
import { decodeText } from './decode';

export interface TextModel {
  text: string;
  encoding: string;
  /** Format id, for a future syntax highlighter. */
  language: string;
}

/** Beyond this the DOM gets slow; virtualized rendering is planned. */
const MAX_RENDERED_CHARS = 2_000_000;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

export const implementation: PluginImplementation<TextModel> = {
  parse(file) {
    return { ...decodeText(file.bytes), language: file.format.id };
  },

  render(model, { container }) {
    const doc = container.ownerDocument;
    const truncated = model.text.length > MAX_RENDERED_CHARS;
    const shown = truncated ? model.text.slice(0, MAX_RENDERED_CHARS) : model.text;
    const lineCount = shown.length === 0 ? 1 : shown.split('\n').length;

    const wrapper = doc.createElement('div');
    wrapper.style.cssText =
      'min-height:100%;background:var(--omnifile-surface);font-family:var(--omnifile-mono);line-height:1.5;';
    const grid = doc.createElement('div');
    grid.style.cssText = 'display:flex;align-items:flex-start;min-width:max-content;';

    const gutter = doc.createElement('pre');
    gutter.setAttribute('aria-hidden', 'true');
    gutter.style.cssText =
      'margin:0;padding:12px 10px 12px 14px;text-align:right;user-select:none;font:inherit;' +
      'color:var(--omnifile-muted);border-right:1px solid var(--omnifile-border);' +
      'position:sticky;left:0;background:var(--omnifile-surface);';
    let numbers = '';
    for (let line = 1; line <= lineCount; line++) numbers += line === 1 ? '1' : `\n${line}`;
    gutter.textContent = numbers;

    const code = doc.createElement('pre');
    code.tabIndex = 0;
    code.style.cssText = 'margin:0;padding:12px 16px;font:inherit;tab-size:4;white-space:pre;';
    // textContent, never innerHTML: file contents are shown, not interpreted.
    code.textContent = shown;

    grid.append(gutter, code);
    wrapper.append(grid);

    if (truncated) {
      const notice = doc.createElement('div');
      notice.style.cssText =
        'padding:10px 16px;font-family:var(--omnifile-font);color:var(--omnifile-muted);' +
        'border-top:1px solid var(--omnifile-border);';
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
