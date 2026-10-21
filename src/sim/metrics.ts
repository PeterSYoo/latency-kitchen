// Rolling-window statistics over completed orders.

export const HISTOGRAM_BINS = 48;
export const HISTOGRAM_MIN_MS = 2;
export const HISTOGRAM_MAX_MS = 3000;

/** HISTOGRAM_BINS + 1 log-spaced edges from 2 ms to 3 s. */
export function histogramEdges(): number[] {
  const edges: number[] = [];
  const ratio = Math.log(HISTOGRAM_MAX_MS / HISTOGRAM_MIN_MS);
  for (let i = 0; i <= HISTOGRAM_BINS; i++) {
    edges.push(HISTOGRAM_MIN_MS * Math.exp((ratio * i) / HISTOGRAM_BINS));
  }
  return edges;
}

/** Bin index for a latency; values outside the range clamp to the end bins. */
export function histogramBin(ms: number): number {
  if (ms <= HISTOGRAM_MIN_MS) return 0;
  const i = Math.floor(
    (Math.log(ms / HISTOGRAM_MIN_MS) / Math.log(HISTOGRAM_MAX_MS / HISTOGRAM_MIN_MS)) * HISTOGRAM_BINS,
  );
  return Math.min(HISTOGRAM_BINS - 1, i);
}

/** Nearest-rank percentile of an ascending array, q in [0, 1]. */
export function percentile(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const rank = Math.ceil(q * n);
  return sorted[Math.min(n - 1, Math.max(0, rank - 1))];
}

export interface Outcome {
  ok: boolean;
  /** Arrival to first successful completion; 0 for errors. */
  latencyMs: number;
  /** Cook-ms actually spent on this order, every copy included. */
  workMs: number;
  /** Cook-ms the order would cost with no hedging or retries. */
  baseMs: number;
}

/** Fixed-size ring of the most recent outcomes. */
export class OutcomeWindow {
  private ok: Uint8Array;
  private latency: Float64Array;
  private work: Float64Array;
  private base: Float64Array;
  private head = 0;
  private filled = 0;

  constructor(readonly capacity: number) {
    this.ok = new Uint8Array(capacity);
    this.latency = new Float64Array(capacity);
    this.work = new Float64Array(capacity);
    this.base = new Float64Array(capacity);
  }

  get size(): number {
    return this.filled;
  }

  push(o: Outcome): void {
    const i = this.head;
    this.ok[i] = o.ok ? 1 : 0;
    this.latency[i] = o.latencyMs;
    this.work[i] = o.workMs;
    this.base[i] = o.baseMs;
    this.head = (i + 1) % this.capacity;
    if (this.filled < this.capacity) this.filled++;
  }

  summarize() {
    const n = this.filled;
    const lat = new Float64Array(n);
    const histogram = new Array<number>(HISTOGRAM_BINS).fill(0);
    let okCount = 0;
    let sum = 0;
    let work = 0;
    let base = 0;
    for (let i = 0; i < n; i++) {
      work += this.work[i];
      base += this.base[i];
      if (!this.ok[i]) continue;
      const v = this.latency[i];
      lat[okCount++] = v;
      sum += v;
      histogram[histogramBin(v)]++;
    }
    const sorted = lat.subarray(0, okCount).sort();
    return {
      count: n,
      mean: okCount ? sum / okCount : 0,
      p50: percentile(sorted, 0.5),
      p90: percentile(sorted, 0.9),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
      p999: percentile(sorted, 0.999),
      max: okCount ? sorted[okCount - 1] : 0,
      errorRate: n ? (n - okCount) / n : 0,
      amplification: base > 0 ? work / base : 1,
      histogram,
    };
  }
}
