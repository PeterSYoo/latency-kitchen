import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTROLS, createSim } from '../engine';
import type { Controls, SimConfig } from '../types';
import { SEED, SIM_MS, run } from './helpers';

const base = (patch: Partial<Controls>): Controls => ({ ...DEFAULT_CONTROLS, ...patch });

describe('fan-out', () => {
  const fan: SimConfig = {
    workload: {
      arrivalRate: 20,
      service: { median: 20, sigma: 0.4 },
      stalls: { p: 0.01, minMs: 400, maxMs: 900, scope: 'request' },
      fanOut: { k: 10 },
    },
  };

  it('waits for the slowest of k dishes, so root p50 sits far above leaf p50', () => {
    const m = run(fan, base({ cooks: 12 })).metrics();
    expect(m.p50).toBeGreaterThan(m.leafP50 * 1.3);
    expect(m.p99).toBeGreaterThan(m.leafP99);
    // ~10% of orders hit a 1% leaf stall, so the root p95 is stalled.
    expect(m.p95).toBeGreaterThan(400);
  });

  it('serves at the quorum and cancels the leftover dishes', () => {
    const sim = createSim(fan, base({ cooks: 12, quorum: 9 }), SEED);
    for (let t = 1000; t <= 30_000; t += 500) {
      sim.advanceTo(t);
      const snap = sim.snapshot();
      const tickets = [...snap.queue, ...snap.cooks.flatMap((c) => (c.ticket ? [c.ticket] : []))];
      expect(tickets.filter((x) => x.abandoned)).toEqual([]);
    }
    const m = sim.metrics();
    expect(m.p99).toBeLessThan(400);
    // The skipped tenth dish is wasted work.
    expect(m.amplification).toBeGreaterThan(1.02);
  });

  it('hedges only the dishes still missing', () => {
    const m = run(fan, base({ cooks: 12, hedge: true, hedgeMs: 60 })).metrics();
    expect(m.totals.hedges).toBeGreaterThan(0);
    expect(m.totals.hedges).toBeLessThan(m.totals.arrived * 10 * 0.5);
    expect(m.p99).toBeLessThan(run(fan, base({ cooks: 12 })).metrics().p99);
  });

  it('counts each order once however many dishes it has', () => {
    const sim = createSim(fan, base({ cooks: 12 }), SEED);
    sim.advanceTo(SIM_MS);
    const snap = sim.snapshot();
    const open = new Set([...snap.queue, ...snap.cooks.flatMap((c) => (c.ticket ? [c.ticket] : []))].map((x) => x.orderId));
    const t = sim.metrics().totals;
    expect(t.completed + open.size).toBe(t.arrived);
  });

  it('runs 90 simulated seconds of Level 6 in under 200 ms', async () => {
    const { level06 } = await import('../../levels/level-06');
    const t0 = performance.now();
    const sim = createSim(level06, level06.defaults, SEED);
    sim.advanceTo(SIM_MS);
    sim.metrics();
    expect(performance.now() - t0).toBeLessThan(200);
  });
});

describe('staggered pauses', () => {
  const gc: SimConfig = {
    workload: {
      arrivalRate: 40,
      service: { median: 30, sigma: 0.3 },
      stalls: { p: 1, minMs: 700, maxMs: 1300, scope: 'global', everyMs: 5000 },
    },
  };
  const maxPaused = (staggerPauses: boolean) => {
    const sim = createSim(gc, base({ cooks: 6, staggerPauses }), SEED);
    let most = 0;
    for (let t = 0; t <= 30_000; t += 50) {
      sim.advanceTo(t);
      // No per-ticket stalls in this workload, so "stalled" means paused.
      most = Math.max(most, sim.snapshot().cooks.filter((c) => c.stalled).length);
    }
    return most;
  };

  it('freezes every cook together when synchronised', () => {
    expect(maxPaused(false)).toBe(6);
  });

  it('never freezes every cook at once when staggered', () => {
    const most = maxPaused(true);
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThan(6);
  });

  it('lets hedging route around a paused cook only when staggered', () => {
    const sync = run(gc, base({ cooks: 6, hedge: true, hedgeMs: 100 }), SEED, SIM_MS).metrics();
    const stag = run(gc, base({ cooks: 6, staggerPauses: true, hedge: true, hedgeMs: 100 }), SEED, SIM_MS).metrics();
    expect(sync.p999).toBeGreaterThan(700);
    expect(stag.p999).toBeLessThan(400);
  });

  it('resumes paused cooks when switching pattern mid-pause', () => {
    const sim = createSim(gc, base({ cooks: 6 }), SEED);
    sim.advanceTo(5_200);
    expect(sim.snapshot().globalStall).toBe(true);
    sim.setControls({ staggerPauses: true });
    const snap = sim.snapshot();
    expect(snap.globalStall).toBe(false);
    expect(snap.cooks.some((c) => !c.stalled)).toBe(true);
  });
});
