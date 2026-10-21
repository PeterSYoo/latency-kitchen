import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTROLS, createSim } from '../engine';
import type { Controls, SimConfig } from '../types';
import { PROTOTYPE, SEED, SIM_MS, run } from './helpers';

const base = (patch: Partial<Controls>): Controls => ({ ...DEFAULT_CONTROLS, ...patch });

describe('load shedding', () => {
  // 3 cooks at ~110% load: without shedding the queue grows without bound.
  const overload: SimConfig = { workload: { arrivalRate: 75, service: { median: 40, sigma: 0.4 } } };

  it('never lets the queue exceed shedMax', () => {
    const sim = createSim(overload, base({ cooks: 3, shed: true, shedMax: 8 }), SEED);
    for (let t = 0; t <= SIM_MS; t += 25) {
      sim.advanceTo(t);
      expect(sim.snapshot().queue.length).toBeLessThanOrEqual(8);
    }
    expect(sim.metrics().totals.dropped).toBeGreaterThan(0);
  });

  it('counts rejections as errors', () => {
    const m = run(overload, base({ cooks: 3, shed: true, shedMax: 8 })).metrics();
    expect(m.errorRate).toBeGreaterThan(0.02);
    const unshed = run(overload, base({ cooks: 3 })).metrics();
    expect(unshed.errorRate).toBe(0);
    expect(m.p99).toBeLessThan(unshed.p99);
  });
});

describe('timeouts and retries', () => {
  // Cook 0 is slow on every ticket; a retry usually lands on someone else.
  const slowCook: SimConfig = {
    workload: {
      arrivalRate: 40,
      service: { median: 30, sigma: 0.3 },
      stalls: { p: 1, minMs: 600, maxMs: 900, scope: 'cook' },
    },
  };
  const retrying = base({ cooks: 4, timeout: true, timeoutMs: 150, maxRetries: 2 });

  it('retries after a timeout and measures latency from the first arrival', () => {
    const m = run(slowCook, retrying).metrics();
    expect(m.totals.retries).toBeGreaterThan(0);
    const none = run(slowCook, base({ cooks: 4 })).metrics();
    expect(m.p99).toBeLessThan(none.p99);
    // Orders rescued by a retry still include the time lost on the first try.
    expect(m.max).toBeGreaterThan(150);
  });

  it('wastes more work without cancellation near capacity', () => {
    // Busy enough that attempts time out while still queued.
    const busy: SimConfig = { workload: { ...slowCook.workload, arrivalRate: 80 } };
    const noRetry = run(busy, base({ cooks: 4 })).metrics();
    const noCancel = run(busy, retrying).metrics();
    const cancel = run(busy, { ...retrying, cancel: true }).metrics();
    expect(noRetry.amplification).toBeCloseTo(1, 9);
    expect(noCancel.totals.workMs).toBeGreaterThan(noRetry.totals.workMs);
    expect(noCancel.amplification).toBeGreaterThan(cancel.amplification);
    expect(noCancel.totals.workMs).toBeGreaterThan(cancel.totals.workMs);
  });

  it('leaves no abandoned ticket cooking or queued once cancellation is on', () => {
    const sim = createSim(slowCook, { ...retrying, cancel: true }, SEED);
    for (let t = 1000; t <= 30_000; t += 250) {
      sim.advanceTo(t);
      const snap = sim.snapshot();
      const tickets = [...snap.queue, ...snap.cooks.flatMap((c) => (c.ticket ? [c.ticket] : []))];
      expect(tickets.filter((x) => x.abandoned)).toEqual([]);
    }
  });

  it('fails an order that runs out of retries', () => {
    const allSlow: SimConfig = {
      workload: { arrivalRate: 5, service: { median: 500, sigma: 0 } },
    };
    const m = run(allSlow, base({ cooks: 4, timeout: true, timeoutMs: 100, maxRetries: 1, cancel: true })).metrics();
    expect(m.totals.completed).toBe(0);
    expect(m.totals.timedOut).toBeGreaterThan(0);
    expect(m.errorRate).toBe(1);
  });

  it('backs off exponentially between retries', () => {
    const allSlow: SimConfig = { workload: { arrivalRate: 0.1, service: { median: 10_000, sigma: 0 } } };
    const sim = createSim(allSlow, base({ cooks: 4, timeout: true, timeoutMs: 100, maxRetries: 3, backoffMs: 50, cancel: true }), SEED);
    while (sim.metrics().totals.arrived === 0) sim.advanceTo(sim.now + 10);
    const t0 = sim.snapshot().queue[0]?.arrivedAt ?? sim.snapshot().cooks.find((c) => c.ticket)!.ticket!.arrivedAt;
    // Attempts at t0, +150 (100 + 50), +350 (+100 + 100), +650 (+100 + 200); fails at +750.
    sim.advanceTo(t0 + 149);
    expect(sim.metrics().totals.retries).toBe(0);
    sim.advanceTo(t0 + 151);
    expect(sim.metrics().totals.retries).toBe(1);
    sim.advanceTo(t0 + 351);
    expect(sim.metrics().totals.retries).toBe(2);
    sim.advanceTo(t0 + 651);
    expect(sim.metrics().totals.retries).toBe(3);
    sim.advanceTo(t0 + 751);
    expect(sim.metrics().totals.timedOut).toBe(1);
  });
});

