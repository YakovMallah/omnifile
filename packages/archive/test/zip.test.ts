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

describe('buildTree', () => {
  const entry = (name: string, size = 0) => ({
    name,
    directory: name.endsWith('/'),
    size,
    compressedSize: Math.ceil(size / 2),
    modified: undefined,
    encrypted: false,
  });

  it('nests files under folders, creating folders that have no entry of their own', async () => {
    const { buildTree } = await import('../src/tree');
    const root = buildTree([
      entry('src/app/main.ts', 100),
      entry('src/app/util.ts', 50),
      entry('src/index.ts', 10),
      entry('README.md', 5),
      entry('empty/'),
    ]);
    expect(root.children.map((node) => node.name)).toEqual(['empty', 'src', 'README.md']);
    const src = root.children[1]!;
    expect(src.children.map((node) => node.name)).toEqual(['app', 'index.ts']);
    expect(src.children[0]!.children.map((node) => node.path)).toEqual(['src/app/main.ts', 'src/app/util.ts']);
    expect(src).toMatchObject({ size: 160, compressedSize: 80, fileCount: 3, directory: true });
    expect(root).toMatchObject({ size: 165, fileCount: 4 });
    expect(root.children[0]).toMatchObject({ directory: true, fileCount: 0, children: [] });
  });

  it('sorts folders first and names naturally, and accepts backslashes', async () => {
    const { buildTree } = await import('../src/tree');
    const root = buildTree([entry('file10.txt', 1), entry('file2.txt', 1), entry('b\\inner.txt', 1), entry('./a/x.txt', 1)]);
    expect(root.children.map((node) => node.name)).toEqual(['a', 'b', 'file2.txt', 'file10.txt']);
    expect(root.children[1]!.children[0]!.path).toBe('b/inner.txt');
  });
});
