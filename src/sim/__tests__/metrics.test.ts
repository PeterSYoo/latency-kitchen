import { describe, expect, it } from 'vitest';
import { HISTOGRAM_BINS, OutcomeWindow, histogramBin, histogramEdges, percentile } from '../metrics';

describe('metrics', () => {
  it('computes nearest-rank percentiles', () => {
    const a = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(a, 0.5)).toBe(50);
    expect(percentile(a, 0.99)).toBe(99);
    expect(percentile(a, 1)).toBe(100);
    expect(percentile([], 0.5)).toBe(0);
  });

  it('has 48 log-spaced bins from 2 ms to 3 s', () => {
    const e = histogramEdges();
    expect(e).toHaveLength(HISTOGRAM_BINS + 1);
    expect(e[0]).toBeCloseTo(2);
    expect(e[HISTOGRAM_BINS]).toBeCloseTo(3000);
    expect(histogramBin(1)).toBe(0);
    expect(histogramBin(10_000)).toBe(HISTOGRAM_BINS - 1);
    for (let i = 0; i < HISTOGRAM_BINS; i++) {
      expect(histogramBin(Math.sqrt(e[i] * e[i + 1]))).toBe(i);
    }
  });

  it('keeps only the most recent outcomes', () => {
    const w = new OutcomeWindow(3);
    for (const v of [1000, 1, 2, 3]) w.push({ ok: true, latencyMs: v, workMs: v, baseMs: v });
    const s = w.summarize();
    expect(s.count).toBe(3);
    expect(s.max).toBe(3);
    expect(s.mean).toBe(2);
  });

  it('counts errors and excludes them from latency stats', () => {
    const w = new OutcomeWindow(10);
    w.push({ ok: true, latencyMs: 10, workMs: 10, baseMs: 10 });
    w.push({ ok: false, latencyMs: 0, workMs: 0, baseMs: 0 });
    const s = w.summarize();
    expect(s.errorRate).toBe(0.5);
    expect(s.p50).toBe(10);
  });
});
