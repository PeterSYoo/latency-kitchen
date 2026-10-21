// Seeded discrete-event simulation of the kitchen. Time is in simulated ms and
// advances by popping events from a min-heap.

import { EventHeap } from './heap';
import { OutcomeWindow } from './metrics';
import { exponential, lognormal, stream, uniform, type Rng } from './rng';
import type {
  Controls,
  CookView,
  Metrics,
  Sim,
  SimConfig,
  SimSnapshot,
  TicketView,
  Totals,
} from './types';

const METRICS_TICK_MS = 1000;
const DEFAULT_WINDOW = 1500;
const DEFAULT_GLOBAL_STALL_EVERY_MS = 5000;

interface Order {
  id: number;
  arrivedAt: number;
  /** Cooking time before any stall. */
  baseMs: number;
  /** Stall drawn at arrival; applied according to the stall scope. */
  stallMs: number;
  /** Cook-ms spent on this order so far. */
  workMs: number;
  /** Cost of the first ticket as started; the no-hedge, no-retry baseline. */
  firstCostMs: number;
  done: boolean;
}

interface Ticket {
  id: number;
  order: Order;
  enqueuedAt: number;
}

interface Cook {
  id: number;
  ticket: Ticket | null;
  startedAt: number;
  /** Stall applied to the current ticket. */
  stallMs: number;
  doneAt: number;
  /** Active time left, captured when a global pause starts. */
  remainingMs: number;
  pausedMs: number;
  pauseStartedAt: number;
  token: number;
}

type EventKind = 'arrival' | 'serviceDone' | 'stallStart' | 'stallEnd' | 'rateChange' | 'metricsTick';

interface SimEvent {
  t: number;
  seq: number;
  kind: EventKind;
  /** Lazy cancellation: an event whose token no longer matches its owner is skipped. */
  token: number;
  cookId: number;
}

export function createSim(config: SimConfig, initial: Controls, seed: number): Sim {
  return new Engine(config, initial, seed);
}

class Engine implements Sim {
  now = 0;

  private readonly workload: SimConfig['workload'];
  private ctl: Controls;
  private readonly heap = new EventHeap<SimEvent>();
  private seq = 0;

  private readonly rng: { arrivals: Rng; service: Rng; stalls: Rng; globalStalls: Rng };

  private queue: Ticket[] = [];
  private cooks: Cook[] = [];
  private globalStall = false;
  private nextOrderId = 1;
  private nextTicketId = 1;

  // Arrivals run on a unit-rate clock: each gap is an Exp(1) draw spent at the
  // current rate, so changing the rate doesn't reshuffle later draws.
  private arrivalRemaining = 0;
  private arrivalRemT = 0;
  private arrivalLambda = 0;
  private arrivalToken = 0;

  private readonly outcomes: OutcomeWindow;
  private readonly totals: Totals = {
    arrived: 0,
    completed: 0,
    dropped: 0,
    queueLenMs: 0,
    waitSumMs: 0,
    waitCount: 0,
    latencySumMs: 0,
    busyCookMs: 0,
    capacityCookMs: 0,
    elapsedMs: 0,
  };
  private lastT = 0;
  private tickBusy = 0;
  private tickCapacity = 0;
  private utilization = 0;
  private ticked = false;

  constructor(config: SimConfig, initial: Controls, seed: number) {
    this.workload = config.workload;
    this.ctl = { ...initial };
    this.outcomes = new OutcomeWindow(config.metricsWindow ?? DEFAULT_WINDOW);
    this.rng = {
      arrivals: stream(seed, 'arrivals'),
      service: stream(seed, 'service'),
      stalls: stream(seed, 'stalls'),
      globalStalls: stream(seed, 'global-stalls'),
    };

    this.resizeCooks(Math.max(0, Math.floor(initial.cooks)));

    this.arrivalRemaining = exponential(this.rng.arrivals, 1);
    this.arrivalRemT = 0;
    this.arrivalLambda = this.lambda();
    this.scheduleArrival();

    for (const b of this.workload.bursts ?? []) {
      this.push(b.atMs, 'rateChange');
      this.push(b.atMs + b.durationMs, 'rateChange');
    }
    const stalls = this.workload.stalls;
    if (stalls?.scope === 'global') {
      this.push(stalls.everyMs ?? DEFAULT_GLOBAL_STALL_EVERY_MS, 'stallStart');
    }
    this.push(METRICS_TICK_MS, 'metricsTick');
  }

  // ---- public API ---------------------------------------------------------

  advanceTo(tMs: number): void {
    for (;;) {
      const e = this.heap.peek();
      if (!e || e.t > tMs) break;
      this.heap.pop();
      this.touch(e.t);
      this.now = e.t;
      this.handle(e);
    }
    if (tMs > this.now) {
      this.touch(tMs);
      this.now = tMs;
    }
  }

