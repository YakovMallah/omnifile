import { ensureStyle, type RenderHandle } from '@omnifile/core';
import { looksNumeric } from './csv';
import { cellKey, columnLabel, type Sheet, type SheetModel } from './model';

const ROW_HEIGHT = 24;
const HEADER_HEIGHT = 24;
const DEFAULT_COL_WIDTH = 96;
const OVERSCAN_ROWS = 8;
const OVERSCAN_COLS = 2;
/** Above this, intersecting merges with the view each frame gets too slow. */
const MAX_MERGES = 5000;

const CSS = `
.omnifile-sheet { display: flex; flex-direction: column; height: 100%; background: var(--omnifile-surface); font-size: 13px; }
.omnifile-sheet-scroll { flex: 1; min-height: 0; overflow: auto; position: relative; }
.omnifile-sheet-area { position: relative; }
.omnifile-sheet-head { position: sticky; top: 0; z-index: 3; height: ${HEADER_HEIGHT}px; background: var(--omnifile-bg); border-bottom: 1px solid var(--omnifile-border); }
.omnifile-sheet-corner { position: sticky; left: 0; z-index: 4; height: ${HEADER_HEIGHT}px; background: var(--omnifile-bg); border-right: 1px solid var(--omnifile-border); }
.omnifile-sheet-rows { position: sticky; left: 0; z-index: 2; height: 0; }
.omnifile-sheet-label { position: absolute; display: flex; align-items: center; justify-content: center; color: var(--omnifile-muted); background: var(--omnifile-bg); font-size: 12px; user-select: none; box-sizing: border-box; }
.omnifile-sheet-head .omnifile-sheet-label { top: 0; height: ${HEADER_HEIGHT}px; border-right: 1px solid var(--omnifile-border); }
.omnifile-sheet-rows .omnifile-sheet-label { left: 0; height: ${ROW_HEIGHT}px; border-right: 1px solid var(--omnifile-border); border-bottom: 1px solid var(--omnifile-border); font-variant-numeric: tabular-nums; }
.omnifile-sheet-cells { position: absolute; left: 0; }
.omnifile-sheet-cell { position: absolute; box-sizing: border-box; padding: 0 6px; line-height: ${ROW_HEIGHT - 1}px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-right: 1px solid var(--omnifile-border); border-bottom: 1px solid var(--omnifile-border); background: var(--omnifile-surface); }
.omnifile-sheet-cell[data-n] { text-align: right; font-variant-numeric: tabular-nums; }
.omnifile-sheet-tabs { flex: none; display: flex; gap: 2px; padding: 4px 8px; overflow-x: auto; border-top: 1px solid var(--omnifile-border); background: var(--omnifile-bg); }
.omnifile-sheet-tab { appearance: none; font: inherit; color: var(--omnifile-muted); background: transparent; border: 1px solid transparent; border-radius: 5px; padding: 3px 12px; cursor: pointer; white-space: nowrap; }
.omnifile-sheet-tab:hover { color: var(--omnifile-text); }
.omnifile-sheet-tab[aria-selected="true"] { color: var(--omnifile-text); background: var(--omnifile-surface); border-color: var(--omnifile-border); font-weight: 600; }
.omnifile-sheet-tab:focus-visible { outline: 2px solid var(--omnifile-accent); outline-offset: 1px; }
.omnifile-sheet-empty { position: absolute; inset: ${HEADER_HEIGHT}px 0 0 0; display: flex; align-items: center; justify-content: center; color: var(--omnifile-muted); }
`;

/** Left edge of every column, plus the total width as the last entry. */
function columnOffsets(sheet: Sheet, colCount: number): Float64Array<ArrayBuffer> {
  const offsets = new Float64Array(colCount + 1);
  for (let col = 0; col < colCount; col++) {
    offsets[col + 1] = offsets[col]! + (sheet.colWidths.get(col) ?? DEFAULT_COL_WIDTH);
  }
  return offsets;
}

/** Index of the column containing pixel `x`. */
function columnAt(offsets: Float64Array, x: number): number {
  let low = 0;
  let high = offsets.length - 2;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (offsets[mid]! <= x) low = mid;
    else high = mid - 1;
  }
  return Math.max(0, low);
}

