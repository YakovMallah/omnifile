import type { Sheet } from './model';

/** Guess the delimiter from the first lines: the one that splits them most evenly. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/, 12).filter((line) => line.length > 0);
  let best = ',';
  let bestScore = 0;
  for (const delimiter of [',', ';', '\t', '|']) {
    const counts = lines.map((line) => line.split(delimiter).length - 1);
    const least = Math.min(...counts);
    if (least === 0) continue;
    // Prefer a delimiter that appears the same number of times on every line.
    const consistent = counts.every((count) => count === counts[0]) ? 2 : 1;
    const score = least * consistent;
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

/** Parse delimiter-separated text, honouring quoted fields (RFC 4180). */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let index = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  for (; index < text.length; index++) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else quoted = false;
      } else field += char;
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  // A final line without a trailing newline.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const NUMBER = /^-?(?:\d+(?:[.,]\d+)*|\.\d+)(?:[eE][+-]?\d+)?%?$/;

export function csvToSheet(text: string, name: string, delimiter?: string): Sheet {
  const rows = parseCsv(text, delimiter);
  let colCount = 0;
  for (const row of rows) if (row.length > colCount) colCount = row.length;

  // Size columns from a sample of rows, since CSV carries no widths.
  const colWidths = new Map<number, number>();
  const sample = Math.min(rows.length, 200);
  for (let col = 0; col < colCount; col++) {
    let longest = 0;
    for (let row = 0; row < sample; row++) {
      const length = rows[row]![col]?.length ?? 0;
      if (length > longest) longest = length;
    }
    colWidths.set(col, Math.max(64, Math.min(360, longest * 8 + 18)));
  }

  return {
    name,
    rows,
    rowCount: rows.length,
    colCount,
    numeric: new Set(),
    colWidths,
    merges: [],
  };
}

export const looksNumeric = (value: string) => NUMBER.test(value);
