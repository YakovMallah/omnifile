import { ensureStyle, formatSize, type PluginImplementation } from '@omnifile/core';
import { readZipDirectory, type ArchiveModel } from './zip';

export type { ArchiveModel } from './zip';

/** Past this the table itself becomes the slow part. */
const MAX_ROWS = 5000;

const CSS = `
.omnifile-archive { min-height: 100%; background: var(--omnifile-surface); padding: 12px 16px 20px; }
.omnifile-archive-summary { color: var(--omnifile-muted); margin: 0 0 10px; }
.omnifile-archive table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
.omnifile-archive th, .omnifile-archive td { text-align: left; padding: 5px 12px 5px 0; border-bottom: 1px solid var(--omnifile-border); white-space: nowrap; }
.omnifile-archive thead th { color: var(--omnifile-muted); font-weight: 600; position: sticky; top: 0; background: var(--omnifile-surface); }
.omnifile-archive td:first-child { white-space: normal; word-break: break-all; font-family: var(--omnifile-mono); font-size: 13px; }
.omnifile-archive .num { text-align: right; }
.omnifile-archive tr[data-directory] td { color: var(--omnifile-muted); }
`;

export const implementation: PluginImplementation<ArchiveModel> = {
  parse(file) {
    const entries = readZipDirectory(file.bytes);
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return { entries };
  },

  render(model, { container }) {
    const doc = container.ownerDocument;
    ensureStyle(doc, 'omnifile-archive-styles', CSS);
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
      const node = doc.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    };

    const files = model.entries.filter((entry) => !entry.directory);
    const total = files.reduce((sum, entry) => sum + entry.size, 0);
    const wrapper = el('div', undefined, 'omnifile-archive');
    const summary = el(
      'p',
      `${files.length.toLocaleString()} ${files.length === 1 ? 'file' : 'files'}, ${formatSize(total)} when extracted`,
      'omnifile-archive-summary',
    );
    wrapper.append(summary);

    const table = el('table');
    const head = el('tr');
    head.append(el('th', 'Name'), el('th', 'Size', 'num'), el('th', 'Packed', 'num'), el('th', 'Modified'));
    head.querySelectorAll('th').forEach((th) => (th.scope = 'col'));
    const thead = el('thead');
    thead.append(head);
    const tbody = el('tbody');
    const dates = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    for (const entry of model.entries.slice(0, MAX_ROWS)) {
      const row = el('tr');
      if (entry.directory) row.dataset.directory = '';
      row.append(
        el('td', entry.encrypted ? `${entry.name} (encrypted)` : entry.name),
        el('td', entry.directory ? '' : formatSize(entry.size), 'num'),
        el('td', entry.directory ? '' : formatSize(entry.compressedSize), 'num'),
        el('td', entry.modified ? dates.format(entry.modified) : ''),
      );
      tbody.append(row);
    }
    table.append(thead, tbody);
    wrapper.append(table);
    if (model.entries.length > MAX_ROWS) {
      wrapper.append(
        el('p', `Showing the first ${MAX_ROWS.toLocaleString()} of ${model.entries.length.toLocaleString()} entries.`, 'omnifile-archive-summary'),
      );
    }
    if (model.entries.length === 0) summary.textContent = 'This archive is empty.';

    container.append(wrapper);
    return { destroy: () => wrapper.remove() };
  },
};
