import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readZipDirectory } from '../src/zip';

describe('readZipDirectory', () => {
  it('lists entries with their sizes without extracting them', () => {
    const bytes = zipSync({
      'readme.txt': strToU8('hello world'),
      'docs/': new Uint8Array(0),
      'docs/data.csv': strToU8('a,b\n'.repeat(500)),
    });
    const entries = readZipDirectory(bytes);
    expect(entries.map((entry) => entry.name)).toEqual(['readme.txt', 'docs/', 'docs/data.csv']);
    expect(entries[0]).toMatchObject({ size: 11, directory: false, encrypted: false });
    expect(entries[1]!.directory).toBe(true);
    expect(entries[2]!.size).toBe(2000);
    expect(entries[2]!.compressedSize).toBeLessThan(200);
    expect(entries[0]!.modified).toBeInstanceOf(Date);
  });

  it('reads UTF-8 names', () => {
    const entries = readZipDirectory(zipSync({ 'שלום.txt': strToU8('x') }));
    expect(entries[0]!.name).toBe('שלום.txt');
  });

  it('rejects data that is not a ZIP', () => {
    expect(() => readZipDirectory(strToU8('not a zip archive at all, just text'))).toThrow(/damaged/);
  });
});
