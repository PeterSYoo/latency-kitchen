import { describe, expect, it } from 'vitest';
import { exponential, lognormal, mulberry32, stream } from '../rng';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('gives independent named streams', () => {
    const a = stream(42, 'arrivals');
    const b = stream(42, 'service');
    expect(a.next()).not.toBe(b.next());
  });

  it('draws uniforms in [0, 1) with the right mean', () => {
    const r = mulberry32(1);
    let sum = 0;
    for (let i = 0; i < 100_000; i++) {
      const u = r.next();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      sum += u;
    }
    expect(sum / 100_000).toBeCloseTo(0.5, 2);
  });

  it('matches exponential and lognormal moments', () => {
    const r = mulberry32(3);
    const n = 200_000;
    let exp = 0;
    const logs: number[] = [];
    for (let i = 0; i < n; i++) {
      exp += exponential(r, 10);
      logs.push(lognormal(r, 38, 0.5));
    }
    expect(exp / n).toBeCloseTo(10, 0);
    logs.sort((x, y) => x - y);
    expect(logs[n / 2]).toBeGreaterThan(37);
    expect(logs[n / 2]).toBeLessThan(39);
  });
});
