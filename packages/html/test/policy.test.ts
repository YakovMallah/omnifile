import { describe, expect, it } from 'vitest';
import { withContentPolicy } from '../src/impl';

const META = '<meta http-equiv="Content-Security-Policy"';

describe('withContentPolicy', () => {
  it('puts the policy first inside an existing head', () => {
    const out = withContentPolicy('<!doctype html><html><head><title>x</title></head><body></body></html>');
    expect(out).toContain(`<head>${META}`);
    expect(out.startsWith('<!doctype html>')).toBe(true);
  });

  it('adds a head when the page has none', () => {
    expect(withContentPolicy('<html><body>hi</body></html>')).toContain(`<html><head>${META}`);
  });

  it('keeps the doctype first for a bare fragment', () => {
    expect(withContentPolicy('<!DOCTYPE html><p>hi</p>')).toMatch(/^<!DOCTYPE html><meta http-equiv/);
    expect(withContentPolicy('<p>hi</p>').startsWith(META)).toBe(true);
  });

  it('blocks every network source', () => {
    const policy = /content="([^"]+)"/.exec(withContentPolicy('<p>hi</p>'))![1]!;
    expect(policy).toContain("default-src 'none'");
    expect(policy).not.toMatch(/https?:|\*/);
  });
});
