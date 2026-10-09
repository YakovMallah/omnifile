import { strFromU8, unzipSync } from 'fflate';
import { cellKey, parseReference, type Merge, type Sheet, type SheetModel } from './model';
import { builtinFormat, formatGeneral, formatNumber } from './numfmt';

const parseXml = (bytes: Uint8Array | undefined): Document | undefined =>
  bytes ? new DOMParser().parseFromString(strFromU8(bytes), 'application/xml') : undefined;

/** Children by local name, ignoring the namespace prefix a writer chose. */
const children = (parent: Element | Document, name: string): Element[] => {
  const out: Element[] = [];
  const nodes = 'children' in parent ? parent.children : [];
  for (const node of nodes) if (node.localName === name) out.push(node);
  return out;
};
const child = (parent: Element | Document, name: string) => children(parent, name)[0];
const all = (parent: Element | Document, name: string) => parent.getElementsByTagNameNS('*', name);

/** Resolve a relationship target against the part that declares it. */
function resolvePath(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const segment of target.split('/')) {
    if (segment === '..') parts.pop();
    else if (segment !== '.') parts.push(segment);
  }
  return parts.join('/');
}

function readSharedStrings(doc: Document | undefined): string[] {
  if (!doc) return [];
  const strings: string[] = [];
  for (const item of all(doc, 'si')) {
    let text = '';
    // Plain strings hold one <t>; rich strings hold runs. Phonetic guides
    // (<rPh>) are reading aids and not part of the value.
    for (const node of item.getElementsByTagNameNS('*', 't')) {
      if (node.parentElement?.localName === 'rPh') continue;
      text += node.textContent ?? '';
    }
    strings.push(text);
  }
  return strings;
}

/** One format code per cell style index. */
function readNumberFormats(doc: Document | undefined): string[] {
  if (!doc) return [];
  const custom = new Map<number, string>();
  for (const node of all(doc, 'numFmt')) {
    custom.set(Number(node.getAttribute('numFmtId')), node.getAttribute('formatCode') ?? 'General');
  }
  const cellXfs = all(doc, 'cellXfs')[0];
  if (!cellXfs) return [];
  return children(cellXfs, 'xf').map((xf) => {
    const id = Number(xf.getAttribute('numFmtId') ?? 0);
    return custom.get(id) ?? builtinFormat(id);
  });
}

function readSheet(
  doc: Document,
  name: string,
  strings: string[],
  formats: string[],
  date1904: boolean,
): Sheet {
  const rows: (string | undefined)[][] = [];
  const numeric = new Set<number>();
  let colCount = 0;
  let nextRow = 0;

  const data = all(doc, 'sheetData')[0];
  for (const rowNode of data ? children(data, 'row') : []) {
    const rowIndex = rowNode.hasAttribute('r') ? Number(rowNode.getAttribute('r')) - 1 : nextRow;
    nextRow = rowIndex + 1;
    const row: (string | undefined)[] = [];
    let nextCol = 0;
    for (const cell of children(rowNode, 'c')) {
      const reference = cell.getAttribute('r');
      const col = reference ? parseReference(reference).col : nextCol;
      nextCol = col + 1;
      const type = cell.getAttribute('t') ?? 'n';
      const raw = child(cell, 'v')?.textContent ?? '';
      let text: string | undefined;

      if (type === 's') text = strings[Number(raw)] ?? '';
      else if (type === 'inlineStr') {
        text = '';
        for (const node of cell.getElementsByTagNameNS('*', 't')) text += node.textContent ?? '';
      } else if (type === 'b') text = raw === '1' ? 'TRUE' : 'FALSE';
      else if (type === 'str' || type === 'e') text = raw;
      else if (raw !== '') {
        const value = Number(raw);
        if (Number.isNaN(value)) text = raw;
        else {
          const format = formats[Number(cell.getAttribute('s') ?? 0)] ?? 'General';
          try {
            text = formatNumber(value, format, date1904);
          } catch {
            text = formatGeneral(value);
          }
          numeric.add(cellKey(rowIndex, col));
        }
      }

      if (text !== undefined && text !== '') {
        row[col] = text;
        if (col + 1 > colCount) colCount = col + 1;
      }
    }
    if (row.length > 0) rows[rowIndex] = row;
  }

  const colWidths = new Map<number, number>();
  for (const col of all(doc, 'col')) {
    const width = Number(col.getAttribute('width'));
    if (!width || col.getAttribute('hidden') === '1') continue;
    const min = Number(col.getAttribute('min')) - 1;
    // A <col> can span to the last column; only keep the ones in use.
    const max = Math.min(Number(col.getAttribute('max')) - 1, min + 512);
    // Widths are in characters of the default font; 7px is its usual digit.
    for (let index = min; index <= max; index++) colWidths.set(index, Math.round(width * 7 + 5));
  }

  const merges: Merge[] = [];
  for (const node of all(doc, 'mergeCell')) {
    const [from, to] = (node.getAttribute('ref') ?? '').split(':');
    if (!from || !to) continue;
    const start = parseReference(from);
    const end = parseReference(to);
    merges.push({
      row: start.row,
      col: start.col,
      rowSpan: end.row - start.row + 1,
      colSpan: end.col - start.col + 1,
    });
    if (end.col + 1 > colCount) colCount = end.col + 1;
  }

  return { name, rows, rowCount: rows.length, colCount, numeric, colWidths, merges };
}

