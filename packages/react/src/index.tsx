import { useEffect, useRef, type CSSProperties } from 'react';
import { mount, type MountOptions } from '@omnifile/core';

export type { AnyPlugin, LoadedFile, OmniMode, OmniPlugin, OmniSource } from '@omnifile/core';

export interface OmniFileProps extends MountOptions {
  className?: string;
  /** The viewer fills this element, so give it a height. */
  style?: CSSProperties;
}

/**
 * Shows any file the given plugins understand.
 *
 * ```tsx
 * <OmniFile source={file} plugins={[pdf(), image(), text()]} style={{ height: 600 }} />
 * ```
 */
export function OmniFile(props: OmniFileProps) {
  const { className, style, source, name, mimeType, mode, toolbar, theme } = props;
  const host = useRef<HTMLDivElement>(null);

  // Callbacks, plugin arrays and fetch options are usually created inline, so
  // they get a new identity on every render. Read them through a ref and key
  // the effect on what actually changes what is shown.
  const latest = useRef(props);
  latest.current = props;
  const pluginKey = props.plugins.map((plugin) => plugin.id).join('|');

  useEffect(() => {
    if (!host.current) return;
    const instance = mount(host.current, {
      source,
      name,
      mimeType,
      mode,
      toolbar,
      theme,
      plugins: latest.current.plugins,
      fetchInit: latest.current.fetchInit,
      onLoad: (result) => latest.current.onLoad?.(result),
      onError: (error) => latest.current.onError?.(error),
    });
    return () => instance.destroy();
  }, [source, name, mimeType, mode, toolbar, theme, pluginKey]);

  return <div ref={host} className={className} style={{ height: '100%', ...style }} />;
}
