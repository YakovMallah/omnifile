import type { LoadedFile } from '@omnifile/react';

export interface Explanation {
  /** Range of leading bytes that identified the file; length 0 when none did. */
  start: number;
  length: number;
  text: string;
}

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
};

/**
 * Describe, for the page, how the core recognised a file. The detection
 * itself happens in @omnifile/core; this only narrates the result.
 */
export function explain(file: LoadedFile): Explanation {
  const { format, bytes, name } = file;
  const extension = extensionOf(name);
  const mislabelled =
    extension !== '' && !format.extensions.includes(extension.slice(1))
      ? ` The name says ${extension}, and the bytes win.`
      : '';

  switch (format.id) {
    case 'pdf': {
      const head = String.fromCharCode(...bytes.subarray(0, 1024));
      const start = Math.max(0, head.indexOf('%PDF-'));
      return { start, length: 5, text: `These bytes spell %PDF-, so this is a PDF.${mislabelled}` };
    }
    case 'png':
      return { start: 0, length: 8, text: `Every PNG starts with these eight bytes.${mislabelled}` };
    case 'jpeg':
      return { start: 0, length: 3, text: `FF D8 FF opens every JPEG.${mislabelled}` };
    case 'gif':
      return { start: 0, length: 6, text: `These bytes spell GIF89a or GIF87a.${mislabelled}` };
    case 'webp':
    case 'wav':
      return { start: 0, length: 12, text: `A RIFF container whose type field says ${format.id === 'webp' ? 'WEBP' : 'WAVE'}.${mislabelled}` };
    case 'mp4':
    case 'mov':
    case 'm4a':
    case 'avif':
    case 'heic':
      return { start: 4, length: 8, text: `The ftyp box names the brand, which makes this ${format.label}.${mislabelled}` };
    case 'docx':
    case 'xlsx':
    case 'pptx': {
      const inside = { docx: 'word/document.xml', xlsx: 'xl/workbook.xml', pptx: 'ppt/presentation.xml' }[format.id];
      return { start: 0, length: 4, text: `PK marks a ZIP archive, and it contains ${inside}: a ${format.label}.` };
    }
    case 'zip':
      return { start: 0, length: 4, text: 'PK marks a ZIP archive, with no Office document inside.' };
    case 'svg':
      return { start: 0, length: 0, text: 'No binary signature here. The text opens with an <svg> tag, so it is an SVG image.' };
    case 'binary':
      return { start: 0, length: 0, text: 'Nothing recognisable in these bytes, so the file is offered as a download.' };
  }

  if (format.category === 'text') {
    const kind =
      format.id === 'text'
        ? 'It is shown as plain text.'
        : `The ${extension || 'declared type'} label says which kind: ${format.label}.`;
    return { start: 0, length: 0, text: `No signature and no NUL bytes, so this is text. ${kind}` };
  }
  return { start: 0, length: 4, text: `The opening bytes identify this as ${format.label}.${mislabelled}` };
}
