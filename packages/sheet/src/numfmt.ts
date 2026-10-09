/**
 * A compact implementation of Excel number formats: enough to show dates,
 * times, decimals, thousands separators, percentages and currencies the way
 * the spreadsheet's author set them. Rare features (fractions, conditional
 * sections, locale-specific calendars) fall back to a plain number.
 */

const BUILTIN: Record<number, string> = {
  0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%',
  11: '0.00E+00', 12: '# ?/?', 13: '# ??/??', 14: 'm/d/yyyy', 15: 'd-mmm-yy', 16: 'd-mmm',
  17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss',
  22: 'm/d/yyyy h:mm', 37: '#,##0;(#,##0)', 38: '#,##0;(#,##0)', 39: '#,##0.00;(#,##0.00)',
  40: '#,##0.00;(#,##0.00)', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mm:ss.0', 48: '##0.0E+0',
  49: '@',
};

export function builtinFormat(id: number): string {
  return BUILTIN[id] ?? 'General';
}

type Token = { kind: 'literal'; text: string } | { kind: 'code'; text: string };

/** Split one format section into literal text and format codes. */
function tokenize(section: string): Token[] {
  const tokens: Token[] = [];
  const push = (kind: Token['kind'], text: string) => {
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind && kind === 'literal') last.text += text;
    else tokens.push({ kind, text });
  };
  for (let index = 0; index < section.length; index++) {
    const char = section[index]!;
    if (char === '"') {
      const end = section.indexOf('"', index + 1);
      push('literal', section.slice(index + 1, end === -1 ? undefined : end));
      index = end === -1 ? section.length : end;
    } else if (char === '\\') {
      push('literal', section[++index] ?? '');
    } else if (char === '_') {
      push('literal', ' ');
      index++;
    } else if (char === '*') {
      index++;
    } else if (char === '[') {
      const end = section.indexOf(']', index);
      const inner = section.slice(index + 1, end === -1 ? undefined : end);
      // [$€-407] carries a currency symbol; [Red] and [>100] carry none.
      if (inner.startsWith('$')) push('literal', inner.slice(1).split('-')[0]!);
      else if (/^h+$|^m+$|^s+$/i.test(inner)) tokens.push({ kind: 'code', text: `[${inner}]` });
      index = end === -1 ? section.length : end;
    } else {
      tokens.push({ kind: 'code', text: char });
    }
  }
  return tokens;
}

function splitSections(format: string): string[] {
  const sections: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < format.length; index++) {
    const char = format[index]!;
    if (char === '"') quoted = !quoted;
    if (char === '\\' && !quoted) {
      current += char + (format[++index] ?? '');
      continue;
    }
    if (char === ';' && !quoted) {
      sections.push(current);
      current = '';
    } else current += char;
  }
  sections.push(current);
  return sections;
}

const codesOf = (tokens: Token[]) =>
  tokens.filter((token) => token.kind === 'code').map((token) => token.text).join('');

