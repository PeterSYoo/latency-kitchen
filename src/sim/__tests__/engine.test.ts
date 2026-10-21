import { describe, expect, it } from 'vitest';
import { createSim } from '../engine';
import type { SimConfig } from '../types';
import { DEFAULT_CONTROLS } from '../engine';
import { PROTOTYPE, SEED, SIM_MS, run } from './helpers';

const FIFO3 = { ...DEFAULT_CONTROLS, cooks: 3, queueOrder: 'fifo' as const };

describe('determinism', () => {
  it('gives identical metrics for the same seed and controls', () => {
    const a = run(PROTOTYPE, FIFO3).metrics();
    const b = run(PROTOTYPE, FIFO3).metrics();
    expect(a).toEqual(b);
  });

  it('changes with a different seed', () => {
    const a = run(PROTOTYPE, FIFO3, 1).metrics();
    const b = run(PROTOTYPE, FIFO3, 2).metrics();
    expect(a.p99).not.toBe(b.p99);
    expect(a.totals.arrived).not.toBe(b.totals.arrived);
  });

  it('does not depend on how time is advanced', () => {
    const whole = run(PROTOTYPE, FIFO3).metrics();
    const sim = createSim(PROTOTYPE, FIFO3, SEED);
    for (let t = 16; t <= SIM_MS; t += 16) sim.advanceTo(t);
    sim.advanceTo(SIM_MS);
    const stepped = sim.metrics();
    // Event outcomes match exactly; time integrals only up to float rounding.
    const { totals: a, utilization: ua, ...restA } = stepped;
    const { totals: b, utilization: ub, ...restB } = whole;
    expect(restA).toEqual(restB);
    expect(ua).toBeCloseTo(ub, 9);
    for (const k of Object.keys(a) as (keyof typeof a)[]) expect(a[k]).toBeCloseTo(b[k], 6);
  });

  it('keeps the arrival sequence when queue order changes', () => {
    const fifo = run(PROTOTYPE, FIFO3).metrics();
    const lifo = run(PROTOTYPE, { ...FIFO3, queueOrder: 'lifo' }).metrics();
    expect(lifo.totals.arrived).toBe(fifo.totals.arrived);
  });
});

describe('queueing theory', () => {
  it("satisfies Little's law for the queue within 5%", () => {
    const t = run(PROTOTYPE, FIFO3).metrics().totals;
    const avgQueue = t.queueLenMs / t.elapsedMs;
    const lambdaPerMs = t.arrived / t.elapsedMs;
    const avgWait = t.waitSumMs / t.waitCount;
    expect(avgQueue).toBeGreaterThan(0.1);
    expect(Math.abs(avgQueue - lambdaPerMs * avgWait) / avgQueue).toBeLessThan(0.05);
  });

  it('matches M/M/1 mean latency at 70% busy within 5%', () => {
    const meanService = 1; // ms
    const rho = 0.7;
    const mm1: SimConfig = {
      workload: { arrivalRate: (rho / meanService) * 1000, service: { dist: 'exponential', mean: meanService } },
    };
    const m = run(mm1, { ...DEFAULT_CONTROLS, cooks: 1, queueOrder: 'fifo' }).metrics();
    const expected = meanService / (1 - rho);
    const observed = m.totals.latencySumMs / m.totals.completed;
    expect(Math.abs(observed - expected) / expected).toBeLessThan(0.05);
    expect(Math.abs(m.utilization - rho)).toBeLessThan(0.1);
  });

  it('serves the offered arrival rate', () => {
    const t = run(PROTOTYPE, FIFO3).metrics().totals;
    const rate = (t.arrived / t.elapsedMs) * 1000;
    expect(Math.abs(rate - 30) / 30).toBeLessThan(0.03);
  });
});

