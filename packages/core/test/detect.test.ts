import { describe, expect, it } from 'vitest';
import { detectFormat, findPlugin, formatSize, getFormat, type AnyPlugin } from '@omnifile/core';

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(values.flatMap((v) => (typeof v === 'string' ? [...new TextEncoder().encode(v)] : [v])));
const id = (input: Parameters<typeof detectFormat>[0]) => detectFormat(input).id;

describe('detectFormat', () => {
  it('trusts magic bytes over a wrong extension and MIME type', () => {
    const png = bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
    expect(id({ bytes: png, name: 'report.pdf', mimeType: 'application/pdf' })).toBe('png');
  });

  it('recognises common signatures', () => {
    expect(id({ bytes: bytes('%PDF-1.7\n') })).toBe('pdf');
    expect(id({ bytes: bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0) })).toBe('jpeg');
    expect(id({ bytes: bytes('GIF89a', 0, 0) })).toBe('gif');
    expect(id({ bytes: bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 ') })).toBe('webp');
    expect(id({ bytes: bytes('RIFF', 0, 0, 0, 0, 'WAVEfmt ') })).toBe('wav');
    expect(id({ bytes: bytes(0, 0, 0, 0x20, 'ftypisom', 0, 0, 0, 0) })).toBe('mp4');
    expect(id({ bytes: bytes(0, 0, 0, 0x20, 'ftypavif', 0, 0, 0, 0) })).toBe('avif');
    expect(id({ bytes: bytes('ID3', 3, 0, 0, 0, 0, 0, 0) })).toBe('mp3');
    expect(id({ bytes: bytes('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>') })).toBe('svg');
  });

  /** A minimal ZIP: stored entries plus the central directory. */
  const zip = (entries: [name: string, content: string][]) => {
    const encode = (text: string) => [...new TextEncoder().encode(text)];
    const u16 = (n: number) => [n & 0xff, n >> 8];
    const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
    const local: number[] = [];
    const central: number[] = [];
    for (const [name, content] of entries) {
      const offset = local.length;
      const data = encode(content);
      const sizes = [...u32(0), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
      local.push(0x50, 0x4b, 3, 4, ...u16(20), ...u16(0), ...u16(0), ...u32(0), ...sizes, ...encode(name), ...data);
      central.push(0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u32(0), ...sizes,
        ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...encode(name));
    }
    const end = [0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
      ...u32(central.length), ...u32(local.length), ...u16(0)];
    return new Uint8Array([...local, ...central, ...end]);
  };

  it('tells OOXML files apart by their ZIP entries', () => {
    expect(id({ bytes: zip([['[Content_Types].xml', ''], ['word/document.xml', '<w/>']]) })).toBe('docx');
    expect(id({ bytes: zip([['xl/workbook.xml', '<x/>']]) })).toBe('xlsx');
    expect(id({ bytes: zip([['ppt/presentation.xml', '<p/>']]) })).toBe('pptx');
    expect(id({ bytes: zip([['notes/readme.txt', 'hi']]), name: 'archive.zip' })).toBe('zip');
  });

  it('is not fooled by a workbook embedded in a presentation', () => {
    const deck = zip([
      ['ppt/presentation.xml', '<p/>'],
      ['ppt/embeddings/chart.xlsx', 'PK.. xl/workbook.xml ..'],
    ]);
    expect(id({ bytes: deck, name: 'deck.pptx' })).toBe('pptx');
  });

  it('recognises OpenDocument, EPUB, fonts and other archives', () => {
    const zipWithMime = (mime: string) => zip([['mimetype', mime]]);
    expect(id({ bytes: zipWithMime('application/vnd.oasis.opendocument.spreadsheet') })).toBe('ods');
    expect(id({ bytes: zipWithMime('application/vnd.oasis.opendocument.text') })).toBe('odt');
    expect(id({ bytes: zipWithMime('application/epub+zip') })).toBe('epub');
    expect(id({ bytes: bytes('OTTO', 0, 9, 0, 0, 0, 0, 0, 0) })).toBe('otf');
    expect(id({ bytes: bytes('wOF2', 0, 1, 0, 0, 0, 0, 0, 0) })).toBe('woff2');
    expect(id({ bytes: bytes(0, 1, 0, 0, 0, 12, 0, 0x80, 0, 3, 0, 0x40) })).toBe('ttf');
    expect(id({ bytes: bytes(0x1f, 0x8b, 8, 0, 0, 0, 0, 0) })).toBe('gzip');
    expect(id({ bytes: bytes('{\\rtf1\\ansi hello}') })).toBe('rtf');
    expect(id({ bytes: bytes('From: a@example.com\nSubject: hi\n\nbody'), name: 'note.eml' })).toBe('eml');
  });

  it('uses the label to tell legacy Office files apart', () => {
    const ole = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0);
    expect(id({ bytes: ole, name: 'old.doc' })).toBe('doc');
    expect(id({ bytes: ole, mimeType: 'application/vnd.ms-excel' })).toBe('xls');
    expect(id({ bytes: ole })).toBe('binary');
  });

  it('falls back to MIME type, then extension, for text formats', () => {
    const text = bytes('{"a": 1}');
    expect(id({ bytes: text, mimeType: 'application/json; charset=utf-8' })).toBe('json');
    expect(id({ bytes: text, name: 'data.json' })).toBe('json');
    expect(id({ bytes: bytes('# Title'), name: 'README.md', mimeType: 'text/plain' })).toBe('markdown');
    expect(id({ bytes: bytes('a,b\n1,2'), name: 'x.csv', mimeType: 'application/octet-stream' })).toBe('csv');
    expect(id({ bytes: bytes('FROM node:22'), name: 'Dockerfile' })).toBe('code');
  });

  it('does not believe a binary label without the signature', () => {
    expect(id({ bytes: bytes('just some words'), name: 'fake.pdf' })).toBe('text');
    expect(id({ bytes: bytes(1, 2, 0, 0, 5, 6, 0, 9), name: 'fake.png' })).toBe('binary');
  });

  it('classifies unlabelled content as text or binary', () => {
    expect(id({ bytes: bytes('hello\nworld\n') })).toBe('text');
    expect(id({ bytes: bytes('שלום עולם') })).toBe('text');
    expect(id({ bytes: bytes(0xff, 0xfe, 'h', 0, 'i', 0) })).toBe('text');
    expect(id({ bytes: bytes(0, 1, 2, 3, 0, 0, 7, 8) })).toBe('binary');
    expect(id({ bytes: new Uint8Array(0) })).toBe('text');
  });
});

describe('findPlugin', () => {
  const plugin = (pluginId: string, formats: string[]): AnyPlugin => ({
    id: pluginId,
    formats,
    load: () => Promise.reject(new Error('not loaded in tests')),
  });

  it('returns undefined when nothing handles the format', () => {
    expect(findPlugin([plugin('a', ['png'])], getFormat('pdf'))).toBeUndefined();
  });

  it('uses a wildcard plugin only when nothing names the format', () => {
    const plugins = [plugin('pdf', ['pdf']), plugin('hex', ['*'])];
    expect(findPlugin(plugins, getFormat('pdf'))?.id).toBe('pdf');
    expect(findPlugin(plugins, getFormat('binary'))?.id).toBe('hex');
    expect(findPlugin([plugin('hex', ['*']), plugin('pdf', ['pdf'])], getFormat('pdf'))?.id).toBe('pdf');
  });

  it('lets a later plugin override an earlier one', () => {
    const plugins = [plugin('builtin', ['pdf', 'png']), plugin('custom', ['pdf'])];
    expect(findPlugin(plugins, getFormat('pdf'))?.id).toBe('custom');
    expect(findPlugin(plugins, getFormat('png'))?.id).toBe('builtin');
  });
});

describe('formatSize', () => {
  it('formats byte counts', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(250 * 1024 * 1024)).toBe('250 MB');
  });
});