export function renderGrid(model: SheetModel, container: HTMLElement): RenderHandle {
  const doc = container.ownerDocument;
  const view = doc.defaultView ?? window;
  ensureStyle(doc, 'omnifile-sheet-styles', CSS);
  const el = (className: string, text?: string) => {
    const node = doc.createElement('div');
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const root = el('omnifile-sheet');
  const scroll = el('omnifile-sheet-scroll');
  scroll.tabIndex = 0;
  const area = el('omnifile-sheet-area');
  const head = el('omnifile-sheet-head');
  const corner = el('omnifile-sheet-corner');
  const rowLabels = el('omnifile-sheet-rows');
  const cells = el('omnifile-sheet-cells');
  head.append(corner);
  area.append(head, rowLabels, cells);
  scroll.append(area);
  root.append(scroll);

  // The grid scrolls itself so the sheet tabs can stay put underneath.
  const previousOverflow = container.style.overflow;
  container.style.overflow = 'hidden';
  container.append(root);

  let sheet = model.sheets[0]!;
  let offsets = new Float64Array(1);
  let rowHeaderWidth = 48;
  let covered = new Set<number>();
  let frame = 0;
  let drawn = '';

  const draw = () => {
    frame = 0;
    const rowCount = sheet.rowCount;
    const colCount = sheet.colCount;
    if (rowCount === 0 || colCount === 0) return;

    const top = Math.max(0, scroll.scrollTop);
    const left = Math.max(0, scroll.scrollLeft);
    const firstRow = Math.max(0, Math.floor(top / ROW_HEIGHT) - OVERSCAN_ROWS);
    const lastRow = Math.min(rowCount - 1, Math.ceil((top + scroll.clientHeight) / ROW_HEIGHT) + OVERSCAN_ROWS);
    const firstCol = Math.max(0, columnAt(offsets, left) - OVERSCAN_COLS);
    const lastCol = Math.min(colCount - 1, columnAt(offsets, left + scroll.clientWidth) + OVERSCAN_COLS);
    const signature = `${firstRow}:${lastRow}:${firstCol}:${lastCol}`;
    if (signature === drawn) return;
    drawn = signature;

    const headFragment = doc.createDocumentFragment();
    headFragment.append(corner);
    for (let col = firstCol; col <= lastCol; col++) {
      const label = el('omnifile-sheet-label', columnLabel(col));
      label.style.left = `${rowHeaderWidth + offsets[col]!}px`;
      label.style.width = `${offsets[col + 1]! - offsets[col]!}px`;
      headFragment.append(label);
    }
    head.replaceChildren(headFragment);

    const rowFragment = doc.createDocumentFragment();
    const cellFragment = doc.createDocumentFragment();
    const addCell = (row: number, col: number, rowSpan: number, colSpan: number) => {
      const text = sheet.rows[row]?.[col];
      const cell = el('omnifile-sheet-cell', text ?? '');
      cell.style.left = `${offsets[col]!}px`;
      cell.style.top = `${row * ROW_HEIGHT}px`;
      cell.style.width = `${offsets[Math.min(col + colSpan, colCount)]! - offsets[col]!}px`;
      cell.style.height = `${rowSpan * ROW_HEIGHT}px`;
      if (text !== undefined) {
        if (sheet.numeric.has(cellKey(row, col)) || (sheet.numeric.size === 0 && looksNumeric(text))) {
          cell.dataset.n = '';
        }
        if (text.length > 12) cell.title = text;
      }
      if (rowSpan > 1 || colSpan > 1) cell.style.zIndex = '1';
      cellFragment.append(cell);
    };

    for (let row = firstRow; row <= lastRow; row++) {
      const label = el('omnifile-sheet-label', String(row + 1));
      label.style.top = `${row * ROW_HEIGHT}px`;
      label.style.width = `${rowHeaderWidth}px`;
      rowFragment.append(label);
      for (let col = firstCol; col <= lastCol; col++) {
        if (covered.size > 0 && covered.has(cellKey(row, col))) continue;
        addCell(row, col, 1, 1);
      }
    }
    // Merged cells are drawn from their anchor, even when it is out of view.
    if (sheet.merges.length <= MAX_MERGES) {
      for (const merge of sheet.merges) {
        if (merge.row > lastRow || merge.row + merge.rowSpan - 1 < firstRow) continue;
        if (merge.col > lastCol || merge.col + merge.colSpan - 1 < firstCol) continue;
        addCell(merge.row, merge.col, merge.rowSpan, merge.colSpan);
      }
    }
    rowLabels.replaceChildren(rowFragment);
    cells.replaceChildren(cellFragment);
  };

  const schedule = () => {
    frame ||= view.requestAnimationFrame(draw);
  };

  const show = (next: Sheet) => {
    sheet = next;
    offsets = columnOffsets(sheet, sheet.colCount);
    rowHeaderWidth = Math.max(40, String(sheet.rowCount).length * 8 + 18);
    covered = new Set();
    if (sheet.merges.length <= MAX_MERGES) {
      for (const merge of sheet.merges) {
        for (let row = merge.row; row < merge.row + merge.rowSpan; row++) {
          for (let col = merge.col; col < merge.col + merge.colSpan; col++) covered.add(cellKey(row, col));
        }
      }
    }
    const width = rowHeaderWidth + offsets[sheet.colCount]!;
    area.style.width = `${width}px`;
    area.style.height = `${HEADER_HEIGHT + sheet.rowCount * ROW_HEIGHT}px`;
    corner.style.width = `${rowHeaderWidth}px`;
    cells.style.left = `${rowHeaderWidth}px`;
    cells.style.top = `${HEADER_HEIGHT}px`;
    area.querySelector('.omnifile-sheet-empty')?.remove();
    head.replaceChildren(corner);
    rowLabels.replaceChildren();
    cells.replaceChildren();
    if (sheet.rowCount === 0 || sheet.colCount === 0) {
      area.style.width = '100%';
      area.style.height = '100%';
      area.append(el('omnifile-sheet-empty', 'This sheet is empty.'));
    }
    scroll.scrollTop = 0;
    scroll.scrollLeft = 0;
    drawn = '';
    draw();
  };

  if (model.sheets.length > 1) {
    const tabs = el('omnifile-sheet-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Sheets');
    const buttons = model.sheets.map((item) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'omnifile-sheet-tab';
      button.textContent = item.name;
      button.setAttribute('role', 'tab');
      button.addEventListener('click', () => {
        buttons.forEach((other) => other.setAttribute('aria-selected', String(other === button)));
        show(item);
      });
      return button;
    });
    buttons[0]!.setAttribute('aria-selected', 'true');
    buttons.slice(1).forEach((button) => button.setAttribute('aria-selected', 'false'));
    tabs.append(...buttons);
    root.append(tabs);
  }

  scroll.addEventListener('scroll', schedule, { passive: true });
  const resize = new view.ResizeObserver(() => {
    drawn = '';
    schedule();
  });
  resize.observe(scroll);
  show(sheet);

  return {
    destroy() {
      scroll.removeEventListener('scroll', schedule);
      resize.disconnect();
      if (frame) view.cancelAnimationFrame(frame);
      root.remove();
      container.style.overflow = previousOverflow;
    },
  };
}
