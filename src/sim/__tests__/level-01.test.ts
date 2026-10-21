import { describe, expect, it } from 'vitest';
import { createSim } from '../engine';
import type { Controls } from '../types';
import { level01 } from '../../levels/level-01';
import { evaluateGoal } from '../../game/goals';
import { FIRST_SEED, Session } from '../../game/session';
import { SEED, SIM_MS } from './helpers';

// Assert the teaching, not exact values. Prototype targets (seed 42):
// 3 cooks ~900 ms · 6 cooks ~840 ms · hedge 90 ms ~240 ms · hedge 50 ms ~610 ms · LIFO ~1,240 ms.
function play(patch: Partial<Controls>) {
  const controls = { ...level01.defaults, ...patch };
  const sim = createSim(level01, controls, SEED);
  sim.advanceTo(SIM_MS);
  const m = sim.metrics();
  return { m, passes: level01.goals.every((g) => evaluateGoal(g, m, controls).pass) };
}

describe('Level 1 · Fix the stragglers', () => {
  const base = play({});
  const six = play({ cooks: 6 });
  const hedge90 = play({ hedge: true, hedgeMs: 90 });
  const hedge50 = play({ hedge: true, hedgeMs: 50 });
  const lifo = play({ queueOrder: 'lifo' });

  it('fails the goal with the default 3 cooks', () => {
    expect(base.passes).toBe(false);
    expect(base.m.p99).toBeGreaterThan(250);
  });

  it('still fails with 6 cooks, within 15% of the 3-cook p99', () => {
    expect(six.m.p99).toBeGreaterThan(250);
    expect(Math.abs(six.m.p99 - base.m.p99) / base.m.p99).toBeLessThan(0.15);
  });

  it('passes with 3 cooks hedging at 90 ms', () => {
    expect(hedge90.passes).toBe(true);
  });

  it('is worse hedging at 50 ms than at 90 ms', () => {
    expect(hedge50.m.p99).toBeGreaterThan(hedge90.m.p99);
    expect(hedge50.m.amplification).toBeGreaterThan(hedge90.m.amplification);
  });

  it('LIFO helps p50 and hurts p99', () => {
    expect(lifo.m.p50).toBeLessThan(base.m.p50);
    expect(lifo.m.p99).toBeGreaterThan(base.m.p99);
  });

  it('restarts the hold on any control change', () => {
    const s = new Session(level01, FIRST_SEED, { ...level01.defaults, ...level01.solution });
    for (let i = 0; i < 120 && s.hold === 0; i++) s.advance(1000);
    expect(s.hold).toBeGreaterThan(0);
    s.setControls({ hedgeMs: 100 });
    expect(s.hold).toBe(0);
  });
});
