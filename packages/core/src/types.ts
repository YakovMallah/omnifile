import type { FormatInfo } from './formats';

/** Anything a file can be loaded from. */
export type OmniSource = string | URL | File | Blob | ArrayBuffer | Uint8Array;

/**
 * `view` is supported everywhere. `edit` is reserved: a plugin that does not
 * implement editing is shown in view mode instead.
 */
export type OmniMode = 'view' | 'edit';

/** A source after it has been read into memory and identified. */
export interface LoadedFile {
  name: string;
  /**
   * The original bytes. Plugins must treat this as read-only so that a future
   * editor can patch the original file instead of regenerating it.
   */
  bytes: Uint8Array;
  size: number;
  format: FormatInfo;
  /** MIME type as declared by the source (File.type, Content-Type), if any. */
  declaredMimeType?: string;
  /** The URL the file was fetched from, if any. */
  url?: string;
}

export interface PluginContext {
  mode: OmniMode;
  /** Aborted when the viewer is destroyed or the source changes. */
  signal: AbortSignal;
}

export interface RenderContext extends PluginContext {
  /** Scrollable element the plugin renders into. */
  container: HTMLElement;
  file: LoadedFile;
}

export interface ZoomControl {
  /** Current zoom, where 1 is 100%. */
  get(): number;
  set(zoom: number): void;
  min: number;
  max: number;
}

export interface RenderHandle {
  destroy(): void;
  /** Present when the rendered content can be zoomed from the toolbar. */
  zoom?: ZoomControl;
}

/**
 * What a plugin does, split by capability. `parse` and `render` are required;
 * `serialize` is the hook editing will build on, so a format can ship
 * view-only and gain editing later without an API break.
 */
export interface PluginImplementation<TModel = unknown> {
  /** File bytes to a document model. */
  parse(file: LoadedFile, ctx: PluginContext): TModel | Promise<TModel>;
  /** Document model to DOM. */
  render(model: TModel, ctx: RenderContext): RenderHandle | Promise<RenderHandle>;
  /** Document model back to file bytes. Reserved for editing. */
  serialize?(model: TModel, file: LoadedFile): Uint8Array | Promise<Uint8Array>;
  /** Release anything `parse` allocated, if the model is never rendered. */
  dispose?(model: TModel): void;
}

/**
 * The cheap, always-loaded description of a plugin. The heavy code lives
 * behind `load()`, which should be a dynamic import so each format gets its
 * own chunk.
 */
export interface OmniPlugin<TModel = unknown> {
  id: string;
  /** Format ids this plugin handles, see `FORMATS`. */
  formats: readonly string[];
  load(): Promise<PluginImplementation<TModel>>;
}

/** A plugin of any model type, for registries and plugin lists. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPlugin = OmniPlugin<any>;
