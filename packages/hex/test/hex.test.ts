import { describe, expect, it } from 'vitest';
import { formatRow } from '../src/impl';

describe('formatRow', () => {
  const bytes = new Uint8Array([...new TextEncoder().encode('Hello, omnifile!'), 0x00, 0xff, 0x41]);

  it('shows offset, hex and printable characters', () => {
    expect(formatRow(bytes, 0)).toBe('00000000  48 65 6c 6c 6f 2c 20 6f  6d 6e 69 66 69 6c 65 21  Hello, omnifile!');
  });

  it('pads a short last row so the text column stays aligned', () => {
    const row = formatRow(bytes, 1);
    expect(row.startsWith('00000010  00 ff 41 ')).toBe(true);
    expect(row.endsWith(' ..A')).toBe(true);
    expect(row.length - 3).toBe(formatRow(bytes, 0).length - 16);
  });
});
