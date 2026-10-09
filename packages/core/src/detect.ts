import { formatFromExtension, formatFromMime, getFormat, type FormatInfo } from './formats';

export interface DetectInput {
  bytes: Uint8Array;
  name?: string;
  mimeType?: string;
}

/**
 * Identify a file. Content wins over labels: magic bytes first, then the
 * declared MIME type, then the file extension. A file with no recognisable
 * signature falls back to plain text or `binary` by inspecting its bytes.
 */
export function detectFormat(input: DetectInput): FormatInfo {
  const { bytes, name, mimeType } = input;
  const fromExtension = formatFromExtension(name);
  const fromMime = formatFromMime(mimeType);

  const magic = sniffMagic(bytes);
  if (magic) return refineContainer(magic, bytes, fromMime ?? fromExtension);

  // text/plain and octet-stream are what servers send when they do not know,
  // so a recognised extension is more trustworthy than either.
  const mimeIsWeak = !fromMime || fromMime.id === 'text' || fromMime.id === 'binary';
  const labelled = mimeIsWeak ? (fromExtension ?? fromMime) : fromMime;

  const textual = looksLikeText(bytes);
  if (labelled && labelled.id !== 'binary') {
    // A label claiming a binary format with no matching signature is wrong.
    if (labelled.category === 'text') return textual ? labelled : getFormat('binary');
    if (!SIGNATURE_REQUIRED.has(labelled.id)) return labelled;
  }
  return getFormat(textual ? 'text' : 'binary');
}

/** Formats whose signature we check, so a label alone is not believed. */
const SIGNATURE_REQUIRED = new Set([
  'pdf', 'png', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'heic', 'tiff', 'mp4', 'mov',
  'webm', 'mkv', 'wav', 'ogg', 'ogv', 'flac', 'm4a', 'zip', 'docx', 'xlsx', 'pptx', 'doc',
  'xls', 'ppt',
]);

type Sniffed = 'zip' | 'ole' | 'ogg' | 'matroska' | 'iso-video' | string;

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + length));

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  bytes.length >= offset + signature.length &&
  signature.every((value, index) => bytes[offset + index] === value);

function sniffMagic(bytes: Uint8Array): Sniffed | undefined {
  if (bytes.length < 4) return undefined;

  // The PDF header may be preceded by junk, within the first 1024 bytes.
  const head = ascii(bytes, 0, Math.min(bytes.length, 1024));
  if (head.includes('%PDF-')) return 'pdf';

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (head.startsWith('GIF87a') || head.startsWith('GIF89a')) return 'gif';
  if (head.startsWith('RIFF') && bytes.length >= 12) {
    const kind = ascii(bytes, 8, 4);
    if (kind === 'WEBP') return 'webp';
    if (kind === 'WAVE') return 'wav';
  }
  if (head.startsWith('BM') && startsWith(bytes, [0, 0, 0, 0], 6)) return 'bmp';
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) return 'tiff';
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00]) && bytes.length >= 6 && bytes[4]! > 0 && bytes[5] === 0) return 'ico';

  // ISO base media: [size][ftyp][brand].
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4).toLowerCase();
    if (brand === 'avif' || brand === 'avis') return 'avif';
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'heic';
    if (brand.startsWith('qt')) return 'mov';
    if (brand.startsWith('m4a') || brand.startsWith('m4b')) return 'm4a';
    return 'mp4';
  }

  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'matroska';
  if (head.startsWith('OggS')) return 'ogg';
  if (head.startsWith('fLaC')) return 'flac';
  if (head.startsWith('ID3')) return 'mp3';
  // MP3s without an ID3 tag start with a bare frame sync, which is too short
  // to trust (a UTF-16 byte-order mark matches it), so those rely on the label.

  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) return 'zip';
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'ole';

  const trimmed = head.replace(/^﻿/, '').trimStart();
  if (/^<svg[\s>]/i.test(trimmed)) return 'svg';
  if (/^<\?xml/i.test(trimmed) || /^<!DOCTYPE svg/i.test(trimmed)) {
    const more = ascii(bytes, 0, Math.min(bytes.length, 4096));
    if (/<svg[\s>]/i.test(more)) return 'svg';
  }
  return undefined;
}

/** Several formats share one container signature; tell them apart. */
function refineContainer(sniffed: Sniffed, bytes: Uint8Array, hint: FormatInfo | undefined): FormatInfo {
  switch (sniffed) {
    case 'zip':
      return getFormat(sniffOoxml(bytes) ?? (hint && ['docx', 'xlsx', 'pptx'].includes(hint.id) ? hint.id : 'zip'));
    case 'ole':
      // Legacy Office files are all OLE compound documents; only the label
      // distinguishes them without parsing the directory.
      return hint && ['doc', 'xls', 'ppt'].includes(hint.id) ? hint : getFormat('binary');
    case 'matroska':
      return getFormat(hint?.id === 'mkv' ? 'mkv' : 'webm');
    case 'ogg':
      return getFormat(hint?.id === 'ogv' || hint?.category === 'video' ? 'ogv' : 'ogg');
    default:
      return getFormat(sniffed);
  }
}

/** OOXML files are ZIPs whose entry names reveal the application. */
function sniffOoxml(bytes: Uint8Array): 'docx' | 'xlsx' | 'pptx' | undefined {
  const window = 64 * 1024;
  const chunks =
    bytes.length <= window * 2
      ? [bytes]
      : [bytes.subarray(0, window), bytes.subarray(bytes.length - window)];
  for (const chunk of chunks) {
    const text = new TextDecoder('latin1').decode(chunk);
    if (text.includes('word/document')) return 'docx';
    if (text.includes('xl/workbook')) return 'xlsx';
    if (text.includes('ppt/presentation')) return 'pptx';
  }
  return undefined;
}

/** True when the leading bytes decode as text rather than binary data. */
export function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return true;
  // UTF-16 with a byte-order mark is text even though it is full of NULs.
  if (startsWith(bytes, [0xff, 0xfe]) || startsWith(bytes, [0xfe, 0xff])) return true;
  const sample = bytes.subarray(0, 8192);
  let control = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20 && byte !== 0x1b)) control++;
  }
  // With no NULs and few control bytes this is UTF-8 or a legacy single-byte
  // encoding; either way it is readable as text.
  return control / sample.length <= 0.05;
}
