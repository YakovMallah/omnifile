import { ensureStyle, formatSize, type PluginImplementation } from '@omnifile/core';
import { buildTree, type TreeNode } from './tree';
import { readZipDirectory, type ArchiveModel } from './zip';

export type { ArchiveModel } from './zip';

/** Small archives open fully; large ones start with only the top level. */
const EXPAND_ALL_LIMIT = 200;
/** A folder with more children than this shows them in batches. */
const BATCH = 500;
const INDENT = 18;

const CSS = `
.omnifile-archive { min-height: 100%; background: var(--omnifile-surface); padding: 12px 16px 20px; }
.omnifile-archive-summary { color: var(--omnifile-muted); margin: 0 0 10px; }
.omnifile-archive table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
.omnifile-archive th, .omnifile-archive td { text-align: left; padding: 0 12px 0 0; height: 30px; border-bottom: 1px solid var(--omnifile-border); white-space: nowrap; }
.omnifile-archive thead th { color: var(--omnifile-muted); font-weight: 600; position: sticky; top: 0; z-index: 1; background: var(--omnifile-surface); }
.omnifile-archive td.omnifile-archive-name { width: 100%; max-width: 0; }
.omnifile-archive-entry { display: flex; align-items: center; gap: 6px; min-width: 0; height: 30px; width: 100%; }
button.omnifile-archive-entry { appearance: none; border: 0; background: none; color: inherit; font: inherit; padding: 0; text-align: left; cursor: pointer; border-radius: 4px; }
button.omnifile-archive-entry:hover .omnifile-archive-label { text-decoration: underline; }
button.omnifile-archive-entry:focus-visible { outline: 2px solid var(--omnifile-accent); outline-offset: -2px; }
.omnifile-archive-label { overflow: hidden; text-overflow: ellipsis; }
.omnifile-archive-chevron { flex: none; width: 12px; height: 12px; color: var(--omnifile-muted); transition: transform 0.12s; }
[aria-expanded="true"] > .omnifile-archive-chevron { transform: rotate(90deg); }
.omnifile-archive-icon { flex: none; width: 16px; height: 16px; }
.omnifile-archive-icon[data-kind="folder"] { color: var(--omnifile-accent); }
.omnifile-archive-icon[data-kind="file"] { color: var(--omnifile-muted); }
.omnifile-archive .num { text-align: right; }
.omnifile-archive .dim { color: var(--omnifile-muted); }
.omnifile-archive-more { appearance: none; border: 1px solid var(--omnifile-border); background: none; color: inherit; font: inherit; border-radius: 6px; padding: 2px 10px; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .omnifile-archive-chevron { transition: none; } }
`;

const SVG = 'http://www.w3.org/2000/svg';
const ICONS = {
  chevron: 'M4.5 2.5 8 6l-3.5 3.5',
  folder: 'M1.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h6.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z',
  file: 'M4 1.5h5l3.5 3.5v9a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5zM9 1.5V5h3.5',
};

