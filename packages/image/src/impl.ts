import type { PluginImplementation } from '@omnifile/core';

export interface ImageModel {
  /** Object URL for the original bytes. */
  url: string;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

export const implementation: PluginImplementation<ImageModel> = {
  parse(file) {
    const blob = new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.format.mime });
    return { url: URL.createObjectURL(blob) };
  },

  async render(model, { container, file, signal }) {
    const doc = container.ownerDocument;
    const stage = doc.createElement('div');
    stage.style.cssText =
      'min-height:100%;display:flex;padding:16px;box-sizing:border-box;';
    // An <img> never runs scripts, so this is also the safe way to show SVG.
    const img = doc.createElement('img');
    img.alt = file.name;
    img.draggable = false;
    img.style.cssText = 'display:block;margin:auto;max-width:none;flex:none;';
    stage.append(img);

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('The image is damaged or in a format this browser cannot decode.'));
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      img.src = model.url;
    });

    // SVGs without intrinsic dimensions report 0; give them a sensible box.
    const naturalWidth = img.naturalWidth || 512;
    const naturalHeight = img.naturalHeight || 512;
    container.append(stage);

    const fit = Math.min(
      1,
      (container.clientWidth - 32) / naturalWidth || 1,
      (container.clientHeight - 32) / naturalHeight || 1,
    );
    let zoom = Math.max(MIN_ZOOM, fit > 0 ? fit : 1);
    const apply = () => {
      img.style.width = `${naturalWidth * zoom}px`;
      img.style.height = `${naturalHeight * zoom}px`;
    };
    apply();

    return {
      destroy() {
        stage.remove();
        URL.revokeObjectURL(model.url);
      },
      zoom: {
        min: MIN_ZOOM,
        max: MAX_ZOOM,
        get: () => zoom,
        set(value) {
          zoom = value;
          apply();
        },
      },
    };
  },

  dispose(model) {
    URL.revokeObjectURL(model.url);
  },
};
