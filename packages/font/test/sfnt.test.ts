import { describe, expect, it } from 'vitest';
import { readFontInfo } from '../src/sfnt';

/** Build a minimal TrueType file with a name table and a maxp table. */
function font(names: [id: number, text: string][], glyphs: number): Uint8Array {
  const strings = names.map(([, text]) => {
    const out: number[] = [];
    for (const char of text) out.push(0, char.charCodeAt(0));
    return out;
  });
  const records: number[] = [];
  let offset = 0;
  names.forEach(([id], index) => {
    const length = strings[index]!.length;
    records.push(0, 3, 0, 1, 0x04, 0x09, 0, id, length >> 8, length & 0xff, offset >> 8, offset & 0xff);
    offset += length;
  });
  const stringOffset = 6 + records.length;
  const name = [0, 0, 0, names.length, stringOffset >> 8, stringOffset & 0xff, ...records, ...strings.flat()];
  const maxp = [0, 1, 0, 0, glyphs >> 8, glyphs & 0xff];
  const header = [0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0];
  const nameOffset = 12 + 32;
  const maxpOffset = nameOffset + name.length;
  const u32 = (n: number) => [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  const tag = (text: string) => [...text].map((char) => char.charCodeAt(0));
  return new Uint8Array([
    ...header,
    ...tag('name'), ...u32(0), ...u32(nameOffset), ...u32(name.length),
    ...tag('maxp'), ...u32(0), ...u32(maxpOffset), ...u32(maxp.length),
    ...name,
    ...maxp,
  ]);
}

describe('readFontInfo', () => {
  it('reads names and the glyph count', () => {
    const info = readFontInfo(font([[1, 'Example Sans'], [2, 'Bold'], [4, 'Example Sans Bold']], 812));
    expect(info).toMatchObject({ family: 'Example Sans', style: 'Bold', name: 'Example Sans Bold', glyphs: 812 });
  });

  it('returns nothing for compressed or foreign data instead of throwing', () => {
    expect(readFontInfo(new TextEncoder().encode('wOF2 compressed data here'))).toEqual({});
    expect(readFontInfo(new Uint8Array(4))).toEqual({});
  });
});
