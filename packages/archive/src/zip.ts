export interface ArchiveEntry {
  name: string;
  directory: boolean;
  size: number;
  compressedSize: number;
  modified: Date | undefined;
  encrypted: boolean;
}

export interface ArchiveModel {
  entries: ArchiveEntry[];
}

const EOCD = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_EOCD = 0x06064b50;
const CENTRAL_HEADER = 0x02014b50;

/**
 * Read a ZIP's central directory: the index at the end of the file that
 * lists every entry. Nothing is decompressed.
 */
export function readZipDirectory(bytes: Uint8Array): ArchiveEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u64 = (offset: number) => Number(view.getBigUint64(offset, true));

  // The end-of-central-directory record sits at the end, before an optional
  // comment of up to 65535 bytes.
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 22 - 0xffff); offset--) {
    if (view.getUint32(offset, true) === EOCD) {
      eocd = offset;
      break;
    }
  }
  if (eocd === -1) throw new Error('This ZIP archive is damaged: its directory is missing.');

  let count = view.getUint16(eocd + 10, true);
  let position = view.getUint32(eocd + 16, true);
  if (eocd >= 20 && view.getUint32(eocd - 20, true) === ZIP64_LOCATOR) {
    const record = u64(eocd - 20 + 8);
    if (record + 56 <= bytes.length && view.getUint32(record, true) === ZIP64_EOCD) {
      count = u64(record + 32);
      position = u64(record + 48);
    }
  }

  const utf8 = new TextDecoder('utf-8');
  const legacy = new TextDecoder('latin1');
  const entries: ArchiveEntry[] = [];
  for (let index = 0; index < count; index++) {
    if (position + 46 > bytes.length || view.getUint32(position, true) !== CENTRAL_HEADER) break;
    const flags = view.getUint16(position + 8, true);
    const time = view.getUint16(position + 12, true);
    const date = view.getUint16(position + 14, true);
    let compressedSize = view.getUint32(position + 20, true);
    let size = view.getUint32(position + 24, true);
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    const nameBytes = bytes.subarray(position + 46, position + 46 + nameLength);
    const name = (flags & 0x800 ? utf8 : legacy).decode(nameBytes);

    // ZIP64 keeps real sizes in an extra field when the 32-bit ones overflow.
    let extra = position + 46 + nameLength;
    const extraEnd = extra + extraLength;
    while (extra + 4 <= extraEnd) {
      const id = view.getUint16(extra, true);
      const length = view.getUint16(extra + 2, true);
      if (id === 0x0001) {
        let field = extra + 4;
        if (size === 0xffffffff && field + 8 <= extraEnd) {
          size = u64(field);
          field += 8;
        }
        if (compressedSize === 0xffffffff && field + 8 <= extraEnd) compressedSize = u64(field);
      }
      extra += 4 + length;
    }

    const modified =
      date === 0
        ? undefined
        : new Date(
            1980 + (date >> 9),
            ((date >> 5) & 0xf) - 1,
            date & 0x1f,
            time >> 11,
            (time >> 5) & 0x3f,
            (time & 0x1f) * 2,
          );
    entries.push({
      name,
      directory: name.endsWith('/'),
      size,
      compressedSize,
      modified,
      encrypted: (flags & 1) === 1,
    });
    position = extraEnd + commentLength;
  }
  return entries;
}
