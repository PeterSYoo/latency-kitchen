import type { Controls, Metrics, SimConfig } from '../sim';

export type GoalMetric =
  | 'mean'
  | 'p50'
  | 'p95'
  | 'p99'
  | 'p999'
  | 'errorRate'
  | 'amplification'
  /** Cooks, plus one slot for the cache when it's on. */
  | 'cooks'
  /** The arrival rate the player has dialled in, orders per second. */
  | 'arrivalRate';

export interface Goal {
  metric: GoalMetric;
  op: '<' | '<=' | '>=';
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

export interface StarGoal {
  goals: Goal[];
  hint: string;
  solution: Partial<Controls>;
}

export type ControlKey = 'cooks' | 'arrivalRate' | 'hedge' | 'queueOrder' | 'shed' | 'cache' | 'timeout';

interface Range {
  min: number;
  max: number;
  step: number;
}

export interface LevelConfig extends SimConfig {
  id: string; // 'level-01'
  number: number;
  title: string; // 'Fix the stragglers'
  story: string; // one paragraph
  newTool: string;
  unlockedControls: ControlKey[];
  limits: {
    cooks: { min: number; max: number };
    arrivalRate?: Range;
    shedMax?: Range;
    timeoutMs?: Range;
  };
  defaults: Controls; // the bad starting setup
  goals: Goal[];
  /** How long every goal must hold at once. Default 15,000 simulated ms. */
  holdMs?: number;
  /**
   * The second and third stars: extra goals held on top of the level's own,
   * a hint shown after a clear, and a known setup that earns it (checked in CI).
   */
  stars: [StarGoal, StarGoal];
  /** Checked in order; the first match is shown. The last should always match. */
  insights: InsightRule[];
  solution: Partial<Controls>; // known clearing setup, checked in CI
  debrief: string;
}
