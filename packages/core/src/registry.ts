import type { FormatInfo } from './formats';
import type { AnyPlugin, OmniPlugin } from './types';

/**
 * Pick the plugin for a format. Later plugins win, so a user can override a
 * built-in renderer by appending their own to the list.
 */
export function findPlugin(plugins: readonly AnyPlugin[], format: FormatInfo): AnyPlugin | undefined {
  for (let index = plugins.length - 1; index >= 0; index--) {
    const plugin = plugins[index]!;
    if (plugin.formats.includes(format.id)) return plugin;
  }
  return undefined;
}

/** Helper for authoring a plugin with its model type inferred. */
export function definePlugin<TModel>(plugin: OmniPlugin<TModel>): OmniPlugin<TModel> {
  return plugin;
}