  setControls(patch: Partial<Controls>): void {
    this.touch(this.now);
    const prev = this.ctl;
    this.ctl = { ...prev, ...patch };
    if (patch.cooks !== undefined && patch.cooks !== prev.cooks) {
      this.resizeCooks(Math.max(0, Math.floor(patch.cooks)));
    }
    if ('arrivalRate' in patch && patch.arrivalRate !== prev.arrivalRate) {
      this.rateChanged();
    }
    this.dispatch();
  }

  controls(): Controls {
    return { ...this.ctl };
  }

  snapshot(): SimSnapshot {
    return {
      t: this.now,
      queue: this.queue.map((tk) => this.ticketView(tk)),
      cooks: this.cooks.map((c) => this.cookView(c)),
      globalStall: this.globalStall,
    };
  }

  metrics(): Metrics {
    const s = this.outcomes.summarize();
    const utilization = this.ticked
      ? this.utilization
      : this.totals.capacityCookMs > 0
        ? this.totals.busyCookMs / this.totals.capacityCookMs
        : 0;
    return {
      t: this.now,
      ...s,
      utilization,
      queueLength: this.queue.length,
      busyCooks: this.busyCount(),
      cooks: this.cooks.length,
      totals: { ...this.totals },
    };
  }

  // ---- events -------------------------------------------------------------

  private handle(e: SimEvent): void {
    switch (e.kind) {
      case 'arrival':
        if (e.token === this.arrivalToken) this.onArrival();
        break;
      case 'serviceDone': {
        const cook = this.cooks[e.cookId];
        if (cook && cook.ticket && cook.token === e.token) this.onServiceDone(cook);
        break;
      }
      case 'stallStart':
        this.onStallStart();
        break;
      case 'stallEnd':
        this.onStallEnd();
        break;
      case 'rateChange':
        this.rateChanged();
        break;
      case 'metricsTick':
        this.onMetricsTick();
        break;
    }
  }

  private onArrival(): void {
    this.totals.arrived++;
    const order: Order = {
      id: this.nextOrderId++,
      arrivedAt: this.now,
      baseMs: this.drawService(),
      stallMs: this.drawStall(),
      workMs: 0,
      firstCostMs: -1,
      done: false,
    };
    this.queue.push({ id: this.nextTicketId++, order, enqueuedAt: this.now });
    this.dispatch();

    this.arrivalRemaining = exponential(this.rng.arrivals, 1);
    this.arrivalRemT = this.now;
    this.scheduleArrival();
  }

  private onServiceDone(cook: Cook): void {
    const ticket = cook.ticket!;
    const order = ticket.order;
    order.workMs += this.activeMs(cook);
    cook.ticket = null;
    if (!order.done) {
      order.done = true;
      const latency = this.now - order.arrivedAt;
      this.totals.completed++;
      this.totals.latencySumMs += latency;
      this.outcomes.push({ ok: true, latencyMs: latency, workMs: order.workMs, baseMs: order.firstCostMs });
    }
    this.dispatch();
  }

  private onStallStart(): void {
    const cfg = this.workload.stalls!;
    // Always draw both so the stream stays aligned whether or not a pause happens.
    const happens = this.rng.globalStalls.next() < cfg.p;
    const duration = uniform(this.rng.globalStalls, cfg.minMs, cfg.maxMs);
    if (happens && !this.globalStall) {
      this.globalStall = true;
      for (const c of this.cooks) {
        if (!c.ticket) continue;
        c.remainingMs = c.doneAt - this.now;
        c.pauseStartedAt = this.now;
        c.token++;
      }
      this.push(this.now + duration, 'stallEnd');
    }
    this.push(this.now + (cfg.everyMs ?? DEFAULT_GLOBAL_STALL_EVERY_MS), 'stallStart');
  }

  private onStallEnd(): void {
    this.globalStall = false;
    for (const c of this.cooks) {
      if (!c.ticket) continue;
      c.pausedMs += this.now - c.pauseStartedAt;
      this.scheduleDone(c, this.now + c.remainingMs);
    }
    this.dispatch();
  }

  private onMetricsTick(): void {
    const busy = this.totals.busyCookMs - this.tickBusy;
    const cap = this.totals.capacityCookMs - this.tickCapacity;
    this.utilization = cap > 0 ? busy / cap : 0;
    this.tickBusy = this.totals.busyCookMs;
    this.tickCapacity = this.totals.capacityCookMs;
    this.ticked = true;
    this.push(this.now + METRICS_TICK_MS, 'metricsTick');
  }

  // ---- cooks and queue ----------------------------------------------------

  private dispatch(): void {
    if (this.globalStall) return;
    for (const cook of this.cooks) {
      if (this.queue.length === 0) return;
      if (cook.ticket) continue;
      const ticket = this.ctl.queueOrder === 'lifo' ? this.queue.pop()! : this.queue.shift()!;
      this.start(cook, ticket);
    }
  }

