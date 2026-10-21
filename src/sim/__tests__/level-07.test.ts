import { describe, expect, it } from 'vitest';
import { level07 } from '../../levels/level-07';
import { earn, play } from './lesson-helpers';

describe('Level 7 · Everyone freezes', () => {
  it('fails as is, with hedging, and with more cooks', () => {
    expect(play(level07, {}).passes).toBe(false);
    expect(earn(level07, { hedge: true, hedgeMs: 100 }).cleared).toBe(false);
    expect(play(level07, { cooks: 12 }).m.p999).toBeGreaterThan(1000);
  });

  it('hedging cannot help when every cook freezes', () => {
    const plain = play(level07, {}).m.p999;
    const hedged = play(level07, { hedge: true, hedgeMs: 100 }).m.p999;
    expect(hedged).toBeGreaterThan(plain * 0.85);
  });

  it('staggering alone fixes p99 but not p99.9', () => {
    const s = earn(level07, { staggerPauses: true }, 120);
    expect(s.cleared).toBe(false);
    expect(s.metrics.p99).toBeLessThan(300);
  });

  it('staggering plus hedging clears', () => {
    expect(play(level07, { staggerPauses: true, hedge: true, hedgeMs: 100 }).passes).toBe(true);
  });
});
