import { definePlugin, type OmniPlugin } from '@omnifile/core';
import type { SheetModel } from './model';

export type { Merge, Sheet, SheetModel } from './model';
export { columnLabel } from './model';
export { detectDelimiter, parseCsv } from './csv';
export { formatNumber, isDateFormat, serialToDate } from './numfmt';

/**
 * Spreadsheets in a scrolling grid: Excel workbooks (.xlsx) with all their
 * sheets, and CSV or TSV files. Values, dates and number formats are shown;
 * cell colours, fonts, charts and images are not. Formulas show the result
 * that was saved in the file.
 */
export function sheet(): OmniPlugin<SheetModel> {
  return definePlugin({
    id: 'omnifile/sheet',
    formats: ['xlsx', 'csv', 'tsv'],
    load: () => import('./impl').then((module) => module.implementation),
    frame: { url: () => new URL('./frame.js', import.meta.url).href },
  });
}