describe('workers and queue order', () => {
  const steady: SimConfig = { workload: { arrivalRate: 1, service: { median: 100, sigma: 0 } } };

  it('serves FIFO in arrival order and LIFO newest first', () => {
    for (const queueOrder of ['fifo', 'lifo'] as const) {
      const sim = createSim(steady, { ...DEFAULT_CONTROLS, cooks: 0, queueOrder }, SEED);
      sim.advanceTo(10_000);
      const queued = sim.snapshot().queue.map((q) => q.orderId);
      expect(queued.length).toBeGreaterThan(3);
      sim.setControls({ cooks: 1 });
      const first = sim.snapshot().cooks[0].ticket!.orderId;
      expect(first).toBe(queueOrder === 'fifo' ? queued[0] : queued[queued.length - 1]);
    }
  });

  it('returns a removed busy cook’s ticket to the front of the queue', () => {
    const sim = createSim(steady, { ...DEFAULT_CONTROLS, cooks: 0, queueOrder: 'fifo' }, SEED);
    sim.advanceTo(10_000);
    sim.setControls({ cooks: 1 });
    const taken = sim.snapshot().cooks[0].ticket!.orderId;
    sim.advanceTo(sim.now + 30);
    sim.setControls({ cooks: 0 });
    const snap = sim.snapshot();
    expect(snap.cooks).toHaveLength(0);
    expect(snap.queue[0].orderId).toBe(taken);
  });

  it('never runs more tickets than cooks', () => {
    const sim = createSim(PROTOTYPE, FIFO3, SEED);
    for (let t = 0; t < 20_000; t += 50) {
      sim.advanceTo(t);
      const busy = sim.snapshot().cooks.filter((c) => c.ticket).length;
      expect(busy).toBeLessThanOrEqual(3);
      if (sim.snapshot().queue.length > 0) expect(busy).toBe(3);
    }
  });

  it('follows the arrival-rate control', () => {
    const sim = createSim(PROTOTYPE, { ...FIFO3, arrivalRate: 10 }, SEED);
    sim.advanceTo(45_000);
    const slow = sim.metrics().totals.arrived;
    sim.setControls({ arrivalRate: 50 });
    sim.advanceTo(90_000);
    const fast = sim.metrics().totals.arrived - slow;
    expect(slow / 45).toBeGreaterThan(8);
    expect(slow / 45).toBeLessThan(12);
    expect(fast / 45).toBeGreaterThan(45);
    expect(fast / 45).toBeLessThan(55);
  });

  it('applies bursts as a rate multiplier', () => {
    const bursty: SimConfig = {
      workload: { ...PROTOTYPE.workload, bursts: [{ atMs: 30_000, durationMs: 30_000, multiplier: 3 }] },
    };
    const sim = createSim(bursty, { ...DEFAULT_CONTROLS, cooks: 50, queueOrder: 'fifo' }, SEED);
    sim.advanceTo(30_000);
    const before = sim.metrics().totals.arrived;
    sim.advanceTo(60_000);
    const during = sim.metrics().totals.arrived - before;
    expect(during / before).toBeGreaterThan(2.6);
    expect(during / before).toBeLessThan(3.4);
  });
});

describe('stalls', () => {
  it('per-request stalls hit about p of orders', () => {
    const m = run(PROTOTYPE, { ...DEFAULT_CONTROLS, cooks: 50, queueOrder: 'fifo' }).metrics();
    // With no queueing, p99 sits inside the stalled 4%.
    expect(m.p95).toBeLessThan(150);
    expect(m.p99).toBeGreaterThan(350);
  });

  it('per-cook stalls only slow cook 0', () => {
    const cfg: SimConfig = {
      workload: {
        arrivalRate: 20,
        service: { median: 20, sigma: 0 },
        stalls: { p: 1, minMs: 500, maxMs: 500, scope: 'cook' },
      },
    };
    const sim = createSim(cfg, { ...DEFAULT_CONTROLS, cooks: 4, queueOrder: 'fifo' }, SEED);
    for (let t = 0; t < 10_000; t += 7) {
      sim.advanceTo(t);
      for (const c of sim.snapshot().cooks) {
        if (c.ticket) expect(c.ticket.stallMs).toBe(c.id === 0 ? 500 : 0);
      }
    }
  });

  it('global stalls freeze every cook and stretch latency', () => {
    const gc: SimConfig = {
      workload: {
        arrivalRate: 30,
        service: { median: 38, sigma: 0.3 },
        stalls: { p: 1, minMs: 400, maxMs: 400, scope: 'global', everyMs: 5000 },
      },
    };
    const sim = createSim(gc, { ...DEFAULT_CONTROLS, cooks: 6, queueOrder: 'fifo' }, SEED);
    sim.advanceTo(5_100);
    const snap = sim.snapshot();
    expect(snap.globalStall).toBe(true);
    expect(snap.cooks.every((c) => c.stalled)).toBe(true);
    const doneBefore = sim.metrics().totals.completed;
    sim.advanceTo(5_350);
    expect(sim.metrics().totals.completed).toBe(doneBefore);
    sim.advanceTo(SIM_MS);
    const m = sim.metrics();
    expect(m.p999).toBeGreaterThan(400);
    // A pause isn't wasted work.
    expect(m.amplification).toBeCloseTo(1, 5);
  });
});

describe('metrics', () => {
  it('reports utilization', () => {
    const m = run(PROTOTYPE, FIFO3).metrics();
    // ~30/s × ~69 ms mean cost ≈ 2.1 cooks of 3.
    const overall = m.totals.busyCookMs / m.totals.capacityCookMs;
    expect(overall).toBeGreaterThan(0.6);
    expect(overall).toBeLessThan(0.75);
    // The last-second figure swings with stalls but stays a fraction.
    expect(m.utilization).toBeGreaterThanOrEqual(0);
    expect(m.utilization).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('fills a 1,500-order window and a 48-bin histogram', () => {
    const m = run(PROTOTYPE, FIFO3).metrics();
    expect(m.count).toBe(1500);
    expect(m.histogram.reduce((a, b) => a + b, 0)).toBe(1500);
    expect(m.mean).toBeLessThan(m.p99);
    expect(m.p50).toBeLessThanOrEqual(m.p95);
    expect(m.p99).toBeLessThanOrEqual(m.p999);
  });
});