/** Read every visible worksheet of an .xlsx workbook. */
export function readXlsx(bytes: Uint8Array): SheetModel {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      // Skip media, charts and everything else a grid does not show.
      filter: (file) => /\.(xml|rels)$/i.test(file.name) && !/^xl\/(media|drawings|charts|theme)\//.test(file.name),
    });
  } catch {
    throw new Error('This workbook is damaged, or protected with a password.');
  }

  const workbookPath = Object.keys(files).find((path) => /^xl\/workbook\.xml$/i.test(path)) ?? 'xl/workbook.xml';
  const workbook = parseXml(files[workbookPath]);
  if (!workbook) throw new Error('This file is not a valid Excel workbook.');

  const relsPath = workbookPath.replace(/([^/]+)$/, '_rels/$1.rels');
  const targets = new Map<string, string>();
  const rels = parseXml(files[relsPath]);
  if (rels) {
    for (const rel of all(rels, 'Relationship')) {
      targets.set(rel.getAttribute('Id') ?? '', resolvePath(workbookPath, rel.getAttribute('Target') ?? ''));
    }
  }

  const stringsPath = [...targets.values()].find((path) => /sharedStrings/i.test(path)) ?? 'xl/sharedStrings.xml';
  const stylesPath = [...targets.values()].find((path) => /styles\.xml$/i.test(path)) ?? 'xl/styles.xml';
  const strings = readSharedStrings(parseXml(files[stringsPath]));
  const formats = readNumberFormats(parseXml(files[stylesPath]));
  const date1904 = all(workbook, 'workbookPr')[0]?.getAttribute('date1904') === '1';

  const sheets: Sheet[] = [];
  for (const node of all(workbook, 'sheet')) {
    if ((node.getAttribute('state') ?? 'visible') !== 'visible') continue;
    const id =
      node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ??
      node.getAttribute('r:id') ??
      '';
    const path = targets.get(id);
    const doc = path ? parseXml(files[path]) : undefined;
    // Chart sheets and macro sheets have no cell grid.
    if (!doc || !all(doc, 'sheetData')[0]) continue;
    sheets.push(readSheet(doc, node.getAttribute('name') ?? `Sheet${sheets.length + 1}`, strings, formats, date1904));
  }
  if (sheets.length === 0) throw new Error('This workbook has no worksheets to show.');
  return { sheets };
}
