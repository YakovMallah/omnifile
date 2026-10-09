import type { FormatInfo } from './formats';
import type { AnyPlugin, OmniPlugin } from './types';

/**
 * Pick the plugin for a format. Later plugins win, so a user can override a
 * built-in renderer by appending their own to the list. A plugin listing
 * `'*'` is a fallback: it is used only when nothing names the format, which
 * is how a hex viewer can catch every file that has no renderer.
 */
export function findPlugin(plugins: readonly AnyPlugin[], format: FormatInfo): AnyPlugin | undefined {
  let fallback: AnyPlugin | undefined;
  for (let index = plugins.length - 1; index >= 0; index--) {
    const plugin = plugins[index]!;
    if (plugin.formats.includes(format.id)) return plugin;
    if (!fallback && plugin.formats.includes('*')) fallback = plugin;
  }
  return fallback;
}

/** Helper for authoring a plugin with its model type inferred. */
export function definePlugin<TModel>(plugin: OmniPlugin<TModel>): OmniPlugin<TModel> {
  return plugin;
}
