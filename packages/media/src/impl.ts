import type { PluginImplementation } from '@omnifile/core';

export interface MediaModel {
  url: string;
  kind: 'video' | 'audio';
}

export const implementation: PluginImplementation<MediaModel> = {
  parse(file) {
    const blob = new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.format.mime });
    return {
      url: URL.createObjectURL(blob),
      kind: file.format.category === 'audio' ? 'audio' : 'video',
    };
  },

  async render(model, { container, signal }) {
    const doc = container.ownerDocument;
    const stage = doc.createElement('div');
    stage.style.cssText =
      'height:100%;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
    const player = doc.createElement(model.kind);
    player.controls = true;
    player.preload = 'metadata';
    player.style.cssText =
      model.kind === 'video' ? 'max-width:100%;max-height:100%;' : 'width:min(100%,480px);';
    stage.append(player);

    await new Promise<void>((resolve, reject) => {
      player.addEventListener('loadedmetadata', () => resolve(), { once: true });
      player.addEventListener(
        'error',
        () => reject(new Error('This browser cannot play this file. Its codec may be unsupported.')),
        { once: true },
      );
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      player.src = model.url;
    });
    container.append(stage);

    return {
      destroy() {
        player.pause();
        player.removeAttribute('src');
        player.load();
        stage.remove();
        URL.revokeObjectURL(model.url);
      },
    };
  },

  dispose(model) {
    URL.revokeObjectURL(model.url);
  },
};
