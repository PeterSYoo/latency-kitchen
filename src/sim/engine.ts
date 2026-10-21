// Seeded discrete-event simulation of the kitchen. Time is in simulated ms and
// advances by popping events from a min-heap.

import { EventHeap } from './heap';
import { OutcomeWindow, percentile } from './metrics';
import { exponential, lognormal, stream, uniform, type Rng } from './rng';
import type {
  Burst,
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
/** Leaf latencies kept for the fan-out stats. */
const LEAF_WINDOW = 5000;
/** Spreads staggered pauses evenly for any number of cooks. */
const GOLDEN = 0.6180339887498949;

interface Draw {
  baseMs: number;
  stallMs: number;
}

interface Order {
  id: number;
  arrivedAt: number;
  /** Dishes per order: 1, or K when the workload fans out. */
  leaves: number;
  /** Cooking time and stall for each leaf of the first attempt, drawn at arrival. */
  draws: Draw[];
  /** Cook-ms spent on this order so far, every ticket included. */
  workMs: number;
  state: 'open' | 'ok' | 'failed';
  /** The attempt the customer is waiting on: 0 first, then retries. */
  attempt: number;
  /** When the current attempt was sent; the customer's patience runs from here. */
  sentAt: number;
  /** Leaves of the current attempt that have finished, and the useful work they took. */
  leafDone: boolean[];
  doneCount: number;
  usefulMs: number;
  started: boolean;
  hedged: boolean;
  hedgeToken: number;
  timeoutToken: number;
}

interface Ticket {
  id: number;
  order: Order;
  attempt: number;
  leaf: number;
  enqueuedAt: number;
  hedge: boolean;
  /** Cooking time before any stall. */
  baseMs: number;
  /** Stall drawn with the ticket; applied according to the stall scope. */
  stallMs: number;
}

interface Cook {
  id: number;
  ticket: Ticket | null;
  startedAt: number;
  /** Stall applied to the current ticket. */
  stallMs: number;
  doneAt: number;
  /** Frozen by a stop-the-world pause. A paused cook keeps its ticket and takes no new one. */
  paused: boolean;
  /** Active time left, captured when a pause starts. */
  remainingMs: number;
  pausedMs: number;
  pauseStartedAt: number;
  token: number;
}

type EventKind =
  | 'arrival'
  | 'serviceDone'
  | 'cacheDone'
  | 'hedgeTimer'
  | 'timeout'
  | 'retry'
  | 'stallStart'
  | 'stallEnd'
  | 'rateChange'
  | 'metricsTick';

interface SimEvent {
  t: number;
  seq: number;
  kind: EventKind;
  /** Lazy cancellation: an event whose token no longer matches its owner is skipped. */
  token: number;
  /** Cook id for serviceDone and staggered pauses (-1 = every cook), burst index for rateChange. */
  index: number;
  order: Order | null;
}

export const DEFAULT_CONTROLS: Controls = {
  cooks: 3,
  queueOrder: 'fifo',
  hedge: false,
  hedgeMs: 120,
  shed: false,
  shedMax: 12,
  cache: false,
  timeout: false,
  timeoutMs: 300,
  maxRetries: 2,
  backoffMs: 0,
  cancel: false,
  staggerPauses: false,
};

export function createSim(config: SimConfig, initial: Controls, seed: number): Sim {
  return new Engine(config, initial, seed);
}

class Engine implements Sim {
  now = 0;

  private readonly workload: SimConfig['workload'];
  private ctl: Controls;
  private readonly heap = new EventHeap<SimEvent>();
  private seq = 0;

  private readonly rng: {
    arrivals: Rng;
    service: Rng;
    stalls: Rng;
    cache: Rng;
    hedge: Rng;
    retry: Rng;
    globalStalls: Rng;
  };

  private queue: Ticket[] = [];
  /** Hedge copies wait here and go before the normal queue. */
  private hedgeQueue: Ticket[] = [];
  private cooks: Cook[] = [];
  /** Every cook is frozen together (synchronised stop-the-world pauses). */
  private globalPause = false;
  /** Bumped when the pause pattern changes, so old pause events are ignored. */
  private pauseEpoch = 0;
  private nextOrderId = 1;
  private nextTicketId = 1;

  // Arrivals run on a unit-rate clock: each gap is an Exp(1) draw spent at the
  // current rate, so changing the rate doesn't reshuffle later draws.
  private arrivalRemaining = 0;
  private arrivalRemT = 0;
  private arrivalLambda = 0;
  private arrivalToken = 0;

  private readonly outcomes: OutcomeWindow;
  private readonly leafLatency = new Float64Array(LEAF_WINDOW);
  private leafHead = 0;
  private leafFilled = 0;
  private readonly totals: Totals = {
    arrived: 0,
    completed: 0,
    dropped: 0,
    timedOut: 0,
    hedges: 0,
    retries: 0,
    cacheHits: 0,
    workMs: 0,
    queueLenMs: 0,
    waitSumMs: 0,
    waitCount: 0,
    latencySumMs: 0,
    busyCookMs: 0,
    capacityCookMs: 0,
    elapsedMs: 0,
  };
  private lastT = 0;
  private tick = { busy: 0, capacity: 0, arrived: 0, hits: 0 };
  private perSecond = { utilization: 0, arrivalRate: 0, cacheHitRate: 0 };
  private ticked = false;
  /** False while the constructor sets up, before pause schedules exist. */
  private ready = false;

  constructor(config: SimConfig, initial: Controls, seed: number) {
    this.workload = config.workload;
    this.ctl = { ...initial };
    this.outcomes = new OutcomeWindow(config.metricsWindow ?? DEFAULT_WINDOW);
    this.rng = {
      arrivals: stream(seed, 'arrivals'),
      service: stream(seed, 'service'),
      stalls: stream(seed, 'stalls'),
      cache: stream(seed, 'cache'),
      hedge: stream(seed, 'hedge'),
      retry: stream(seed, 'retry'),
      globalStalls: stream(seed, 'global-stalls'),
    };

    this.resizeCooks(Math.max(0, Math.floor(initial.cooks)));

    this.arrivalRemaining = exponential(this.rng.arrivals, 1);
    this.arrivalRemT = 0;
    this.arrivalLambda = this.lambda();
    this.scheduleArrival();

    (this.workload.bursts ?? []).forEach((b, i) => this.scheduleBurstBoundary(b, i));
    this.schedulePauses();
    this.push(METRICS_TICK_MS, 'metricsTick');
    this.ready = true;
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
    if (this.ctl.hedge && (!prev.hedge || this.ctl.hedgeMs !== prev.hedgeMs)) {
      for (const order of this.ordersInFlight()) this.armHedge(order);
    }
    if (this.ctl.timeout && (!prev.timeout || this.ctl.timeoutMs !== prev.timeoutMs)) {
      for (const order of this.ordersInFlight()) this.armTimeout(order);
    }
    if (this.ctl.cancel && !prev.cancel) this.cancelAbandoned();
    if (this.ctl.staggerPauses !== prev.staggerPauses) {
      for (const c of this.cooks) this.resumeCook(c);
      this.globalPause = false;
      this.schedulePauses();
    }
    if ('quorum' in patch && patch.quorum !== prev.quorum) {
      for (const order of this.ordersInFlight()) if (order.doneCount >= this.needed(order)) this.succeed(order);
    }
    this.dispatch();
  }

  controls(): Controls {
    return { ...this.ctl };
  }

  snapshot(): SimSnapshot {
    return {
      t: this.now,
      queue: [...this.hedgeQueue, ...this.queue].map((tk) => this.ticketView(tk)),
      cooks: this.cooks.map((c) => this.cookView(c)),
      globalStall: this.globalPause,
    };
  }

  metrics(): Metrics {
    const s = this.outcomes.summarize();
    const t = this.totals;
    const ps = this.ticked
      ? this.perSecond
      : {
          utilization: t.capacityCookMs > 0 ? t.busyCookMs / t.capacityCookMs : 0,
          arrivalRate: t.elapsedMs > 0 ? (t.arrived / t.elapsedMs) * 1000 : 0,
          cacheHitRate: t.arrived > 0 ? t.cacheHits / t.arrived : 0,
        };
    const leaves = this.leafLatency.slice(0, this.leafFilled).sort();
    return {
      t: this.now,
      ...s,
      ...ps,
      leafP50: percentile(leaves, 0.5),
      leafP99: percentile(leaves, 0.99),
      queueLength: this.queue.length + this.hedgeQueue.length,
      busyCooks: this.busyCount(),
      cooks: this.cooks.length,
      totals: { ...t },
    };
  }

  // ---- events -------------------------------------------------------------

  private handle(e: SimEvent): void {
    switch (e.kind) {
      case 'arrival':
        if (e.token === this.arrivalToken) this.onArrival();
        break;
      case 'serviceDone': {
        const cook = this.cooks[e.index];
        if (cook && cook.ticket && cook.token === e.token) this.onServiceDone(cook);
        break;
      }
      case 'cacheDone':
        this.succeed(e.order!);
        break;
      case 'hedgeTimer':
        if (e.order!.hedgeToken === e.token) this.onHedgeTimer(e.order!);
        break;
      case 'timeout':
        if (e.order!.timeoutToken === e.token) this.onTimeout(e.order!);
        break;
      case 'retry':
        this.onRetry(e.order!);
        break;
      case 'stallStart':
        if (e.token === this.pauseEpoch) this.onPauseStart(e.index);
        break;
      case 'stallEnd':
        if (e.token === this.pauseEpoch) this.onPauseEnd(e.index);
        break;
      case 'rateChange':
        this.rateChanged();
        this.scheduleBurstBoundary(this.workload.bursts![e.index], e.index);
        break;
      case 'metricsTick':
        this.onMetricsTick();
        break;
    }
  }

  private onArrival(): void {
    this.totals.arrived++;
    // Every order makes the same draws, hit or miss, so the cache toggle
    // doesn't reshuffle service times for later orders.
    const leaves = this.workload.fanOut?.k ?? 1;
    const draws: Draw[] = [];
    for (let i = 0; i < leaves; i++) {
      draws.push({ baseMs: this.drawService(this.rng.service), stallMs: this.drawStall(this.rng.stalls) });
    }
    const order: Order = {
      id: this.nextOrderId++,
      arrivedAt: this.now,
      leaves,
      draws,
      workMs: 0,
      state: 'open',
      attempt: 0,
      sentAt: this.now,
      leafDone: new Array<boolean>(leaves).fill(false),
      doneCount: 0,
      usefulMs: 0,
      started: false,
      hedged: false,
      hedgeToken: 0,
      timeoutToken: 0,
    };
    const roll = this.rng.cache.next();
    const cache = this.workload.cache;
    if (this.ctl.cache && cache && roll < this.hitRate()) {
      this.totals.cacheHits++;
      this.pushOrder(this.now + cache.hitMs, 'cacheDone', order);
    } else {
      this.submit(order, draws);
    }

    this.arrivalRemaining = exponential(this.rng.arrivals, 1);
    this.arrivalRemT = this.now;
    this.scheduleArrival();
  }

  private onServiceDone(cook: Cook): void {
    const ticket = cook.ticket!;
    const order = ticket.order;
    const activeMs = this.activeMs(cook);
    cook.ticket = null;
    this.totals.workMs += activeMs;
    if (order.state === 'open' && ticket.attempt === order.attempt && !order.leafDone[ticket.leaf]) {
      order.workMs += activeMs;
      order.usefulMs += activeMs;
      order.leafDone[ticket.leaf] = true;
      order.doneCount++;
      if (order.leaves > 1) this.recordLeaf(this.now - order.sentAt);
      // The leaf's hedge twin stops at once.
      const { attempt, leaf } = ticket;
      this.cancelTickets((tk) => tk.order === order && tk.attempt === attempt && tk.leaf === leaf);
      if (order.doneCount >= this.needed(order)) this.succeed(order);
    } else {
      this.chargeWaste(order, activeMs);
    }
    this.dispatch();
  }

  private onHedgeTimer(order: Order): void {
    if (order.state !== 'open' || order.hedged || !this.ctl.hedge) return;
    const due = order.arrivedAt + this.ctl.hedgeMs;
    if (this.now < due) {
      this.armHedge(order);
      return;
    }
    order.hedged = true;
    // Copy every leaf still missing.
    for (let leaf = 0; leaf < order.leaves; leaf++) {
      if (order.leafDone[leaf]) continue;
      this.totals.hedges++;
      this.hedgeQueue.push(this.newTicket(order, leaf, true, this.drawTicket(this.rng.hedge)));
    }
    this.dispatch();
  }

  private onTimeout(order: Order): void {
    if (order.state !== 'open' || !this.ctl.timeout) return;
    const abandoned = order.attempt;
    if (this.ctl.cancel) this.cancelTickets((tk) => tk.order === order && tk.attempt === abandoned);
    if (abandoned < this.ctl.maxRetries) {
      order.attempt++;
      const wait = this.ctl.backoffMs > 0 ? this.ctl.backoffMs * 2 ** (order.attempt - 1) : 0;
      this.pushOrder(this.now + wait, 'retry', order);
    } else {
      this.fail(order, 'timeout');
    }
    this.dispatch();
  }

  private onRetry(order: Order): void {
    if (order.state !== 'open') return;
    this.totals.retries++;
    const draws: Draw[] = [];
    for (let i = 0; i < order.leaves; i++) draws.push(this.drawTicket(this.rng.retry));
    this.submit(order, draws);
  }

  private onMetricsTick(): void {
    const t = this.totals;
    const cap = t.capacityCookMs - this.tick.capacity;
    const arrived = t.arrived - this.tick.arrived;
    this.perSecond = {
      utilization: cap > 0 ? (t.busyCookMs - this.tick.busy) / cap : 0,
      arrivalRate: (arrived * 1000) / METRICS_TICK_MS,
      cacheHitRate: arrived > 0 ? (t.cacheHits - this.tick.hits) / arrived : 0,
    };
    this.tick = { busy: t.busyCookMs, capacity: t.capacityCookMs, arrived: t.arrived, hits: t.cacheHits };
    this.ticked = true;
    this.push(this.now + METRICS_TICK_MS, 'metricsTick');
  }

  // ---- stop-the-world pauses ----------------------------------------------

  private pauseEvery(): number {
    return this.workload.stalls?.everyMs ?? DEFAULT_GLOBAL_STALL_EVERY_MS;
  }

  /** Synchronised: one schedule for every cook. Staggered: each cook on its own offset. */
  private schedulePauses(): void {
    if (this.workload.stalls?.scope !== 'global') return;
    this.pauseEpoch++;
    if (!this.ctl.staggerPauses) {
      const every = this.pauseEvery();
      const next = (Math.floor(this.now / every) + 1) * every;
      this.push(next, 'stallStart', this.pauseEpoch, -1);
    } else {
      for (const c of this.cooks) this.scheduleCookPause(c.id);
    }
  }

  private scheduleCookPause(id: number): void {
    const every = this.pauseEvery();
    const offset = (((id + 1) * GOLDEN) % 1) * every;
    const base = Math.floor((this.now - offset) / every) * every + offset;
    const next = base > this.now ? base : base + every;
    this.push(next, 'stallStart', this.pauseEpoch, id);
  }

  private onPauseStart(index: number): void {
    const cfg = this.workload.stalls!;
    // Always draw both so the stream stays aligned whether or not a pause happens.
    const happens = this.rng.globalStalls.next() < cfg.p;
    const duration = uniform(this.rng.globalStalls, cfg.minMs, cfg.maxMs);
    if (index < 0) {
      if (happens && !this.globalPause) {
        this.globalPause = true;
        for (const c of this.cooks) this.pauseCook(c);
        this.push(this.now + duration, 'stallEnd', this.pauseEpoch, -1);
      }
      this.push(this.now + this.pauseEvery(), 'stallStart', this.pauseEpoch, -1);
      return;
    }
    const cook = this.cooks[index];
    if (!cook) return; // removed; its schedule ends here
    if (happens && !cook.paused) {
      this.pauseCook(cook);
      this.push(this.now + duration, 'stallEnd', this.pauseEpoch, index);
    }
    this.push(this.now + this.pauseEvery(), 'stallStart', this.pauseEpoch, index);
  }

  private onPauseEnd(index: number): void {
    if (index < 0) {
      this.globalPause = false;
      for (const c of this.cooks) this.resumeCook(c);
    } else if (this.cooks[index]) {
      this.resumeCook(this.cooks[index]);
    }
    this.dispatch();
  }

  private pauseCook(c: Cook): void {
    if (c.paused) return;
    c.paused = true;
    c.pauseStartedAt = this.now;
    if (c.ticket) {
      c.remainingMs = c.doneAt - this.now;
      c.token++;
    }
  }

  private resumeCook(c: Cook): void {
    if (!c.paused) return;
    c.paused = false;
    if (c.ticket) {
      c.pausedMs += this.now - c.pauseStartedAt;
      this.scheduleDone(c, this.now + c.remainingMs);
    }
  }

  // ---- order outcomes -----------------------------------------------------

  /** Leaves this order needs before it can be served. */
  private needed(order: Order): number {
    return Math.max(1, Math.min(order.leaves, this.ctl.quorum ?? order.leaves));
  }

  /** Sends an attempt to the kitchen, unless shedding turns it away at the door. */
  private submit(order: Order, draws: Draw[]): void {
    if (this.ctl.shed && this.queue.length >= this.ctl.shedMax) {
      this.fail(order, 'shed');
      return;
    }
    order.sentAt = this.now;
    order.leafDone.fill(false);
    order.doneCount = 0;
    order.usefulMs = 0;
    draws.forEach((d, leaf) => this.queue.push(this.newTicket(order, leaf, false, d)));
    this.armTimeout(order);
    this.dispatch();
  }

  private succeed(order: Order): void {
    // Every other ticket of the winning attempt stops at once (twins and
    // leaves past the quorum); older attempts only stop if cancellation is on.
    // Cancel while the order is still open so the work lands on it.
    const won = order.attempt;
    this.cancelTickets((tk) => tk.order === order && (tk.attempt === won || this.ctl.cancel));
    order.state = 'ok';
    const latency = this.now - order.arrivedAt;
    this.totals.completed++;
    this.totals.latencySumMs += latency;
    // The winning tickets' work is the no-hedge, no-retry baseline; anything
    // else spent on the order is waste.
    this.outcomes.push({ ok: true, latencyMs: latency, workMs: order.workMs, baseMs: order.usefulMs });
  }

  private fail(order: Order, why: 'shed' | 'timeout'): void {
    if (this.ctl.cancel) this.cancelTickets((tk) => tk.order === order);
    order.state = 'failed';
    if (why === 'shed') this.totals.dropped++;
    else this.totals.timedOut++;
    this.outcomes.push({ ok: false, latencyMs: 0, workMs: order.workMs, baseMs: 0 });
  }

  /** Work that helped nobody: on the order while it's open, else on the newest outcome. */
  private chargeWaste(order: Order, ms: number): void {
    if (order.state === 'open') order.workMs += ms;
    else this.outcomes.addWork(ms);
  }

  /** Stops matching tickets in the queues and on the stoves. */
  private cancelTickets(match: (tk: Ticket) => boolean): void {
    for (const c of this.cooks) {
      if (!c.ticket || !match(c.ticket)) continue;
      const ms = this.activeMs(c);
      this.totals.workMs += ms;
      const order = c.ticket.order;
      c.ticket = null;
      c.token++;
      this.chargeWaste(order, ms);
    }
    this.hedgeQueue = this.hedgeQueue.filter((tk) => !match(tk));
    this.queue = this.queue.filter((tk) => !match(tk));
  }

  private cancelAbandoned(): void {
    this.cancelTickets((tk) => tk.order.state !== 'open' || tk.attempt < tk.order.attempt);
  }

  private recordLeaf(ms: number): void {
    this.leafLatency[this.leafHead] = ms;
    this.leafHead = (this.leafHead + 1) % LEAF_WINDOW;
    if (this.leafFilled < LEAF_WINDOW) this.leafFilled++;
  }

  // ---- hedging and timeouts -----------------------------------------------

  /** A hedge fires hedgeMs after arrival, or as soon as the order starts if that's later. */
  private armHedge(order: Order): void {
    if (!this.ctl.hedge || order.hedged || order.state !== 'open' || !order.started) return;
    order.hedgeToken++;
    const at = Math.max(this.now, order.arrivedAt + this.ctl.hedgeMs);
    this.pushOrder(at, 'hedgeTimer', order, order.hedgeToken);
  }

  /** The customer's patience runs from when the current attempt was sent. */
  private armTimeout(order: Order): void {
    if (!this.ctl.timeout || order.state !== 'open') return;
    order.timeoutToken++;
    this.pushOrder(Math.max(this.now, order.sentAt + this.ctl.timeoutMs), 'timeout', order, order.timeoutToken);
  }

  private ordersInFlight(): Set<Order> {
    const orders = new Set<Order>();
    for (const c of this.cooks) if (c.ticket?.order.state === 'open') orders.add(c.ticket.order);
    for (const tk of this.queue) if (tk.order.state === 'open') orders.add(tk.order);
    return orders;
  }

  // ---- cooks and queue ----------------------------------------------------

  private newTicket(order: Order, leaf: number, hedge: boolean, draw: Draw): Ticket {
    return {
      id: this.nextTicketId++,
      order,
      attempt: order.attempt,
      leaf,
      enqueuedAt: this.now,
      hedge,
      baseMs: draw.baseMs,
      stallMs: draw.stallMs,
    };
  }

  private dispatch(): void {
    for (const cook of this.cooks) {
      if (this.queue.length === 0 && this.hedgeQueue.length === 0) return;
      if (cook.ticket || cook.paused) continue;
      const ticket =
        this.hedgeQueue.shift() ?? (this.ctl.queueOrder === 'lifo' ? this.queue.pop()! : this.queue.shift()!);
      this.start(cook, ticket);
    }
  }

  private start(cook: Cook, ticket: Ticket): void {
    const order = ticket.order;
    this.totals.waitSumMs += this.now - ticket.enqueuedAt;
    this.totals.waitCount++;
    const scope = this.workload.stalls?.scope;
    const stallMs = scope === 'request' || (scope === 'cook' && cook.id === 0) ? ticket.stallMs : 0;
    cook.ticket = ticket;
    cook.startedAt = this.now;
    cook.stallMs = stallMs;
    cook.pausedMs = 0;
    this.scheduleDone(cook, this.now + ticket.baseMs + stallMs);
    if (!order.started) {
      order.started = true;
      this.armHedge(order);
    }
  }

  private scheduleDone(cook: Cook, at: number): void {
    cook.doneAt = at;
    cook.token++;
    this.push(at, 'serviceDone', cook.token, cook.id);
  }

  private resizeCooks(n: number): void {
    while (this.cooks.length < n) {
      const cook: Cook = {
        id: this.cooks.length,
        ticket: null,
        startedAt: 0,
        stallMs: 0,
        doneAt: 0,
        paused: false,
        remainingMs: 0,
        pausedMs: 0,
        pauseStartedAt: 0,
        token: 0,
      };
      this.cooks.push(cook);
      if (this.globalPause) this.pauseCook(cook);
      if (this.ready && this.ctl.staggerPauses && this.workload.stalls?.scope === 'global') {
        this.scheduleCookPause(cook.id);
      }
    }
    while (this.cooks.length > n) {
      const cook = this.cooks.pop()!;
      const ticket = cook.ticket;
      if (!ticket) continue;
      // The work done so far is spent; the ticket goes back to be served next.
      const ms = this.activeMs(cook);
      this.totals.workMs += ms;
      this.chargeWaste(ticket.order, ms);
      ticket.enqueuedAt = this.now;
      if (ticket.hedge) this.hedgeQueue.unshift(ticket);
      else if (this.ctl.queueOrder === 'lifo') this.queue.push(ticket);
      else this.queue.unshift(ticket);
    }
  }

  /** Time the cook has actually spent cooking its current ticket. */
  private activeMs(cook: Cook): number {
    const pausing = cook.paused ? this.now - cook.pauseStartedAt : 0;
    return this.now - cook.startedAt - cook.pausedMs - pausing;
  }

  private busyCount(): number {
    let n = 0;
    for (const c of this.cooks) if (c.ticket) n++;
    return n;
  }

  // ---- arrivals and bursts ------------------------------------------------

  private burstActive(b: Burst): boolean {
    if (this.now < b.atMs) return false;
    const into = b.everyMs ? (this.now - b.atMs) % b.everyMs : this.now - b.atMs;
    return into < b.durationMs;
  }

  private bursting(): boolean {
    return (this.workload.bursts ?? []).some((b) => this.burstActive(b));
  }

  private scheduleBurstBoundary(b: Burst, index: number): void {
    let next: number | null;
    if (this.now < b.atMs) next = b.atMs;
    else if (!b.everyMs) next = this.now < b.atMs + b.durationMs ? b.atMs + b.durationMs : null;
    else {
      const start = b.atMs + Math.floor((this.now - b.atMs) / b.everyMs) * b.everyMs;
      next = this.now < start + b.durationMs ? start + b.durationMs : start + b.everyMs;
    }
    if (next !== null) this.push(next, 'rateChange', 0, index);
  }

  /** Current arrival rate in orders per ms. */
  private lambda(): number {
    let rate = this.ctl.arrivalRate ?? this.workload.arrivalRate;
    for (const b of this.workload.bursts ?? []) if (this.burstActive(b)) rate *= b.multiplier;
    return Math.max(0, rate) / 1000;
  }

  private hitRate(): number {
    const c = this.workload.cache!;
    return c.burstHitRate !== undefined && this.bursting() ? c.burstHitRate : c.hitRate;
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

  private drawTicket(rng: Rng): Draw {
    return { baseMs: this.drawService(rng), stallMs: this.drawStall(rng) };
  }

  private drawService(rng: Rng): number {
    const s = this.workload.service;
    if (s.dist === 'exponential') return exponential(rng, s.mean);
    return lognormal(rng, s.median, s.sigma);
  }

  /** Draws a stall for every ticket (two draws) so the stream stays aligned. */
  private drawStall(rng: Rng): number {
    const cfg = this.workload.stalls;
    const u = rng.next();
    const size = rng.next();
    if (!cfg || cfg.scope === 'global' || u >= cfg.p) return 0;
    return cfg.minMs + (cfg.maxMs - cfg.minMs) * size;
  }

  // ---- bookkeeping --------------------------------------------------------

  private push(t: number, kind: EventKind, token = 0, index = -1): void {
    this.heap.push({ t, seq: this.seq++, kind, token, index, order: null });
  }

  private pushOrder(t: number, kind: EventKind, order: Order, token = 0): void {
    this.heap.push({ t, seq: this.seq++, kind, token, index: -1, order });
  }

  /** Integrates time-weighted totals up to t. Call before any state change. */
  private touch(t: number): void {
    const dt = t - this.lastT;
    if (dt <= 0) return;
    const queued = this.queue.length + this.hedgeQueue.length;
    this.totals.queueLenMs += queued * dt;
    this.totals.busyCookMs += this.busyCount() * dt;
    this.totals.capacityCookMs += this.cooks.length * dt;
    this.totals.elapsedMs += dt;
    this.lastT = t;
  }

  private ticketView(tk: Ticket): TicketView {
    return {
      ticketId: tk.id,
      orderId: tk.order.id,
      arrivedAt: tk.order.arrivedAt,
      enqueuedAt: tk.enqueuedAt,
      hedge: tk.hedge,
      attempt: tk.attempt,
      leaf: tk.leaf,
      leaves: tk.order.leaves,
      abandoned: tk.order.state !== 'open' || tk.attempt < tk.order.attempt,
    };
  }

  private cookView(c: Cook): CookView {
    if (!c.ticket) return { id: c.id, ticket: null, stalled: c.paused };
    const pausing = c.paused ? this.now - c.pauseStartedAt : 0;
    const pausedMs = c.pausedMs + pausing;
    const base = c.ticket.baseMs;
    return {
      id: c.id,
      ticket: { ...this.ticketView(c.ticket), startedAt: c.startedAt, baseMs: base, stallMs: c.stallMs, pausedMs },
      stalled: c.paused || this.activeMs(c) > base,
    };
  }
}