export const implementation: PluginImplementation<ArchiveModel> = {
  parse(file) {
    return { entries: readZipDirectory(file.bytes) };
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
    const icon = (kind: keyof typeof ICONS, size: number) => {
      const svg = doc.createElementNS(SVG, 'svg');
      svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('class', kind === 'chevron' ? 'omnifile-archive-chevron' : 'omnifile-archive-icon');
      if (kind !== 'chevron') svg.dataset.kind = kind;
      const path = doc.createElementNS(SVG, 'path');
      path.setAttribute('d', ICONS[kind]);
      path.setAttribute('fill', kind === 'folder' ? 'currentColor' : 'none');
      path.setAttribute('fill-opacity', '0.25');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', kind === 'chevron' ? '1.6' : '1.1');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.append(path);
      return svg;
    };

    const root = buildTree(model.entries);
    const dates = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    const countLabel = (count: number) => `${count.toLocaleString()} ${count === 1 ? 'file' : 'files'}`;

    const wrapper = el('div', undefined, 'omnifile-archive');
    wrapper.append(
      el(
        'p',
        root.fileCount === 0 && root.children.length === 0
          ? 'This archive is empty.'
          : `${countLabel(root.fileCount)}, ${formatSize(root.size)} when extracted`,
        'omnifile-archive-summary',
      ),
    );

    const table = el('table');
    const head = el('tr');
    head.append(el('th', 'Name'), el('th', 'Size', 'num'), el('th', 'Packed', 'num'), el('th', 'Modified'));
    head.querySelectorAll('th').forEach((th) => (th.scope = 'col'));
    const thead = el('thead');
    thead.append(head);
    const tbody = el('tbody');
    table.append(thead, tbody);

    /** Rows currently shown for each open folder, so closing can remove them. */
    const shown = new Map<TreeNode, HTMLTableRowElement[]>();

    const collapse = (node: TreeNode) => {
      for (const child of node.children) if (shown.has(child)) collapse(child);
      for (const row of shown.get(node) ?? []) row.remove();
      shown.delete(node);
    };

    /**
     * Insert `node`'s children after `after`, a batch at a time, and return
     * the last row added (the place a following sibling belongs after).
     */
    const expand = (
      node: TreeNode,
      depth: number,
      after: HTMLTableRowElement | null,
      deep: boolean,
    ): HTMLTableRowElement | null => {
      const rows: HTMLTableRowElement[] = [];
      shown.set(node, rows);
      let anchor = after;
      const place = (row: HTMLTableRowElement) => {
        if (anchor) anchor.after(row);
        else tbody.prepend(row);
        anchor = row;
        rows.push(row);
      };

      const addBatch = (start: number) => {
        const end = Math.min(node.children.length, start + BATCH);
        for (let index = start; index < end; index++) {
          const child = node.children[index]!;
          const row = buildRow(child, depth);
          place(row);
          if (child.directory && deep) {
            row.querySelector('button')?.setAttribute('aria-expanded', 'true');
            // Later siblings go below everything inside this folder.
            anchor = expand(child, depth + 1, row, true) ?? row;
          }
        }
        if (end < node.children.length) {
          const row = el('tr');
          const cell = el('td');
          cell.colSpan = 4;
          cell.style.paddingLeft = `${depth * INDENT + 18}px`;
          const more = el(
            'button',
            `Show ${Math.min(BATCH, node.children.length - end).toLocaleString()} more`,
            'omnifile-archive-more',
          );
          more.type = 'button';
          more.addEventListener('click', () => {
            // Whatever precedes this row, nested rows included, stays above.
            anchor = row.previousElementSibling as HTMLTableRowElement | null;
            rows.splice(rows.indexOf(row), 1);
            row.remove();
            addBatch(end);
          });
          cell.append(more);
          row.append(cell);
          place(row);
        }
      };
      addBatch(0);
      return anchor === after ? null : anchor;
    };

    const buildRow = (node: TreeNode, depth: number): HTMLTableRowElement => {
      const row = el('tr');
      const nameCell = el('td', undefined, 'omnifile-archive-name');
      const label = el('span', node.encrypted ? `${node.name} (encrypted)` : node.name, 'omnifile-archive-label');
      label.title = node.path;

      if (node.directory) {
        const toggle = el('button', undefined, 'omnifile-archive-entry');
        toggle.type = 'button';
        toggle.style.paddingLeft = `${depth * INDENT}px`;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.append(icon('chevron', 12), icon('folder', 16), label);
        toggle.addEventListener('click', () => {
          const open = toggle.getAttribute('aria-expanded') === 'true';
          toggle.setAttribute('aria-expanded', String(!open));
          if (open) collapse(node);
          else expand(node, depth + 1, row, false);
        });
        nameCell.append(toggle);
      } else {
        const entry = el('div', undefined, 'omnifile-archive-entry');
        // Line files up with folder names: leave room for the chevron.
        entry.style.paddingLeft = `${depth * INDENT + 18}px`;
        entry.append(icon('file', 16), label);
        nameCell.append(entry);
      }

      row.append(
        nameCell,
        el('td', node.directory ? countLabel(node.fileCount) : formatSize(node.size), node.directory ? 'num dim' : 'num'),
        el('td', node.directory ? '' : formatSize(node.compressedSize), 'num'),
        el('td', node.modified ? dates.format(node.modified) : '', 'dim'),
      );
      return row;
    };

    expand(root, 0, null, model.entries.length <= EXPAND_ALL_LIMIT);
    wrapper.append(table);
    container.append(wrapper);
    return { destroy: () => wrapper.remove() };
  },
};
