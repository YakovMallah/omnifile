import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv } from '../src/csv';
import { columnLabel, parseReference } from '../src/model';
import { formatNumber, isDateFormat } from '../src/numfmt';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes and embedded newlines', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n"two\nlines",z')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['two\nlines', 'z'],
    ]);
  });

  it('accepts CRLF, a trailing newline and a byte-order mark', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('keeps empty fields', () => {
    expect(parseCsv('a,,c\n,,')).toEqual([['a', '', 'c'], ['', '', '']]);
  });

  it('detects the delimiter', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
    expect(detectDelimiter('name,note\nx,"a;b;c"')).toBe(',');
  });
});

describe('cell references', () => {
  it('converts both ways', () => {
    expect(columnLabel(0)).toBe('A');
    expect(columnLabel(25)).toBe('Z');
    expect(columnLabel(26)).toBe('AA');
    expect(columnLabel(701)).toBe('ZZ');
    expect(parseReference('A1')).toEqual({ row: 0, col: 0 });
    expect(parseReference('AB12')).toEqual({ row: 11, col: 27 });
  });
});

describe('formatNumber', () => {
  it('formats General', () => {
    expect(formatNumber(42, 'General')).toBe('42');
    expect(formatNumber(0.1 + 0.2, 'General')).toBe('0.3');
    expect(formatNumber(1234.5678, 'General')).toBe('1234.5678');
  });

  it('formats decimals, thousands and percentages', () => {
    expect(formatNumber(1234.5, '0.00')).toBe('1234.50');
    expect(formatNumber(1234567.891, '#,##0.00')).toBe('1,234,567.89');
    expect(formatNumber(0.256, '0%')).toBe('26%');
    expect(formatNumber(0.2567, '0.0%')).toBe('25.7%');
    expect(formatNumber(5, '000')).toBe('005');
    expect(formatNumber(1500000, '0.0,,"M"')).toBe('1.5M');
    expect(formatNumber(12345, '0.00E+00')).toBe('1.23E+04');
  });

  it('formats currency and negative sections', () => {
    expect(formatNumber(1234.5, '"$"#,##0.00')).toBe('$1,234.50');
    expect(formatNumber(-1234.5, '"$"#,##0.00')).toBe('-$1,234.50');
    expect(formatNumber(-1234.5, '#,##0.00;(#,##0.00)')).toBe('(1,234.50)');
    expect(formatNumber(99, '[$€-407] #,##0.00')).toBe('€ 99.00');
    expect(formatNumber(0, '0.00;-0.00;"zero"')).toBe('zero');
  });

  it('formats dates and times', () => {
    // 45000 is 15 March 2023.
    expect(formatNumber(45000, 'm/d/yyyy')).toBe('3/15/2023');
    expect(formatNumber(45000, 'yyyy-mm-dd')).toBe('2023-03-15');
    expect(formatNumber(45000, 'd-mmm-yy')).toBe('15-Mar-23');
    expect(formatNumber(45000, 'dddd, mmmm d')).toBe('Wednesday, March 15');
    expect(formatNumber(45000.75, 'yyyy-mm-dd hh:mm')).toBe('2023-03-15 18:00');
    expect(formatNumber(0.5625, 'h:mm AM/PM')).toBe('1:30 PM');
    expect(formatNumber(1.5, '[h]:mm')).toBe('36:00');
  });

  it('tells date formats from number formats', () => {
    expect(isDateFormat('m/d/yyyy')).toBe(true);
    expect(isDateFormat('h:mm:ss')).toBe(true);
    expect(isDateFormat('#,##0.00')).toBe(false);
    expect(isDateFormat('0.00" days"')).toBe(false);
    expect(isDateFormat('General')).toBe(false);
  });
});
