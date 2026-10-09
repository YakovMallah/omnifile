import { definePlugin, type OmniPlugin } from '@omnifile/core';
import type { PdfModel, PdfOptions } from './impl';

export type { PdfModel, PdfOptions } from './impl';

/**
 * PDF files, rendered with pdf.js.
 *
 * Pass `workerSrc` to parse off the main thread (recommended). With Vite:
 *
 * ```ts
 * import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
 * pdf({ workerSrc });
 * ```
 *
 * Without it the plugin still works, parsing on the main thread.
 */
export function pdf(options: PdfOptions = {}): OmniPlugin<PdfModel> {
  return definePlugin({
    id: 'omnifile/pdf',
    formats: ['pdf'],
    load: () => import('./impl').then((module) => module.createImplementation(options)),
    frame: { url: () => new URL('./frame.js', import.meta.url).href, options: {} },
  });
}
