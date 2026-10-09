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

  it('tells OOXML files apart by their ZIP entries', () => {
    const zip = (entry: string) => bytes('PK', 3, 4, 20, 0, 0, 0, 8, 0, entry, 0, 0, 0);
    expect(id({ bytes: zip('word/document.xml') })).toBe('docx');
    expect(id({ bytes: zip('xl/workbook.xml') })).toBe('xlsx');
    expect(id({ bytes: zip('ppt/presentation.xml') })).toBe('pptx');
    expect(id({ bytes: zip('notes/readme.txt'), name: 'archive.zip' })).toBe('zip');
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