  private start(cook: Cook, ticket: Ticket): void {
    const order = ticket.order;
    this.totals.waitSumMs += this.now - ticket.enqueuedAt;
    this.totals.waitCount++;
    const scope = this.workload.stalls?.scope;
    const stallMs = scope === 'request' || (scope === 'cook' && cook.id === 0) ? order.stallMs : 0;
    if (order.firstCostMs < 0) order.firstCostMs = order.baseMs + stallMs;
    cook.ticket = ticket;
    cook.startedAt = this.now;
    cook.stallMs = stallMs;
    cook.pausedMs = 0;
    this.scheduleDone(cook, this.now + order.baseMs + stallMs);
  }

  private scheduleDone(cook: Cook, at: number): void {
    cook.doneAt = at;
    cook.token++;
    this.push(at, 'serviceDone', cook.token, cook.id);
  }

  private resizeCooks(n: number): void {
    while (this.cooks.length < n) {
      this.cooks.push({
        id: this.cooks.length,
        ticket: null,
        startedAt: 0,
        stallMs: 0,
        doneAt: 0,
        remainingMs: 0,
        pausedMs: 0,
        pauseStartedAt: 0,
        token: 0,
      });
    }
    while (this.cooks.length > n) {
      const cook = this.cooks.pop()!;
      const ticket = cook.ticket;
      if (!ticket) continue;
      // The work done so far is spent; the ticket goes back to be served next.
      ticket.order.workMs += this.activeMs(cook);
      ticket.enqueuedAt = this.now;
      if (this.ctl.queueOrder === 'lifo') this.queue.push(ticket);
      else this.queue.unshift(ticket);
    }
  }

  /** Time the cook has actually spent cooking its current ticket. */
  private activeMs(cook: Cook): number {
    const pausing = this.globalStall ? this.now - cook.pauseStartedAt : 0;
    return this.now - cook.startedAt - cook.pausedMs - pausing;
  }

  private busyCount(): number {
    let n = 0;
    for (const c of this.cooks) if (c.ticket) n++;
    return n;
  }

  // ---- arrivals -----------------------------------------------------------

  /** Current arrival rate in orders per ms. */
  private lambda(): number {
    let rate = this.ctl.arrivalRate ?? this.workload.arrivalRate;
    for (const b of this.workload.bursts ?? []) {
      if (this.now >= b.atMs && this.now < b.atMs + b.durationMs) rate *= b.multiplier;
    }
    return Math.max(0, rate) / 1000;
  }

  private rateChanged(): void {
    this.arrivalRemaining -= (this.now - this.arrivalRemT) * this.arrivalLambda;
    this.arrivalRemT = this.now;
    this.arrivalLambda = this.lambda();
    this.scheduleArrival();
  }

  private scheduleArrival(): void {
    this.arrivalToken++;
    if (this.arrivalLambda <= 0) return;
    const at = this.arrivalRemT + Math.max(0, this.arrivalRemaining) / this.arrivalLambda;
    this.push(at, 'arrival', this.arrivalToken);
  }

  // ---- draws --------------------------------------------------------------

  private drawService(): number {
    const s = this.workload.service;
    if (s.dist === 'exponential') return exponential(this.rng.service, s.mean);
    return lognormal(this.rng.service, s.median, s.sigma);
  }

  /** Draws a stall for every order (two draws) so the stream stays aligned. */
  private drawStall(): number {
    const cfg = this.workload.stalls;
    const u = this.rng.stalls.next();
    const size = this.rng.stalls.next();
    if (!cfg || cfg.scope === 'global' || u >= cfg.p) return 0;
    return cfg.minMs + (cfg.maxMs - cfg.minMs) * size;
  }

  // ---- bookkeeping --------------------------------------------------------

  private push(t: number, kind: EventKind, token = 0, cookId = -1): void {
    this.heap.push({ t, seq: this.seq++, kind, token, cookId });
  }

  /** Integrates time-weighted totals up to t. Call before any state change. */
  private touch(t: number): void {
    const dt = t - this.lastT;
    if (dt <= 0) return;
    this.totals.queueLenMs += this.queue.length * dt;
    this.totals.busyCookMs += this.busyCount() * dt;
    this.totals.capacityCookMs += this.cooks.length * dt;
    this.totals.elapsedMs += dt;
    this.lastT = t;
  }

  private ticketView(tk: Ticket): TicketView {
    return { ticketId: tk.id, orderId: tk.order.id, arrivedAt: tk.order.arrivedAt, enqueuedAt: tk.enqueuedAt };
  }

  private cookView(c: Cook): CookView {
    if (!c.ticket) return { id: c.id, ticket: null, stalled: this.globalStall };
    const pausing = this.globalStall ? this.now - c.pauseStartedAt : 0;
    const pausedMs = c.pausedMs + pausing;
    const base = c.ticket.order.baseMs;
    return {
      id: c.id,
      ticket: { ...this.ticketView(c.ticket), startedAt: c.startedAt, baseMs: base, stallMs: c.stallMs, pausedMs },
      stalled: this.globalStall || this.activeMs(c) > base,
    };
  }
}
