const STYLE_ID = 'omnifile-styles';

/**
 * The shell's styles. Everything is driven by CSS custom properties on
 * `.omnifile`, so a host app themes it by overriding those, and all rules sit
 * in a cascade layer so any host CSS wins without specificity fights.
 */
export const SHELL_CSS = `
@layer omnifile {
  .omnifile {
    --omnifile-bg: #f3f4f6;
    --omnifile-surface: #ffffff;
    --omnifile-text: #1f2328;
    --omnifile-muted: #656d76;
    --omnifile-border: #d0d7de;
    --omnifile-accent: #2563eb;
    --omnifile-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --omnifile-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    box-sizing: border-box;
    background: var(--omnifile-bg);
    color: var(--omnifile-text);
    font: 14px/1.5 var(--omnifile-font);
    overflow: hidden;
  }
  @media (prefers-color-scheme: dark) {
    .omnifile:not([data-theme="light"]) {
      --omnifile-bg: #0d1117;
      --omnifile-surface: #161b22;
      --omnifile-text: #e6edf3;
      --omnifile-muted: #8d96a0;
      --omnifile-border: #30363d;
      --omnifile-accent: #4c8dff;
    }
  }
  .omnifile[data-theme="dark"] {
    --omnifile-bg: #0d1117;
    --omnifile-surface: #161b22;
    --omnifile-text: #e6edf3;
    --omnifile-muted: #8d96a0;
    --omnifile-border: #30363d;
    --omnifile-accent: #4c8dff;
  }
  .omnifile *, .omnifile *::before, .omnifile *::after { box-sizing: border-box; }

  .omnifile-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--omnifile-surface);
    border-bottom: 1px solid var(--omnifile-border);
    flex: none;
  }
  .omnifile-name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .omnifile-meta { color: var(--omnifile-muted); white-space: nowrap; font-size: 12px; }
  .omnifile-spacer { flex: 1; }
  .omnifile-zoom { display: flex; align-items: center; gap: 2px; }
  .omnifile-views { display: flex; border: 1px solid var(--omnifile-border); border-radius: 6px; overflow: hidden; }
  .omnifile-views .omnifile-button { border-radius: 0; border: 0; height: 28px; font-size: 13px; }
  .omnifile-views .omnifile-button[aria-pressed="true"] { background: var(--omnifile-text); color: var(--omnifile-surface); }
  .omnifile-zoom-value { min-width: 46px; text-align: center; font-variant-numeric: tabular-nums; font-size: 12px; }
  .omnifile-button {
    appearance: none;
    font: inherit;
    color: inherit;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    min-width: 30px;
    height: 30px;
    padding: 0 8px;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
  }
  .omnifile-button:hover { background: var(--omnifile-bg); border-color: var(--omnifile-border); }
  .omnifile-button:focus-visible { outline: 2px solid var(--omnifile-accent); outline-offset: 1px; }
  .omnifile-button:disabled { opacity: 0.4; cursor: default; }
  .omnifile-button[data-primary] { background: var(--omnifile-accent); color: #fff; }

  .omnifile-viewport { flex: 1; min-height: 0; overflow: auto; position: relative; }

  .omnifile-status {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px;
    text-align: center;
    color: var(--omnifile-muted);
  }
  .omnifile-status strong { color: var(--omnifile-text); font-size: 15px; }
  .omnifile-spinner {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid var(--omnifile-border);
    border-top-color: var(--omnifile-accent);
    animation: omnifile-spin 0.8s linear infinite;
  }
  @keyframes omnifile-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .omnifile-spinner { animation-duration: 2.4s; } }
}
`;

/** The custom properties a host can set on `.omnifile` to theme the viewer. */
export const THEME_VARIABLES = [
  '--omnifile-bg',
  '--omnifile-surface',
  '--omnifile-text',
  '--omnifile-muted',
  '--omnifile-border',
  '--omnifile-accent',
  '--omnifile-font',
  '--omnifile-mono',
] as const;

export function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = SHELL_CSS;
  doc.head.appendChild(style);
}