describe('cache', () => {
  const cached: SimConfig = {
    workload: { ...PROTOTYPE.workload, cache: { hitRate: 0.3, hitMs: 4 } },
  };

  it('serves about hitRate of orders in hitMs without a cook', () => {
    const m = run(cached, base({ cooks: 3, cache: true })).metrics();
    const share = m.totals.cacheHits / m.totals.arrived;
    expect(share).toBeGreaterThan(0.27);
    expect(share).toBeLessThan(0.33);
    expect(m.p50).toBeLessThan(run(cached, base({ cooks: 3 })).metrics().p50);
  });

  it('keeps the arrival sequence when switched on', () => {
    const on = run(cached, base({ cooks: 3, cache: true })).metrics();
    const off = run(cached, base({ cooks: 3 })).metrics();
    expect(on.totals.arrived).toBe(off.totals.arrived);
  });

  it('drops to burstHitRate during a burst', () => {
    const bursty: SimConfig = {
      workload: {
        arrivalRate: 30,
        service: { median: 20, sigma: 0.2 },
        bursts: [{ atMs: 10_000, durationMs: 10_000, multiplier: 2 }],
        cache: { hitRate: 0.4, hitMs: 4, burstHitRate: 0.05 },
      },
    };
    const sim = createSim(bursty, base({ cooks: 6, cache: true }), SEED);
    sim.advanceTo(10_000);
    const before = sim.metrics().totals;
    sim.advanceTo(20_000);
    const during = sim.metrics().totals;
    const hitsBefore = before.cacheHits / before.arrived;
    const hitsDuring = (during.cacheHits - before.cacheHits) / (during.arrived - before.arrived);
    expect(hitsBefore).toBeGreaterThan(0.33);
    expect(hitsDuring).toBeLessThan(0.1);
  });
});

describe('repeating bursts', () => {
  it('repeats every everyMs', () => {
    const cfg: SimConfig = {
      workload: {
        arrivalRate: 20,
        service: { median: 10, sigma: 0 },
        bursts: [{ atMs: 5_000, durationMs: 5_000, multiplier: 4, everyMs: 20_000 }],
      },
    };
    const sim = createSim(cfg, base({ cooks: 10 }), SEED);
    const counts: number[] = [];
    let prev = 0;
    for (let t = 5_000; t <= 85_000; t += 5_000) {
      sim.advanceTo(t);
      const a = sim.metrics().totals.arrived;
      counts.push(a - prev);
      prev = a;
    }
    // Windows ending at 10 s, 30 s, 50 s, 70 s are bursts (~400); the others are calm (~100).
    const burst = [counts[1], counts[5], counts[9], counts[13]];
    const calm = [counts[2], counts[3], counts[4], counts[6]];
    for (const b of burst) expect(b).toBeGreaterThan(300);
    for (const c of calm) expect(c).toBeLessThan(150);
  });
});
