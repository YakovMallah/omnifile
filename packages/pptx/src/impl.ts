import type { PluginImplementation } from '@omnifile/core';
import JSZip from 'jszip';
import { PPTXViewer } from 'pptxviewjs';

export interface PptxModel {
  viewer: PPTXViewer;
  slideCount: number;
  /** Slide size in CSS pixels at 100%. */
  width: number;
  height: number;
}

/** English Metric Units per CSS pixel (914400 per inch, 96 pixels per inch). */
const EMU_PER_PIXEL = 9525;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const GAP = 12;

/** The slide size lives in ppt/presentation.xml; default to 4:3 if absent. */
async function readSlideSize(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  try {
    const zip = await JSZip.loadAsync(bytes);
    const xml = (await zip.file('ppt/presentation.xml')?.async('string')) ?? '';
    const tag = /<(?:\w+:)?sldSz\b[^>]*>/.exec(xml)?.[0] ?? '';
    const cx = Number(/\bcx="(\d+)"/.exec(tag)?.[1]);
    const cy = Number(/\bcy="(\d+)"/.exec(tag)?.[1]);
    if (cx > 0 && cy > 0) return { width: cx / EMU_PER_PIXEL, height: cy / EMU_PER_PIXEL };
  } catch {
    /* fall through to the default */
  }
  return { width: 960, height: 720 };
}

export const implementation: PluginImplementation<PptxModel> = {
  async parse(file) {
    // PptxViewJS looks for JSZip on the global object, and otherwise fetches
    // it from a CDN. Hand it the bundled copy so nothing is downloaded.
    const scope = globalThis as { JSZip?: unknown };
    scope.JSZip ??= JSZip;

    const size = await readSlideSize(file.bytes);
    const viewer = new PPTXViewer({ slideSizeMode: 'fit', backgroundColor: '#ffffff' });
    try {
      // The viewer keeps the buffer, so give it a copy of the original bytes.
      await viewer.loadFile(file.bytes.slice());
    } catch {
      viewer.destroy();
      throw new Error('This presentation is damaged, or protected with a password.');
    }
    const slideCount = viewer.getSlideCount();
    if (slideCount === 0) {
      viewer.destroy();
      throw new Error('This presentation has no slides.');
    }
    return { viewer, slideCount, ...size };
  },

  render(model, { container }) {
    const doc = container.ownerDocument;
    const view = doc.defaultView ?? window;

    const slidesEl = doc.createElement('div');
    slidesEl.style.cssText =
      `display:flex;flex-direction:column;align-items:center;gap:${GAP}px;padding:${GAP}px;` +
      'min-width:max-content;box-sizing:border-box;';
    container.append(slidesEl);

    const available = container.clientWidth - GAP * 2;
    let zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, available > 0 ? Math.min(1, available / model.width) : 1));

    interface Slot {
      index: number;
      element: HTMLDivElement;
      renderedZoom: number | undefined;
    }
    const slots: Slot[] = [];
    for (let index = 0; index < model.slideCount; index++) {
      const element = doc.createElement('div');
      element.dataset.slide = String(index + 1);
      element.setAttribute('role', 'img');
      element.setAttribute('aria-label', `Slide ${index + 1} of ${model.slideCount}`);
      element.style.cssText = 'background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);flex:none;overflow:hidden;';
      slots.push({ index, element, renderedZoom: undefined });
      slidesEl.append(element);
    }
    const slotByElement = new Map(slots.map((slot) => [slot.element, slot] as const));
    const sizeSlot = (slot: Slot) => {
      const width = `${model.width * zoom}px`;
      const height = `${model.height * zoom}px`;
      slot.element.style.width = width;
      slot.element.style.height = height;
      // The viewer reads the canvas's pixel size from its style and may
      // redraw later, so the style always carries explicit pixels. Stretching
      // the old bitmap also covers the moment before a zoom re-renders.
      const canvas = slot.element.querySelector('canvas');
      if (canvas) {
        canvas.style.width = width;
        canvas.style.height = height;
      }
    };
    slots.forEach(sizeSlot);

    let destroyed = false;
    const visible = new Set<Slot>();
    // The viewer draws one slide at a time, so renders are queued.
    let queue: Promise<void> = Promise.resolve();

    const renderSlot = (slot: Slot) => {
      if (slot.renderedZoom === zoom) return;
      const targetZoom = zoom;
      slot.renderedZoom = targetZoom;
      queue = queue.then(async () => {
        if (destroyed) return;
        if (zoom !== targetZoom || !visible.has(slot)) {
          // Superseded while waiting; let the next pass draw it afresh.
          if (slot.renderedZoom === targetZoom) slot.renderedZoom = undefined;
          return;
        }
        const ratio = view.devicePixelRatio || 1;
        const canvas = doc.createElement('canvas');
        const width = model.width * targetZoom;
        const height = model.height * targetZoom;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        canvas.style.cssText = `display:block;width:${width}px;height:${height}px;`;
        // The viewer measures the canvas, so it has to be in the page first.
        slot.element.replaceChildren(canvas);
        try {
          await model.viewer.renderSlide(slot.index, canvas);
        } catch (cause) {
          console.error(`omnifile: could not render slide ${slot.index + 1}`, cause);
          if (destroyed) return;
          const message = doc.createElement('div');
          message.style.cssText =
            'height:100%;display:flex;align-items:center;justify-content:center;color:#57606a;font:14px system-ui,sans-serif;';
          message.textContent = `Slide ${slot.index + 1} could not be displayed.`;
          slot.element.replaceChildren(message);
          return;
        }
      });
    };
    const renderVisible = () => {
      for (const slot of visible) renderSlot(slot);
    };

    const observer = new view.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const slot = slotByElement.get(entry.target as HTMLDivElement);
          if (!slot) continue;
          if (entry.isIntersecting) visible.add(slot);
          else {
            visible.delete(slot);
            slot.element.replaceChildren();
            slot.renderedZoom = undefined;
          }
        }
        renderVisible();
      },
      { root: container, rootMargin: '100% 0px' },
    );
    slots.forEach((slot) => observer.observe(slot.element));

    return {
      destroy() {
        destroyed = true;
        observer.disconnect();
        slidesEl.remove();
        model.viewer.destroy();
      },
      zoom: {
        min: MIN_ZOOM,
        max: MAX_ZOOM,
        get: () => zoom,
        set(value) {
          if (value === zoom) return;
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
    model.viewer.destroy();
  },
};
