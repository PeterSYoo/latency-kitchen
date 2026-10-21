// One play-through of a level: the engine plus sampled history, goals, the
// hold window and stars. Pure TypeScript and driven by simulated time, so it
// runs the same in the browser and in tests.

import { createSim, type Controls, type Metrics, type Sim } from '../sim';
import type { Goal, LevelConfig } from '../levels/types';
import { evaluateGoal, goalContext, type GoalContext, type GoalResult } from './goals';

/** Seed for a level's first play; Reset moves to the next one. */
export const FIRST_SEED = 1;
export const SAMPLE_MS = 500;
export const HISTORY_SAMPLES = 120; // 60 s
/** Run the bad default setup this long before showing the level, so the charts start full. */
export const PREWARM_MS = 70_000;
const DEFAULT_HOLD_MS = 15_000;

export interface Sample {
  t: number;
  /** False when no order in the window succeeded, so latency has no value. */
  hasLatency: boolean;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  utilization: number;
  errorRate: number;
}

export type Status =
  | { kind: 'cleared' }
  | { kind: 'passing' }
  | { kind: 'failing'; text: string };

/** The kitchen at one moment, for the debrief's before and after. */
export interface Moment {
  t: number;
  metrics: Metrics;
  controls: Controls;
}

export type Stars = [boolean, boolean, boolean];

export class Session {
  readonly sim: Sim;
  readonly holdMs: number;
  history: Sample[] = [];
  /** The level's goals, as last evaluated. */
  goals: GoalResult[] = [];
  metrics: Metrics;
  /** Each star needs its goals to hold for holdMs at once. */
  readonly tiers: Goal[][];
  holds: [number, number, number] = [0, 0, 0];
  stars: Stars = [false, false, false];
  clearedAt: number | null = null;
  /** The bad default as the player first sees it, and the kitchen at the first clear. */
  before: Moment;
  after: Moment | null = null;
  /** Control changes the player made, for the debrief. */
  changes: { t: number; patch: Partial<Controls> }[] = [];
  private nextSample: number;
  private warming = false;
  private readonly goalCtx: GoalContext;

  constructor(
    readonly level: LevelConfig,
    readonly seed: number,
    controls: Controls = level.defaults,
    prewarmMs = PREWARM_MS,
  ) {
    this.sim = createSim(level, controls, seed);
    this.holdMs = level.holdMs ?? DEFAULT_HOLD_MS;
    this.goalCtx = goalContext(level);
    this.tiers = [level.goals, ...level.stars.map((s) => [...level.goals, ...s.goals])];
    this.nextSample = SAMPLE_MS;
    this.metrics = this.sim.metrics();
    this.goals = this.evaluate(level.goals, controls);
    if (prewarmMs > 0) {
      this.warming = true;
      this.advance(prewarmMs);
      this.warming = false;
    }
    this.before = this.moment();
  }

  get now(): number {
    return this.sim.now;
  }

  get cleared(): boolean {
    return this.stars[0];
  }

  /** The star being worked towards: the first not yet earned, or null when all are. */
  get nextStar(): 0 | 1 | 2 | null {
    const i = this.stars.findIndex((s) => !s);
    return i < 0 ? null : (i as 0 | 1 | 2);
  }

  /** Hold progress towards the next star, for the goals panel. */
  get hold(): number {
    const next = this.nextStar;
    return next === null ? this.holdMs : this.holds[next];
  }

  controls(): Controls {
    return this.sim.controls();
  }

  /** Advance simulated time, sampling every SAMPLE_MS on the way. */
  advance(ms: number): void {
    const target = this.sim.now + ms;
    while (this.nextSample <= target) {
      this.sim.advanceTo(this.nextSample);
      this.sample();
      this.nextSample += SAMPLE_MS;
    }
    this.sim.advanceTo(target);
  }

  setControls(patch: Partial<Controls>): void {
    this.sim.setControls(patch);
    this.changes.push({ t: this.sim.now, patch });
    this.holds = [0, 0, 0];
    this.goals = this.evaluate(this.level.goals, this.sim.controls());
  }

  allPassing(): boolean {
    return this.goals.every((g) => g.pass);
  }

  status(): Status {
    if (this.cleared) return { kind: 'cleared' };
    const failing = this.goals.find((g) => !g.pass);
    if (!failing) return { kind: 'passing' };
    const m = failing.goal.metric;
    const text =
      m === 'errorRate'
        ? 'Dropping orders'
        : m === 'arrivalRate'
          ? 'Below target rate'
          : m === 'cooks'
            ? 'Over cook budget'
            : m === 'amplification'
              ? 'Wasting work'
              : `${m === 'p999' ? 'p99.9' : m} breaching SLO`;
    return { kind: 'failing', text };
  }

  private evaluate(goals: Goal[], controls: Controls): GoalResult[] {
    return goals.map((g) => evaluateGoal(g, this.metrics, controls, this.goalCtx));
  }

  private moment(): Moment {
    return { t: this.sim.now, metrics: this.metrics, controls: this.sim.controls() };
  }

  private sample(): void {
    const m = this.sim.metrics();
    this.metrics = m;
    this.history.push({
      t: m.t,
      hasLatency: m.successes > 0,
      mean: m.mean,
      p50: m.p50,
      p95: m.p95,
      p99: m.p99,
      utilization: m.utilization,
      errorRate: m.errorRate,
    });
    if (this.history.length > HISTORY_SAMPLES) this.history.shift();

    const controls = this.sim.controls();
    this.goals = this.evaluate(this.level.goals, controls);
    if (this.warming) return;
    this.tiers.forEach((goals, i) => {
      if (this.stars[i]) return;
      const pass = i === 0 ? this.allPassing() : this.evaluate(goals, controls).every((g) => g.pass);
      this.holds[i] = pass ? this.holds[i] + SAMPLE_MS : 0;
      if (this.holds[i] < this.holdMs) return;
      // Any star counts as a clear, so a strong first clear earns several at once.
      this.stars[i] = true;
      if (!this.stars[0]) this.stars[0] = true;
      if (this.clearedAt === null) {
        this.clearedAt = m.t;
        this.after = this.moment();
      }
    });
  }
}
