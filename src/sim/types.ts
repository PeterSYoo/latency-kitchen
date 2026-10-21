// Shared types for the simulation engine. Nothing here may depend on the DOM,
// React or wall-clock time.

export type ServiceDist =
  | { dist?: 'lognormal'; median: number; sigma: number }
  | { dist: 'exponential'; mean: number };

export interface StallConfig {
  /** Per-request and per-cook: chance a ticket stalls. Global: chance a scheduled pause happens. */
  p: number;
  minMs: number;
  maxMs: number;
  /**
   * request: any ticket may stall.
   * cook: only tickets served by cook 0 (the slow cook) stall.
   * global: every cook pauses together, like a stop-the-world GC.
   */
  scope: 'request' | 'cook' | 'global';
  /** Global only: time between scheduled pauses. Default 5,000 ms. */
  everyMs?: number;
}

export interface Burst {
  atMs: number;
  durationMs: number;
  multiplier: number;
}

export interface Workload {
  /** Orders per second. */
  arrivalRate: number;
  bursts?: Burst[];
  service: ServiceDist;
  stalls?: StallConfig;
}

/** The part of a level the engine reads. A full LevelConfig is assignable to it. */
export interface SimConfig {
  workload: Workload;
  /** Completed requests kept for percentile stats. Default 1,500. */
  metricsWindow?: number;
}

export type QueueOrder = 'fifo' | 'lifo';

export interface Controls {
  cooks: number;
  queueOrder: QueueOrder;
  /** Overrides workload.arrivalRate when set (the Level 2 utilization dial). */
  arrivalRate?: number;
}

export interface TicketView {
  ticketId: number;
  orderId: number;
  /** When the order first arrived. */
  arrivedAt: number;
  /** When this ticket joined the queue. */
  enqueuedAt: number;
}

export interface CookView {
  id: number;
  ticket: (TicketView & {
    startedAt: number;
    /** Normal cooking time for this ticket, before any stall. */
    baseMs: number;
    /** Extra time from a per-request or per-cook stall. */
    stallMs: number;
    /** Time spent frozen by global pauses so far. */
    pausedMs: number;
  }) | null;
  /** True while a global pause holds this cook, or while the ticket is in its stalled part. */
  stalled: boolean;
}

export interface SimSnapshot {
  t: number;
  queue: TicketView[];
  cooks: CookView[];
  globalStall: boolean;
}

export interface Totals {
  arrived: number;
  completed: number;
  dropped: number;
  /** Integral of queue length over time (order·ms). */
  queueLenMs: number;
  /** Sum and count of time tickets waited in the queue before a cook took them. */
  waitSumMs: number;
  waitCount: number;
  /** Sum of latency over every completed order. */
  latencySumMs: number;
  /** Cook-ms spent holding a ticket. */
  busyCookMs: number;
  /** Cook-ms available (cook count integrated over time). */
  capacityCookMs: number;
  elapsedMs: number;
}

export interface Metrics {
  t: number;
  /** Orders in the rolling window. */
  count: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  p999: number;
  max: number;
  /** Busy cook-ms / available cook-ms over the last completed second. */
  utilization: number;
  /** Errors (shed, timed out) / orders in the window. */
  errorRate: number;
  /** Cook-ms spent per completed order, over its no-hedge, no-retry cost. */
  amplification: number;
  /** Counts per bin; edges from histogramEdges(). */
  histogram: number[];
  queueLength: number;
  busyCooks: number;
  cooks: number;
  totals: Totals;
}

export interface Sim {
  /** Simulated time, ms. */
  readonly now: number;
  advanceTo(tMs: number): void;
  setControls(patch: Partial<Controls>): void;
  controls(): Controls;
  snapshot(): SimSnapshot;
  metrics(): Metrics;
}