export function isDateFormat(format: string): boolean {
  if (/^general$/i.test(format)) return false;
  const codes = codesOf(tokenize(splitSections(format)[0]!)).replace(/AM\/PM|A\/P/gi, '');
  return /[ymdhs]/i.test(codes) && !/[0#?]/.test(codes.replace(/\[[^\]]*\]/g, '').replace(/\.0+/g, ''));
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/** Excel serial date to a UTC Date. Day 25569 is 1 January 1970. */
export function serialToDate(serial: number, date1904 = false): Date {
  const days = date1904 ? serial + 1462 : serial;
  return new Date(Math.round((days - 25569) * 86_400_000));
}

function formatDate(serial: number, section: string, date1904: boolean): string {
  const date = serialToDate(serial, date1904);
  const tokens = tokenize(section);
  // Group runs of the same letter: "yyyy", "mm", "AM/PM".
  const parts: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    if (token.kind === 'literal' || token.text.startsWith('[')) {
      parts.push(token);
      continue;
    }
    const rest = tokens.slice(index).map((item) => (item.kind === 'code' ? item.text : '\u0000')).join('');
    const meridiem = /^(AM\/PM|A\/P)/i.exec(rest);
    if (meridiem) {
      parts.push({ kind: 'code', text: meridiem[1]!.toUpperCase() });
      index += meridiem[1]!.length - 1;
      continue;
    }
    let run = token.text;
    while (tokens[index + 1]?.kind === 'code' && tokens[index + 1]!.text.toLowerCase() === token.text.toLowerCase()) {
      run += tokens[++index]!.text;
    }
    parts.push({ kind: 'code', text: run });
  }

  const twelveHour = parts.some((part) => part.kind === 'code' && /^(AM\/PM|A\/P)$/.test(part.text));
  const hours = date.getUTCHours();
  let out = '';
  parts.forEach((part, index) => {
    if (part.kind === 'literal') {
      out += part.text;
      return;
    }
    const code = part.text.toLowerCase();
    const first = code[0]!;
    if (code === 'am/pm') out += hours < 12 ? 'AM' : 'PM';
    else if (code === 'a/p') out += hours < 12 ? 'A' : 'P';
    else if (code.startsWith('[h')) out += String(Math.floor(serial * 24));
    else if (code.startsWith('[m')) out += String(Math.floor(serial * 1440));
    else if (code.startsWith('[s')) out += String(Math.round(serial * 86400));
    else if (first === 'y') out += code.length <= 2 ? pad(date.getUTCFullYear() % 100) : String(date.getUTCFullYear());
    else if (first === 'd') {
      if (code.length === 1) out += String(date.getUTCDate());
      else if (code.length === 2) out += pad(date.getUTCDate());
      else if (code.length === 3) out += DAYS[date.getUTCDay()]!.slice(0, 3);
      else out += DAYS[date.getUTCDay()];
    } else if (first === 'h') {
      const shown = twelveHour ? hours % 12 || 12 : hours;
      out += code.length === 1 ? String(shown) : pad(shown);
    } else if (first === 's') {
      out += code.length === 1 ? String(date.getUTCSeconds()) : pad(date.getUTCSeconds());
    } else if (first === 'm') {
      // "m" means minutes when it follows hours or precedes seconds.
      const codes = parts.filter((item) => item.kind === 'code' && /^\[?[ymdhs]/i.test(item.text));
      const at = codes.indexOf(part);
      const previous = codes[at - 1]?.text.toLowerCase() ?? '';
      const next = codes[at + 1]?.text.toLowerCase() ?? '';
      const minutes = previous.startsWith('h') || previous.startsWith('[h') || next.startsWith('s');
      if (minutes) out += code.length === 1 ? String(date.getUTCMinutes()) : pad(date.getUTCMinutes());
      else if (code.length === 1) out += String(date.getUTCMonth() + 1);
      else if (code.length === 2) out += pad(date.getUTCMonth() + 1);
      else if (code.length === 3) out += MONTHS[date.getUTCMonth()]!.slice(0, 3);
      else if (code.length === 5) out += MONTHS[date.getUTCMonth()]![0];
      else out += MONTHS[date.getUTCMonth()];
    } else if (first === '.' || first === '0') {
      // Fractional seconds: ".0" after "ss".
      if (first === '0' && parts[index - 1]?.text === '.') out += String(Math.floor(date.getUTCMilliseconds() / 100));
      else out += part.text;
    } else out += part.text;
  });
  return out;
}

export function formatGeneral(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value);
  const rounded = Number(value.toPrecision(11));
  const abs = Math.abs(rounded);
  return abs !== 0 && (abs >= 1e11 || abs < 1e-9) ? rounded.toExponential().replace('e', 'E') : String(rounded);
}

function formatDecimal(value: number, section: string): string {
  const tokens = tokenize(section);
  const codes = codesOf(tokens);
  if (!/[0#?]/.test(codes)) {
    // A section with no digit placeholders is literal text (or General).
    return /general/i.test(codes) ? formatGeneral(value) : tokens.map((token) => (token.kind === 'literal' ? token.text : '')).join('');
  }
  if (/\//.test(codes)) return formatGeneral(value);

  let number = Math.abs(value);
  const percent = (codes.match(/%/g) ?? []).length;
  number *= 100 ** percent;
  const digits = codes.replace(/[^0#?.,Ee+-]/g, '');
  const exponent = /E[+-]/i.test(digits);
  const [integerPart = '', fractionPart = ''] = digits.split(/E/i)[0]!.split('.');
  // Commas after the last digit placeholder each divide by a thousand.
  const scale = /,+$/.exec(fractionPart || integerPart)?.[0].length ?? 0;
  number /= 1000 ** scale;
  const grouping = /[0#?],[0#?]/.test(integerPart);
  const maxDecimals = (fractionPart.match(/[0#?]/g) ?? []).length;
  const minDecimals = (fractionPart.match(/0/g) ?? []).length;
  const minIntegers = Math.max(1, (integerPart.match(/0/g) ?? []).length);

  let body: string;
  if (exponent) {
    body = number
      .toExponential(maxDecimals)
      .replace(/e([+-])(\d+)$/, (_, sign: string, power: string) => `E${sign}${power.padStart(2, '0')}`);
  } else {
    body = new Intl.NumberFormat('en-US', {
      useGrouping: grouping,
      minimumIntegerDigits: Math.min(minIntegers, 21),
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: Math.min(maxDecimals, 20),
    }).format(number);
  }

  // Lay the number where the first digit placeholder was; keep literals.
  let out = '';
  let placed = false;
  for (const token of tokens) {
    if (token.kind === 'literal') out += token.text;
    else if (/[0#?.,]/.test(token.text) || (exponent && /[Ee+-]/.test(token.text))) {
      if (!placed) out += body;
      placed = true;
    } else out += token.text;
  }
  return out;
}

/** Format a numeric cell value with an Excel format code. */
export function formatNumber(value: number, format: string, date1904 = false): string {
  if (!format || /^general$/i.test(format)) return formatGeneral(value);
  if (format === '@') return formatGeneral(value);
  const sections = splitSections(format);
  if (isDateFormat(format)) {
    return value < 0 ? formatGeneral(value) : formatDate(value, sections[0]!, date1904);
  }
  let section = sections[0]!;
  let negative = value < 0;
  if (value < 0 && sections[1] !== undefined) {
    section = sections[1];
    negative = false; // the section itself supplies the sign or parentheses
  } else if (value === 0 && sections[2] !== undefined) {
    section = sections[2];
  }
  const text = formatDecimal(value, section);
  return negative ? `-${text}` : text;
}
