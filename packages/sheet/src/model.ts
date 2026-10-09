export interface Merge {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export interface Sheet {
  name: string;
  /** Row-major, sparse: a missing row or cell is empty. Values are display text. */
  rows: (string | undefined)[][];
  rowCount: number;
  colCount: number;
  /** Cells holding numbers or dates, keyed with `cellKey`; shown right-aligned. */
  numeric: Set<number>;
  /** Column widths in pixels, where the file specifies them. */
  colWidths: Map<number, number>;
  merges: Merge[];
}

export interface SheetModel {
  sheets: Sheet[];
}

/** Excel's column limit, so row and column pack into one number. */
export const MAX_COLS = 16384;
export const cellKey = (row: number, col: number) => row * MAX_COLS + col;

/** 0 -> A, 25 -> Z, 26 -> AA. */
export function columnLabel(index: number): string {
  let label = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  }
  return label;
}

/** "AB12" -> { row: 11, col: 27 }. */
export function parseReference(reference: string): { row: number; col: number } {
  let col = 0;
  let index = 0;
  for (; index < reference.length; index++) {
    const code = reference.charCodeAt(index);
    if (code < 65 || code > 90) break;
    col = col * 26 + (code - 64);
  }
  return { row: Number(reference.slice(index)) - 1, col: col - 1 };
}
