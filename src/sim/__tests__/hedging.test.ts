import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTROLS, createSim } from '../engine';
import type { SimConfig } from '../types';
import { PROTOTYPE, SEED, run } from './helpers';

describe('hedging', () => {
  // Cook 0 always stalls for 500 ms; everyone else cooks in 20 ms.
  const slowCook: SimConfig = {
    workload: {
      arrivalRate: 0.2,
      service: { median: 20, sigma: 0 },
      stalls: { p: 1, minMs: 500, maxMs: 500, scope: 'cook' },
    },
  };

  it('cancels the twin as soon as the first copy finishes', () => {
    const sim = createSim(slowCook, { ...DEFAULT_CONTROLS, cooks: 2, hedge: true, hedgeMs: 50 }, SEED);
    while (!sim.snapshot().cooks[0].ticket) sim.advanceTo(sim.now + 1);
    const arrivedAt = sim.snapshot().cooks[0].ticket!.arrivedAt;
    sim.advanceTo(arrivedAt + 60);
    const mid = sim.snapshot();
    expect(mid.cooks[1].ticket?.hedge).toBe(true);
    expect(mid.cooks[1].ticket?.orderId).toBe(mid.cooks[0].ticket?.orderId);
    sim.advanceTo(arrivedAt + 71);
    const after = sim.snapshot();
    expect(after.cooks.every((c) => !c.ticket)).toBe(true);
    const m = sim.metrics();
    expect(m.totals.completed).toBe(1);
    expect(m.max).toBeCloseTo(70, 6);
    // The winning copy's 20 ms is useful; the original's 70 ms is waste.
    expect(m.amplification).toBeCloseTo(90 / 20, 6);
  });

  it('never counts an order twice', () => {
    const sim = createSim(PROTOTYPE, { ...DEFAULT_CONTROLS, cooks: 3, hedge: true, hedgeMs: 50 }, SEED);
    for (let t = 1000; t <= 60_000; t += 1000) {
      sim.advanceTo(t);
      const snap = sim.snapshot();
      const inFlight = new Set([...snap.queue, ...snap.cooks.flatMap((c) => (c.ticket ? [c.ticket] : []))].map((x) => x.orderId));
      expect(sim.metrics().totals.completed + inFlight.size).toBe(sim.metrics().totals.arrived);
    }
  });

  it('hedges each order at most once', () => {
    const m = run(PROTOTYPE, { ...DEFAULT_CONTROLS, cooks: 3, hedge: true, hedgeMs: 1 }).metrics();
    expect(m.totals.hedges).toBeLessThanOrEqual(m.totals.arrived);
    expect(m.totals.hedges).toBeGreaterThan(m.totals.arrived * 0.95);
  });

  it('stops hedging when switched off and resumes when switched on', () => {
    const sim = createSim(PROTOTYPE, { ...DEFAULT_CONTROLS, cooks: 3, hedge: true, hedgeMs: 90 }, SEED);
    sim.advanceTo(20_000);
    sim.setControls({ hedge: false });
    sim.advanceTo(21_000); // let pending timers drain
    const off = sim.metrics().totals.hedges;
    sim.advanceTo(40_000);
    expect(sim.metrics().totals.hedges).toBe(off);
    sim.setControls({ hedge: true });
    sim.advanceTo(60_000);
    expect(sim.metrics().totals.hedges).toBeGreaterThan(off);
  });

  it('wastes no work when hedging is off', () => {
    expect(run(PROTOTYPE, { ...DEFAULT_CONTROLS, cooks: 3 }).metrics().amplification).toBeCloseTo(1, 9);
  });
});
