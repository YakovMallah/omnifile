import {
  SHELL_CSS,
  THEME_VARIABLES,
  type AnyPlugin,
  type LoadedFile,
  type PluginImplementation,
  type RenderHandle,
} from '@omnifile/core';
import { frameDocument } from './runtime';

export { contentPolicy } from './runtime';

export interface SandboxOptions {
  /**
   * Where to fetch a plugin's frame module, by plugin id. Only needed when
   * your bundler does not resolve the URL the plugin provides.
   */
  frameUrls?: Record<string, string>;
  /** How long to wait for the frame to start, in milliseconds. Default 20000. */
  startTimeout?: number;
  /**
   * Called when a link inside a file is clicked. Return false to block it.
   * By default http, https and mailto links open in a new tab.
   */
  onLink?(href: string): boolean | void;
}

interface SandboxModel {
  file: LoadedFile;
}

const SAFE_LINK = /^(https?:|mailto:)/i;
const sources = new Map<string, Promise<string>>();

/** Fetch a plugin's frame module once and keep the text. */
function loadSource(url: string): Promise<string> {
  let source = sources.get(url);
  if (!source) {
    source = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Could not load the viewer for this format (HTTP ${response.status}).`);
      return response.text();
    });
    source.catch(() => sources.delete(url));
    sources.set(url, source);
  }
  return source;
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A click the user really made, so a hijacked frame cannot act unprompted. */
const userIsActing = () => navigator.userActivation?.isActive ?? true;

function createImplementation(
  plugin: AnyPlugin,
  url: () => string,
  options: SandboxOptions,
): PluginImplementation<SandboxModel> {
  return {
    // Nothing is parsed here: the bytes go to the frame untouched.
    parse: (file) => ({ file }),

    async render({ file }, { container, mode, signal }): Promise<RenderHandle> {
      const doc = container.ownerDocument;
      const view = doc.defaultView ?? window;
      const code = await loadSource(url());
      signal.throwIfAborted();

      const frame = doc.createElement('iframe');
      frame.title = file.name;
      // Scripts, and nothing else: no same-origin access, no popups, no
      // downloads, no top-level navigation, no forms.
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.style.cssText = 'display:block;width:100%;height:100%;border:0;visibility:hidden;';
      frame.srcdoc = frameDocument(randomNonce());

      const status = doc.createElement('div');
      status.className = 'omnifile-status';
      status.style.cssText = 'position:absolute;inset:0;';
      const spinner = doc.createElement('div');
      spinner.className = 'omnifile-spinner';
      status.append(spinner, 'Loading…');

      const previousOverflow = container.style.overflow;
      container.style.overflow = 'hidden';
      container.append(frame, status);

      const channel = new MessageChannel();
      const port = channel.port1;
      let zoom: { min: number; max: number; value: number } | undefined;
      let views: { options: { id: string; label: string }[]; value: string } | undefined;

      const destroy = () => {
        port.close();
        frame.remove();
        status.remove();
        container.style.overflow = previousOverflow;
      };

      const theme = container.closest<HTMLElement>('.omnifile');
      const variables: Record<string, string> = {};
      if (theme) {
        const computed = view.getComputedStyle(theme);
        for (const name of THEME_VARIABLES) {
          const value = computed.getPropertyValue(name).trim();
          if (value) variables[name] = value;
        }
      }

      try {
        await new Promise<void>((resolve, reject) => {
          const timer = view.setTimeout(
            () => reject(new Error('The sandbox could not start. A Content Security Policy on this page may be blocking it.')),
            options.startTimeout ?? 20_000,
          );
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });

          port.onmessage = (event) => {
            const message = event.data;
            switch (message?.type) {
              case 'ready': {
                view.clearTimeout(timer);
                // The frame gets its own copy; the original stays here for
                // the download button.
                const bytes = file.bytes.slice();
                port.postMessage(
                  {
                    type: 'render',
                    code,
                    options: plugin.frame?.options,
                    file: { ...file, bytes },
                    mode,
                    theme: theme?.dataset.theme,
                    css: SHELL_CSS,
                    variables,
                  },
                  [bytes.buffer],
                );
                break;
              }
              case 'rendered':
                zoom = message.zoom;
                views = message.views;
                resolve();
                break;
              case 'state':
                zoom = message.zoom ?? zoom;
                views = message.views ?? views;
                break;
              case 'error':
                view.clearTimeout(timer);
                reject(new Error(String(message.message)));
                break;
              case 'open-link': {
                const href = String(message.href);
                if (!SAFE_LINK.test(href) || !userIsActing()) break;
                if (options.onLink?.(href) === false) break;
                view.open(href, '_blank', 'noopener,noreferrer');
                break;
              }
              case 'download': {
                if (!userIsActing() || !(message.bytes instanceof ArrayBuffer)) break;
                // A generic type, so the browser saves the file and never opens it.
                const blobUrl = URL.createObjectURL(new Blob([message.bytes], { type: 'application/octet-stream' }));
                const link = doc.createElement('a');
                link.href = blobUrl;
                link.download = String(message.name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || 'download';
                link.click();
                view.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
                break;
              }
            }
          };

          frame.addEventListener(
            'load',
            () => frame.contentWindow?.postMessage({ type: 'omnifile:init' }, '*', [channel.port2]),
            { once: true },
          );
        });
      } catch (cause) {
        destroy();
        throw cause;
      }

      status.remove();
      frame.style.visibility = '';

      const handle: RenderHandle = { destroy };
      if (zoom) {
        const { min, max } = zoom;
        handle.zoom = {
          min,
          max,
          get: () => zoom!.value,
          set(value) {
            zoom!.value = value;
            port.postMessage({ type: 'zoom', value });
          },
        };
      }
      if (views) {
        handle.views = {
          options: views.options,
          get: () => views!.value,
          set(id) {
            views!.value = id;
            port.postMessage({ type: 'view', id });
          },
        };
      }
      return handle;
    },
  };
}

/**
 * Wrap plugins so each file is parsed and drawn inside an isolated frame.
 *
 * The frame has its own origin and no network access. If a malicious file
 * exploits a bug in a rendering library, the code it runs cannot read the
 * host page, its cookies or its storage, and cannot send the file anywhere.
 * The toolbar and download button stay in the host page.
 *
 * ```ts
 * const plugins = sandboxed([pdf(), docx(), sheet()]);
 * ```
 */
export function sandboxed(plugins: readonly AnyPlugin[], options: SandboxOptions = {}): AnyPlugin[] {
  return plugins.map((plugin) => {
    const override = options.frameUrls?.[plugin.id];
    const provided = plugin.frame?.url;
    if (!override && !provided) {
      throw new Error(
        `omnifile: plugin "${plugin.id}" has no frame module, so it cannot be sandboxed. ` +
          'Give it a `frame` entry, or pass its URL in `frameUrls`.',
      );
    }
    const url = () => override ?? (typeof provided === 'function' ? provided() : provided!);
    return {
      id: plugin.id,
      formats: plugin.formats,
      load: () => Promise.resolve(createImplementation(plugin, url, options)),
    };
  });
}
