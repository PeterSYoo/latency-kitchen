// One play-through of a level: the engine plus sampled history, goals and the
// hold window. Pure TypeScript and driven by simulated time, so it runs the
// same in the browser and in tests.

import { createSim, type Controls, type Metrics, type Sim } from '../sim';
import type { LevelConfig } from '../levels/types';
import { evaluateGoal, type GoalResult } from './goals';

/** Seed for a level's first play; Reset moves to the next one. */
export const FIRST_SEED = 1;
export const SAMPLE_MS = 500;
export const HISTORY_SAMPLES = 120; // 60 s
/** Run the bad default setup this long before showing the level, so the charts start full. */
export const PREWARM_MS = 70_000;
const DEFAULT_HOLD_MS = 15_000;

export interface Sample {
  t: number;
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

export class Session {
  readonly sim: Sim;
  readonly holdMs: number;
  history: Sample[] = [];
  goals: GoalResult[] = [];
  metrics: Metrics;
  hold = 0;
  cleared = false;
  clearedAt: number | null = null;
  /** Control changes the player made, for the debrief. */
  changes: { t: number; patch: Partial<Controls> }[] = [];
  private nextSample: number;
  private warming = false;

  constructor(
    readonly level: LevelConfig,
    readonly seed: number,
    controls: Controls = level.defaults,
    prewarmMs = PREWARM_MS,
  ) {
    this.sim = createSim(level, controls, seed);
    this.holdMs = level.holdMs ?? DEFAULT_HOLD_MS;
    this.nextSample = SAMPLE_MS;
    this.metrics = this.sim.metrics();
    this.goals = level.goals.map((g) => evaluateGoal(g, this.metrics, controls));
    if (prewarmMs > 0) {
      this.warming = true;
      this.advance(prewarmMs);
      this.warming = false;
    }
  }

  get now(): number {
    return this.sim.now;
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
    if (!this.cleared) this.hold = 0;
    this.goals = this.level.goals.map((g) => evaluateGoal(g, this.metrics, this.sim.controls()));
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
        : m === 'cooks'
          ? 'Over cook budget'
          : m === 'amplification'
            ? 'Wasting work'
            : `${m === 'p999' ? 'p99.9' : m} breaching SLO`;
    return { kind: 'failing', text };
  }

  private sample(): void {
    const m = this.sim.metrics();
    this.metrics = m;
    this.history.push({
      t: m.t,
      mean: m.mean,
      p50: m.p50,
      p95: m.p95,
      p99: m.p99,
      utilization: m.utilization,
      errorRate: m.errorRate,
    });
    if (this.history.length > HISTORY_SAMPLES) this.history.shift();

    const controls = this.sim.controls();
    this.goals = this.level.goals.map((g) => evaluateGoal(g, m, controls));
    if (this.cleared || this.warming) return;
    this.hold = this.allPassing() ? this.hold + SAMPLE_MS : 0;
    if (this.hold >= this.holdMs) {
      this.cleared = true;
      this.clearedAt = m.t;
    }
  }
}
