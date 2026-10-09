import { loadSource } from './load';
import { findPlugin } from './registry';
import { injectStyles } from './styles';
import type { AnyPlugin, LoadedFile, OmniMode, OmniSource, RenderHandle } from './types';

export interface MountOptions {
  source: OmniSource;
  plugins: readonly AnyPlugin[];
  /** File name, when the source does not carry one (ArrayBuffer, blob URL). */
  name?: string;
  /** MIME type, when the source does not carry one. */
  mimeType?: string;
  /** Defaults to `view`. */
  mode?: OmniMode;
  /** Show the toolbar. Defaults to true. */
  toolbar?: boolean;
  /** Force a theme instead of following the system setting. */
  theme?: 'light' | 'dark';
  /** Passed to `fetch` for URL sources. */
  fetchInit?: RequestInit;
  onLoad?(result: { file: LoadedFile; plugin: AnyPlugin | undefined }): void;
  onError?(error: Error): void;
}

export interface OmniInstance {
  /** The viewer's root element. */
  readonly element: HTMLElement;
  destroy(): void;
}

const ZOOM_STEP = 1.25;

/** Render a file into `target`. Framework wrappers are thin layers over this. */
export function mount(target: HTMLElement, options: MountOptions): OmniInstance {
  const doc = target.ownerDocument;
  injectStyles(doc);

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
    const node = doc.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const root = el('div', 'omnifile');
  if (options.theme) root.dataset.theme = options.theme;
  const toolbar = el('div', 'omnifile-toolbar');
  toolbar.setAttribute('role', 'toolbar');
  const viewport = el('div', 'omnifile-viewport');
  if (options.toolbar !== false) root.append(toolbar);
  root.append(viewport);
  target.append(root);

  const abort = new AbortController();
  const { signal } = abort;
  let handle: RenderHandle | undefined;
  let downloadUrl: string | undefined;

  const showStatus = (...children: (Node | string)[]) => {
    const status = el('div', 'omnifile-status');
    status.append(...children);
    viewport.replaceChildren(status);
    return status;
  };

  const downloadLink = (file: LoadedFile, label: string, primary = false) => {
    downloadUrl ??= URL.createObjectURL(
      new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.format.mime }),
    );
    const link = el('a', 'omnifile-button', label);
    link.href = downloadUrl;
    link.download = file.name;
    if (primary) link.dataset.primary = '';
    return link;
  };

  const buildToolbar = (file: LoadedFile, rendered: RenderHandle | undefined) => {
    const zoom = rendered?.zoom;
    const views = rendered?.views;
    const name = el('span', 'omnifile-name', file.name);
    name.title = file.name;
    const meta = el('span', 'omnifile-meta', `${file.format.label} · ${formatSize(file.size)}`);
    const items: Node[] = [name, meta, el('span', 'omnifile-spacer')];

    if (views && views.options.length > 1) {
      const group = el('div', 'omnifile-views');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'View');
      const buttons = views.options.map((option) => {
        const button = el('button', 'omnifile-button', option.label);
        button.type = 'button';
        button.addEventListener('click', () => {
          views.set(option.id);
          refresh();
        });
        return button;
      });
      const refresh = () => {
        const current = views.get();
        buttons.forEach((button, index) =>
          button.setAttribute('aria-pressed', String(views.options[index]!.id === current)),
        );
      };
      refresh();
      group.append(...buttons);
      items.push(group);
    }

    if (zoom) {
      const group = el('div', 'omnifile-zoom');
      const out = el('button', 'omnifile-button', '−');
      const value = el('span', 'omnifile-zoom-value');
      const zoomIn = el('button', 'omnifile-button', '+');
      out.type = zoomIn.type = 'button';
      out.setAttribute('aria-label', 'Zoom out');
      zoomIn.setAttribute('aria-label', 'Zoom in');
      value.setAttribute('aria-live', 'polite');
      const refresh = () => {
        const current = zoom.get();
        value.textContent = `${Math.round(current * 100)}%`;
        out.disabled = current <= zoom.min + 1e-6;
        zoomIn.disabled = current >= zoom.max - 1e-6;
      };
      const step = (factor: number) => {
        zoom.set(Math.min(zoom.max, Math.max(zoom.min, zoom.get() * factor)));
        refresh();
      };
      out.addEventListener('click', () => step(1 / ZOOM_STEP));
      zoomIn.addEventListener('click', () => step(ZOOM_STEP));
      refresh();
      group.append(out, value, zoomIn);
      items.push(group);
    }

    items.push(downloadLink(file, 'Download'));
    toolbar.replaceChildren(...items);
  };

  const run = async () => {
    showStatus(el('div', 'omnifile-spinner'), 'Loading…');

    const file = await loadSource(options.source, {
      name: options.name,
      mimeType: options.mimeType,
      fetchInit: options.fetchInit,
      signal,
    });
    signal.throwIfAborted();
    buildToolbar(file, undefined);

    const plugin = findPlugin(options.plugins, file.format);
    if (!plugin) {
      showStatus(
        el('strong', '', 'No preview available'),
        `There is no renderer for ${file.format.label} files yet.`,
        downloadLink(file, 'Download file', true),
      );
      options.onLoad?.({ file, plugin: undefined });
      return;
    }

    const mode = options.mode ?? 'view';
    const implementation = await plugin.load();
    signal.throwIfAborted();
    const model = await implementation.parse(file, { mode, signal });
    if (signal.aborted) {
      implementation.dispose?.(model);
      signal.throwIfAborted();
    }

    viewport.replaceChildren();
    const rendered = await implementation.render(model, { container: viewport, file, mode, signal });
    if (signal.aborted) {
      rendered.destroy();
      signal.throwIfAborted();
    }
    handle = rendered;
    root.dataset.format = file.format.id;
    root.dataset.plugin = plugin.id;
    buildToolbar(file, rendered);
    options.onLoad?.({ file, plugin });
  };

  run().catch((cause: unknown) => {
    if (signal.aborted) return;
    const error = cause instanceof Error ? cause : new Error(String(cause));
    showStatus(el('strong', '', 'This file could not be displayed'), error.message);
    options.onError?.(error);
  });

  return {
    element: root,
    destroy() {
      if (signal.aborted) return;
      abort.abort();
      handle?.destroy();
      handle = undefined;
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      root.remove();
    },
  };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
