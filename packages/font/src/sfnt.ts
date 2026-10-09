export interface FontInfo {
  /** Full name, such as "Inter Bold". */
  name?: string;
  family?: string;
  style?: string;
  version?: string;
  glyphs?: number;
}

/**
 * Read names and the glyph count from a TrueType or OpenType file. WOFF and
 * WOFF2 compress these tables, so they return an empty object.
 */
export function readFontInfo(bytes: Uint8Array): FontInfo {
  if (bytes.length < 12) return {};
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = String.fromCharCode(...bytes.subarray(0, 4));
  if (tag !== 'OTTO' && tag !== 'true' && view.getUint32(0) !== 0x00010000) return {};

  const info: FontInfo = {};
  const tables = new Map<string, { offset: number; length: number }>();
  const tableCount = view.getUint16(4);
  for (let index = 0; index < tableCount; index++) {
    const record = 12 + index * 16;
    if (record + 16 > bytes.length) break;
    tables.set(String.fromCharCode(...bytes.subarray(record, record + 4)), {
      offset: view.getUint32(record + 8),
      length: view.getUint32(record + 12),
    });
  }

  const maxp = tables.get('maxp');
  if (maxp && maxp.offset + 6 <= bytes.length) info.glyphs = view.getUint16(maxp.offset + 4);

  const name = tables.get('name');
  if (name && name.offset + 6 <= bytes.length) {
    const count = view.getUint16(name.offset + 2);
    const strings = name.offset + view.getUint16(name.offset + 4);
    const found = new Map<number, string>();
    for (let index = 0; index < count; index++) {
      const record = name.offset + 6 + index * 12;
      if (record + 12 > bytes.length) break;
      const platform = view.getUint16(record);
      const language = view.getUint16(record + 4);
      const id = view.getUint16(record + 6);
      const length = view.getUint16(record + 8);
      const start = strings + view.getUint16(record + 10);
      if (start + length > bytes.length || ![1, 2, 4, 5].includes(id)) continue;
      const raw = bytes.subarray(start, start + length);
      // Windows (3) and Unicode (0) names are UTF-16BE; Macintosh (1) is
      // close enough to Latin-1 for the ASCII names fonts carry.
      const unicode = platform === 3 || platform === 0;
      const english = platform === 3 ? language === 0x409 : true;
      if (found.has(id) && !(unicode && english)) continue;
      found.set(id, new TextDecoder(unicode ? 'utf-16be' : 'latin1').decode(raw));
    }
    info.family = found.get(1);
    info.style = found.get(2);
    info.name = found.get(4);
    info.version = found.get(5);
  }
  return info;
}
