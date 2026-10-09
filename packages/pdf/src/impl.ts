import type { PluginImplementation } from '@omnifile/core';
// The legacy build carries the polyfills pdf.js needs outside the very newest
// browsers; the modern build fails in any browser a few releases old.
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface PdfOptions {
  /**
   * URL of pdf.js's worker script. Use the legacy build to match this plugin:
   * `pdfjs-dist/legacy/build/pdf.worker.min.mjs`.
   * When omitted, and no worker was configured on pdf.js globally, parsing
   * runs on the main thread.
   */
  workerSrc?: string;
}

export interface PdfModel {
  document: PDFDocumentProxy;
  loadingTask: PDFDocumentLoadingTask;
}

/** pdf.js scale 1 is 72 dpi; CSS pixels are 96 dpi. */
const CSS_UNITS = 96 / 72;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const PAGE_GAP = 12;

async function configureWorker(options: PdfOptions): Promise<void> {
  if (options.workerSrc) {
    GlobalWorkerOptions.workerSrc = options.workerSrc;
    return;
  }
  const scope = globalThis as { pdfjsWorker?: unknown };
  if (GlobalWorkerOptions.workerSrc || GlobalWorkerOptions.workerPort || scope.pdfjsWorker) return;
  // pdf.js runs its "worker" on the main thread when the worker module is
  // already loaded, which needs no bundler configuration from the host app.
  // @ts-ignore -- pdf.js ships no type declarations for its worker build.
  scope.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
}

export function createImplementation(options: PdfOptions): PluginImplementation<PdfModel> {
  return {
    async parse(file, { signal }) {
      await configureWorker(options);
      // pdf.js takes ownership of the buffer it is given, so hand it a copy
      // and keep the original bytes intact.
      const loadingTask = getDocument({ data: file.bytes.slice() });
      const cancel = () => void loadingTask.destroy();
      signal.addEventListener('abort', cancel, { once: true });
      try {
        const document = await loadingTask.promise;
        return { document, loadingTask };
      } catch (cause) {
        const name = cause instanceof Error ? cause.name : '';
        if (name === 'PasswordException') {
          throw new Error('This PDF is password-protected, which is not supported yet.');
        }
        if (name === 'InvalidPDFException') throw new Error('This PDF is damaged and cannot be read.');
        throw cause;
      } finally {
        signal.removeEventListener('abort', cancel);
      }
    },

    async render(model, { container }) {
      const doc = container.ownerDocument;
      const view = doc.defaultView ?? window;
      const pdf = model.document;

      const pagesEl = doc.createElement('div');
      pagesEl.style.cssText =
        `display:flex;flex-direction:column;align-items:center;gap:${PAGE_GAP}px;` +
        `padding:${PAGE_GAP}px;min-width:max-content;box-sizing:border-box;`;
      container.append(pagesEl);

      // Page 1 sizes every placeholder until each page is actually loaded.
      const first = await pdf.getPage(1);
      const base = first.getViewport({ scale: 1 });
      const available = container.clientWidth - PAGE_GAP * 2;
      const fitWidth = available > 0 ? available / (base.width * CSS_UNITS) : 1;
      let zoom = Math.min(Math.max(Math.min(fitWidth, 1.5), MIN_ZOOM), MAX_ZOOM);

      interface PageSlot {
        number: number;
        element: HTMLDivElement;
        /** Unscaled size in PDF points. */
        width: number;
        height: number;
        renderedZoom: number | undefined;
        task: RenderTask | undefined;
      }

      const slots: PageSlot[] = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        const element = doc.createElement('div');
        element.dataset.page = String(number);
        element.setAttribute('role', 'img');
        element.setAttribute('aria-label', `Page ${number} of ${pdf.numPages}`);
        element.style.cssText =
          'background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);flex:none;overflow:hidden;';
        slots.push({ number, element, width: base.width, height: base.height, renderedZoom: undefined, task: undefined });
        pagesEl.append(element);
      }
      const slotByElement = new Map(slots.map((slot) => [slot.element, slot] as const));

      const sizeSlot = (slot: PageSlot) => {
        slot.element.style.width = `${slot.width * CSS_UNITS * zoom}px`;
        slot.element.style.height = `${slot.height * CSS_UNITS * zoom}px`;
      };
      slots.forEach(sizeSlot);

      let destroyed = false;
      const visible = new Set<PageSlot>();

      const renderSlot = async (slot: PageSlot) => {
        if (destroyed || slot.renderedZoom === zoom) return;
        const targetZoom = zoom;
        slot.task?.cancel();
        slot.renderedZoom = targetZoom;

        const page = await pdf.getPage(slot.number);
        if (destroyed || zoom !== targetZoom) return;
        const unscaled = page.getViewport({ scale: 1 });
        slot.width = unscaled.width;
        slot.height = unscaled.height;
        sizeSlot(slot);

        const viewport = page.getViewport({ scale: CSS_UNITS * targetZoom });
        const ratio = view.devicePixelRatio || 1;
        const canvas = doc.createElement('canvas');
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.cssText = 'display:block;width:100%;height:100%;';

        const task = page.render({
          canvas,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        slot.task = task;
        try {
          await task.promise;
        } catch (cause) {
          if (cause instanceof Error && cause.name === 'RenderingCancelledException') return;
          throw cause;
        } finally {
          if (slot.task === task) slot.task = undefined;
        }
        if (destroyed || zoom !== targetZoom) return;
        slot.element.replaceChildren(canvas);
      };

      const showPageError = (slot: PageSlot, cause: unknown) => {
        if (destroyed) return;
        console.error(`omnifile: could not render PDF page ${slot.number}`, cause);
        const message = doc.createElement('div');
        message.style.cssText =
          'height:100%;display:flex;align-items:center;justify-content:center;padding:16px;' +
          'text-align:center;color:#57606a;font:14px system-ui,sans-serif;';
        message.textContent = `Page ${slot.number} could not be displayed.`;
        slot.element.replaceChildren(message);
      };

      const renderVisible = () => {
        for (const slot of visible) renderSlot(slot).catch((cause) => showPageError(slot, cause));
      };

      // Only pages near the viewport are rendered, so a long document costs
      // little until it is scrolled.
      const observer = new view.IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const slot = slotByElement.get(entry.target as HTMLDivElement);
            if (!slot) continue;
            if (entry.isIntersecting) visible.add(slot);
            else {
              visible.delete(slot);
              // Free the bitmap of pages far from view.
              if (!slot.task) {
                slot.element.replaceChildren();
                slot.renderedZoom = undefined;
              }
            }
          }
          renderVisible();
        },
        { root: container, rootMargin: '150% 0px' },
      );
      slots.forEach((slot) => observer.observe(slot.element));

      return {
        destroy() {
          destroyed = true;
          observer.disconnect();
          for (const slot of slots) slot.task?.cancel();
          pagesEl.remove();
          void model.loadingTask.destroy();
        },
        zoom: {
          min: MIN_ZOOM,
          max: MAX_ZOOM,
          get: () => zoom,
          set(value) {
            if (value === zoom) return;
            // Keep the same spot in the document under the top of the view.
            const anchor = container.scrollHeight > 0 ? container.scrollTop / container.scrollHeight : 0;
            zoom = value;
            slots.forEach(sizeSlot);
            container.scrollTop = anchor * container.scrollHeight;
            renderVisible();
          },
        },
      };
    },

    dispose(model) {
      void model.loadingTask.destroy();
    },
  };
}
