import type { Controls, Metrics } from '../sim';
import type { Goal, GoalMetric } from '../levels/types';
import { fmtMs, pct } from './format';

/** Percentile goals need this many orders in the window before they can pass. */
export const MIN_SAMPLES = 1000;

export interface GoalResult {
  goal: Goal;
  label: string;
  value: number;
  display: string;
  pass: boolean;
}

const LATENCY: GoalMetric[] = ['mean', 'p50', 'p95', 'p99', 'p999'];

export function goalValue(metric: GoalMetric, m: Metrics, c: Controls, baseRate = 0): number {
  switch (metric) {
    case 'cooks':
      return c.cooks + (c.cache ? 1 : 0);
    case 'arrivalRate':
      return c.arrivalRate ?? baseRate;
    case 'errorRate':
      return m.errorRate;
    case 'amplification':
      return m.amplification;
    default:
      return m[metric];
  }
}

export function goalLabel(g: Goal, cacheUnlocked = false): string {
  const op = g.op === '<' ? '<' : g.op === '<=' ? '≤' : '≥';
  switch (g.metric) {
    case 'cooks':
      return cacheUnlocked ? `Cooks + prep ${op} ${g.value}` : `Cooks ${op} ${g.value}`;
    case 'arrivalRate':
      return `Orders ${op} ${g.value}/s`;
    case 'errorRate':
      return `Dropped ${op} ${pct(g.value, 0)}`;
    case 'amplification':
      return `Amplification ${op} ${g.value}×`;
    case 'p999':
      return `p99.9 ${op} ${fmtMs(g.value)}`;
    default:
      return `${g.metric} ${op} ${fmtMs(g.value)}`;
  }
}

export function formatGoalValue(metric: GoalMetric, v: number): string {
  if (metric === 'cooks') return String(v);
  if (metric === 'arrivalRate') return `${v}/s`;
  if (metric === 'errorRate') return pct(v);
  if (metric === 'amplification') return Number.isFinite(v) ? `${v.toFixed(2)}×` : '∞';
  return fmtMs(v);
}

export interface GoalContext {
  /** The level's own arrival rate, for when the player hasn't dialled one in. */
  baseRate: number;
  cacheUnlocked: boolean;
}

export function evaluateGoal(g: Goal, m: Metrics, c: Controls, ctx: GoalContext = { baseRate: 0, cacheUnlocked: false }): GoalResult {
  const value = goalValue(g.metric, m, c, ctx.baseRate);
  // Latency needs a full-enough window; a window of nothing but errors has no latency at all.
  const enough = !LATENCY.includes(g.metric) || (m.count >= MIN_SAMPLES && m.errorRate < 1);
  const pass =
    enough && (g.op === '<' ? value < g.value : g.op === '<=' ? value <= g.value : value >= g.value);
  return { goal: g, label: goalLabel(g, ctx.cacheUnlocked), value, display: formatGoalValue(g.metric, value), pass };
}

export function goalContext(level: { workload: { arrivalRate: number }; unlockedControls: string[] }): GoalContext {
  return { baseRate: level.workload.arrivalRate, cacheUnlocked: level.unlockedControls.includes('cache') };
}

/** The level's latency SLO, drawn on the charts: its first latency goal. */
export function latencySlo(goals: Goal[]): { metric: GoalMetric; value: number } | null {
  const g = goals.find((x) => LATENCY.includes(x.metric));
  return g ? { metric: g.metric, value: g.value } : null;
}
