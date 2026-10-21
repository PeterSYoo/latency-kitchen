import { describe, expect, it } from 'vitest';
import { level02 } from '../../levels/level-02';
import { play } from './lesson-helpers';

describe('Level 2 · Rush hour', () => {
  const rates = [40, 48, 56, 64].map((r) => ({ r, ...play(level02, { arrivalRate: r }) }));

  it('fails at the default rate', () => {
    expect(play(level02, {}).passes).toBe(false);
  });

  it('passes at the target rate', () => {
    expect(rates[1].passes).toBe(true);
  });

  it('fails when turning business away', () => {
    expect(rates[0].m.p99).toBeLessThan(300);
    expect(rates[0].passes).toBe(false);
  });

  it('bends sharply past ~75% busy', () => {
    // The same 8 orders/s step costs far more p99 near the top than near the bottom.
    const [r40, r48, r56, r64] = rates.map((x) => x.m.p99);
    expect(r48 / r40).toBeLessThan(1.4);
    expect(r64 - r56).toBeGreaterThan(5 * (r48 - r40));
    const t = rates[1].m.totals;
    expect(t.busyCookMs / t.capacityCookMs).toBeLessThan(0.8);
  });
});
