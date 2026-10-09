import type { PluginImplementation } from '@omnifile/core';

export interface HexModel {
  bytes: Uint8Array;
}

const BYTES_PER_ROW = 16;
const ROW_HEIGHT = 20;
/** Browsers cap element height; beyond this many rows the dump is cut. */
const MAX_ROWS = 1_000_000;
const OVERSCAN = 10;

const HEX = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, '0'));

export function formatRow(bytes: Uint8Array, row: number): string {
  const start = row * BYTES_PER_ROW;
  const end = Math.min(start + BYTES_PER_ROW, bytes.length);
  let hexPart = '';
  let textPart = '';
  for (let index = start; index < start + BYTES_PER_ROW; index++) {
    if (index < end) {
      const byte = bytes[index]!;
      hexPart += HEX[byte] + ' ';
      textPart += byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '.';
    } else {
      hexPart += '   ';
    }
    if (index - start === 7) hexPart += ' ';
  }
  return `${start.toString(16).padStart(8, '0')}  ${hexPart} ${textPart}`;
}

export const implementation: PluginImplementation<HexModel> = {
  parse: (file) => ({ bytes: file.bytes }),

  render(model, { container }) {
    const doc = container.ownerDocument;
    const view = doc.defaultView ?? window;
    const totalRows = Math.ceil(model.bytes.length / BYTES_PER_ROW);
    const rows = Math.min(totalRows, MAX_ROWS);

    const wrapper = doc.createElement('div');
    wrapper.style.cssText =
      'position:relative;min-width:max-content;background:var(--omnifile-surface);' +
      `height:${Math.max(rows, 1) * ROW_HEIGHT + 24 + (totalRows > rows ? 40 : 0)}px;`;
    const lines = doc.createElement('pre');
    lines.tabIndex = 0;
    lines.setAttribute('aria-label', 'Hex dump');
    lines.style.cssText =
      `position:absolute;left:0;margin:0;padding:0 16px;font:13px/${ROW_HEIGHT}px var(--omnifile-mono);` +
      'white-space:pre;color:var(--omnifile-text);';
    wrapper.append(lines);

    if (model.bytes.length === 0) {
      lines.textContent = 'This file is empty.';
      lines.style.top = '12px';
    }
    if (totalRows > rows) {
      const notice = doc.createElement('div');
      notice.style.cssText =
        'position:absolute;left:16px;bottom:10px;color:var(--omnifile-muted);font:13px var(--omnifile-font);';
      notice.textContent = `Only the first ${(rows * BYTES_PER_ROW).toLocaleString()} bytes are shown.`;
      wrapper.append(notice);
    }
    container.append(wrapper);

    // Only the rows in view exist in the DOM, so file size does not matter.
    let frame = 0;
    let drawnFirst = -1;
    let drawnLast = -1;
    const draw = () => {
      frame = 0;
      if (rows === 0) return;
      const first = Math.max(0, Math.floor(container.scrollTop / ROW_HEIGHT) - OVERSCAN);
      const last = Math.min(rows - 1, Math.ceil((container.scrollTop + container.clientHeight) / ROW_HEIGHT) + OVERSCAN);
      if (first === drawnFirst && last === drawnLast) return;
      drawnFirst = first;
      drawnLast = last;
      const text: string[] = [];
      for (let row = first; row <= last; row++) text.push(formatRow(model.bytes, row));
      lines.textContent = text.join('\n');
      lines.style.top = `${12 + first * ROW_HEIGHT}px`;
    };
    const schedule = () => {
      frame ||= view.requestAnimationFrame(draw);
    };
    container.addEventListener('scroll', schedule, { passive: true });
    const resize = new view.ResizeObserver(schedule);
    resize.observe(container);
    draw();

    return {
      destroy() {
        container.removeEventListener('scroll', schedule);
        resize.disconnect();
        if (frame) view.cancelAnimationFrame(frame);
        wrapper.remove();
      },
    };
  },
};
