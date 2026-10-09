import type { LoadedFile } from './types';

/** Decode text bytes, honouring a byte-order mark and falling back from UTF-8. */
export function decodeText(bytes: Uint8Array): { text: string; encoding: string } {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return decode(bytes, 'utf-16le');
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return decode(bytes, 'utf-16be');
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    // Not valid UTF-8: Windows-1252 maps every byte, so nothing is lost.
    return decode(bytes, 'windows-1252');
  }
}

const decode = (bytes: Uint8Array, encoding: string) => ({
  text: new TextDecoder(encoding).decode(bytes),
  encoding,
});

/** Add a plugin's stylesheet to the document once. */
export function ensureStyle(doc: Document, id: string, css: string): void {
  if (doc.getElementById(id)) return;
  const style = doc.createElement('style');
  style.id = id;
  style.textContent = css;
  doc.head.appendChild(style);
}

/** The file's bytes as a Blob of its detected type. */
export function toBlob(file: LoadedFile): Blob {
  return new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.format.mime });
}
