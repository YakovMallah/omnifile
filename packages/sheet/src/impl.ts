import { decodeText, type PluginImplementation } from '@omnifile/core';
import { csvToSheet } from './csv';
import { renderGrid } from './grid';
import type { SheetModel } from './model';
import { readXlsx } from './xlsx';

export const implementation: PluginImplementation<SheetModel> = {
  parse(file) {
    if (file.format.id === 'xlsx') return readXlsx(file.bytes);
    const { text } = decodeText(file.bytes);
    const name = file.name.replace(/\.[^.]+$/, '');
    return { sheets: [csvToSheet(text, name, file.format.id === 'tsv' ? '\t' : undefined)] };
  },

  render(model, { container }) {
    return renderGrid(model, container);
  },
};
