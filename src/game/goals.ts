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

export function goalValue(metric: GoalMetric, m: Metrics, c: Controls): number {
  switch (metric) {
    case 'cooks':
      return c.cooks;
    case 'errorRate':
      return m.errorRate;
    case 'amplification':
      return m.amplification;
    default:
      return m[metric];
  }
}

export function goalLabel(g: Goal): string {
  const op = g.op === '<' ? '<' : '≤';
  switch (g.metric) {
    case 'cooks':
      return `Cooks ${op} ${g.value}`;
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
  if (metric === 'errorRate') return pct(v);
  if (metric === 'amplification') return `${v.toFixed(2)}×`;
  return fmtMs(v);
}

export function evaluateGoal(g: Goal, m: Metrics, c: Controls): GoalResult {
  const value = goalValue(g.metric, m, c);
  const enough = !LATENCY.includes(g.metric) || m.count >= MIN_SAMPLES;
  const pass = enough && (g.op === '<' ? value < g.value : value <= g.value);
  return { goal: g, label: goalLabel(g), value, display: formatGoalValue(g.metric, value), pass };
}

/** The level's latency SLO, drawn on the charts: its first latency goal. */
export function latencySlo(goals: Goal[]): { metric: GoalMetric; value: number } | null {
  const g = goals.find((x) => LATENCY.includes(x.metric));
  return g ? { metric: g.metric, value: g.value } : null;
}
