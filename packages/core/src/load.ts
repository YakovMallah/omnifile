import { detectFormat } from './detect';
import type { LoadedFile, OmniSource } from './types';

export interface LoadOptions {
  /** Overrides the name taken from the source. */
  name?: string;
  /** Overrides the MIME type taken from the source. */
  mimeType?: string;
  signal?: AbortSignal;
  /** Passed to `fetch` for URL sources, for example to send credentials. */
  fetchInit?: RequestInit;
}

/** Read any supported source into memory and identify its format. */
export async function loadSource(source: OmniSource, options: LoadOptions = {}): Promise<LoadedFile> {
  let bytes: Uint8Array;
  let name: string | undefined;
  let mimeType: string | undefined;
  let url: string | undefined;

  if (typeof source === 'string' || source instanceof URL) {
    url = String(source);
    const response = await fetch(url, { ...options.fetchInit, signal: options.signal });
    if (!response.ok) {
      const status = [response.status, response.statusText].filter(Boolean).join(' ');
      throw new Error(`Could not load the file (HTTP ${status}).`);
    }
    bytes = new Uint8Array(await response.arrayBuffer());
    mimeType = response.headers.get('content-type') ?? undefined;
    name = nameFromDisposition(response.headers.get('content-disposition')) ?? nameFromUrl(url);
  } else if (source instanceof Blob) {
    bytes = new Uint8Array(await source.arrayBuffer());
    mimeType = source.type || undefined;
    name = 'name' in source && typeof source.name === 'string' ? source.name : undefined;
  } else if (source instanceof ArrayBuffer) {
    bytes = new Uint8Array(source);
  } else if (ArrayBuffer.isView(source)) {
    bytes = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  } else {
    throw new TypeError('omnifile: source must be a URL, File, Blob, ArrayBuffer or Uint8Array.');
  }

  options.signal?.throwIfAborted();
  name = options.name ?? name;
  mimeType = options.mimeType ?? mimeType;
  const format = detectFormat({ bytes, name, mimeType });

  return {
    name: name ?? `file${format.extensions[0] ? `.${format.extensions[0]}` : ''}`,
    bytes,
    size: bytes.byteLength,
    format,
    declaredMimeType: mimeType,
    url,
  };
}

function nameFromUrl(url: string): string | undefined {
  if (url.startsWith('blob:') || url.startsWith('data:')) return undefined;
  try {
    const path = new URL(url, 'http://localhost').pathname;
    const last = path.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : undefined;
  } catch {
    return undefined;
  }
}

function nameFromDisposition(header: string | null): string | undefined {
  if (!header) return undefined;
  const extended = /filename\*\s*=\s*[\w-]+''([^;]+)/i.exec(header);
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1].trim());
    } catch {
      /* fall through to the plain form */
    }
  }
  const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(header);
  const value = plain?.[2] ?? plain?.[1];
  return value?.trim() || undefined;
}
