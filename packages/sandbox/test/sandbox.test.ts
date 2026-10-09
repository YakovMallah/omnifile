import { describe, expect, it } from 'vitest';
import { contentPolicy, sandboxed } from '../src/index';
import { frameDocument } from '../src/runtime';

describe('frame document', () => {
  const html = frameDocument('abc123');

  it('blocks the network and unsigned scripts', () => {
    const policy = contentPolicy('abc123');
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("script-src 'nonce-abc123' blob:");
    expect(policy).not.toMatch(/https?:|\*|unsafe-eval/);
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(html).toContain(`content="${policy}"`);
  });

  it('carries a runtime that depends on nothing outside itself', () => {
    const script = /<script nonce="abc123">([\s\S]*)<\/script>/.exec(html)?.[1] ?? '';
    expect(script.length).toBeGreaterThan(500);
    // Imports or bundler helpers would be undefined inside the frame.
    expect(script).not.toMatch(/\b__\w+\(|^\s*import\s+[\w{*]|\brequire\(/m);
    // It must not close its own <script> tag, and must be valid JavaScript.
    expect(script).not.toContain('</script');
    expect(() => new Function(script.replace(/\bimport\(/g, 'importShim('))).not.toThrow();
  });
});

describe('sandboxed', () => {
  const plugin = (frame: boolean) => ({
    id: 'test/plugin',
    formats: ['pdf'],
    load: () => Promise.reject(new Error('must not load in the host page')),
    ...(frame ? { frame: { url: 'https://example.test/frame.js' } } : {}),
  });

  it('keeps ids and formats but never loads the real plugin in the page', async () => {
    const [wrapped] = sandboxed([plugin(true)]);
    expect(wrapped!.id).toBe('test/plugin');
    expect(wrapped!.formats).toEqual(['pdf']);
    const implementation = await wrapped!.load();
    const file = { name: 'a.pdf', bytes: new Uint8Array([1, 2, 3]) } as never;
    // Parsing in the host is a no-op: the bytes are only handed on.
    expect(await implementation.parse(file, { mode: 'view', signal: new AbortController().signal })).toEqual({ file });
  });

  it('refuses a plugin that cannot be sandboxed rather than running it unprotected', () => {
    expect(() => sandboxed([plugin(false)])).toThrow(/cannot be sandboxed/);
    expect(() => sandboxed([plugin(false)], { frameUrls: { 'test/plugin': '/frame.js' } })).not.toThrow();
  });
});
