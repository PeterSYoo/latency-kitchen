import type { Controls, Metrics, SimConfig } from '../sim';

export type GoalMetric = 'mean' | 'p50' | 'p95' | 'p99' | 'p999' | 'errorRate' | 'amplification' | 'cooks';

export interface Goal {
  metric: GoalMetric;
  op: '<' | '<=';
  value: number;
}

export interface InsightContext {
  m: Metrics;
  controls: Controls;
  level: LevelConfig;
}

/** One sentence for the "What's happening" panel: a bold lead, then the explanation. */
export interface Insight {
  lead: string;
  body?: string;
}

export interface InsightRule {
  when: (c: InsightContext) => boolean;
  say: (c: InsightContext) => Insight;
}

export type ControlKey = 'cooks' | 'hedge' | 'queueOrder';

export interface LevelConfig extends SimConfig {
  id: string; // 'level-01'
  number: number;
  title: string; // 'Fix the stragglers'
  story: string; // one paragraph
  newTool: string;
  unlockedControls: ControlKey[];
  limits: { cooks: { min: number; max: number } };
  defaults: Controls; // the bad starting setup
  goals: Goal[];
  /** How long every goal must hold at once. Default 15,000 simulated ms. */
  holdMs?: number;
  /** The tighter budget for a second star, and the hint shown after a clear. */
  secondStar: { goals: Goal[]; hint: string };
  /** Checked in order; the first match is shown. The last should always match. */
  insights: InsightRule[];
  solution: Partial<Controls>; // known clearing setup, checked in CI
  debrief: string;
}
