import { allPlugins } from '@omnifile/all';
import { sandboxed } from '@omnifile/sandbox';

/**
 * Every official plugin, each running inside an isolated frame. One shared
 * list, so every viewer on the page reuses the same plugins.
 */
export const plugins = sandboxed(allPlugins());

/** The same plugins without the sandbox, for the comparison on the page. */
export const directPlugins = allPlugins();

export const sampleUrl = (file: string) => `${import.meta.env.BASE_URL}samples/${file}`;

export const REPO_URL = 'https://github.com/YakovMallah/omnifile';
