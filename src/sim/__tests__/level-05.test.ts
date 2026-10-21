import { describe, expect, it } from 'vitest';
import { level05 } from '../../levels/level-05';
import { SEED } from './helpers';
import { earn, play } from './lesson-helpers';

describe('Level 5 · Give up and try again', () => {
  it('fails with no timeouts, and adding a cook does not help', () => {
    const base = play(level05, {});
    const more = play(level05, { cooks: 6 });
    expect(base.passes).toBe(false);
    expect(more.m.p99).toBeGreaterThan(300);
  });

  it('retries without cancellation start a retry storm', () => {
    // A storm is metastable: switching retries on mid-service, as a player does,
    // retries every order older than the timeout at once, and the abandoned
    // work never stops.
    const s = earn(level05, { timeout: true, timeoutMs: 120 }, 90, SEED);
    expect(s.cleared).toBe(false);
    expect(s.metrics.errorRate).toBeGreaterThan(0.2);
    expect(s.metrics.amplification).toBeGreaterThan(1.3);
  });

  it('retries with cancellation pass', () => {
    const ok = play(level05, { timeout: true, timeoutMs: 120, cancel: true });
    expect(ok.m.p99).toBeLessThan(300);
    expect(ok.m.amplification).toBeLessThan(1.3);
  });
});
