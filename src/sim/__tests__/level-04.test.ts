import { describe, expect, it } from 'vitest';
import { createSim } from '../engine';
import { level04 } from '../../levels/level-04';
import { SEED } from './helpers';
import { earn, play } from './lesson-helpers';

describe('Level 4 · The walk-in fridge', () => {
  it('cannot keep up with three cooks and no cache, shedding or not', () => {
    expect(play(level04, {}).passes).toBe(false);
    expect(earn(level04, { shed: true, shedMax: 8 }).cleared).toBe(false);
  });

  it('cache with two cooks is fine between bursts and fails across them', () => {
    expect(earn(level04, { cooks: 2, cache: true }).cleared).toBe(false);
    expect(play(level04, { cooks: 2, cache: true }).m.p99).toBeGreaterThan(200);
  });

  it('loses hit rate during a burst', () => {
    const sim = createSim(level04, { ...level04.defaults, cooks: 2, cache: true }, SEED);
    sim.advanceTo(7_000);
    const calm = sim.metrics().cacheHitRate;
    sim.advanceTo(11_000);
    const burst = sim.metrics().cacheHitRate;
    expect(calm).toBeGreaterThan(0.5);
    expect(burst).toBeLessThan(0.45);
  });

  it('counts the cache against the three slots', () => {
    expect(earn(level04, { cooks: 3, cache: true, shed: true, shedMax: 6 }).cleared).toBe(false);
  });
});
