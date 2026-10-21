import { DEFAULT_CONTROLS, type Controls, type Metrics } from '../sim';
import type { LevelConfig, ScoreBreakdown } from './types';

/** 100 points, less penalties for tail latency, failures, cost and waste. */
export function headChefScore(m: Metrics, c: Controls): ScoreBreakdown {
  const latency = m.successes > 0 ? Math.max(0, m.p99 - 150) / 10 : 100;
  const parts = [
    { label: 'p99 over 150 ms', points: latency },
    { label: 'failed orders', points: m.errorRate * 300 },
    { label: 'cooks and prep', points: 4 * Math.max(0, c.cooks + (c.cache ? 1 : 0) - 2) },
    { label: 'wasted work', points: Number.isFinite(m.amplification) ? Math.max(0, m.amplification - 1) * 50 : 100 },
  ].map((p) => ({ ...p, points: Math.round(Math.min(100, p.points) * 10) / 10 }));
  const score = Math.max(0, 100 - parts.reduce((a, p) => a + p.points, 0));
  return { score, parts };
}

export const level08: LevelConfig = {
  id: 'level-08',
  number: 8,
  title: 'Head chef',
  newTool: 'Everything',
  story:
    'Your own kitchen, every tool unlocked: stalls, lunch rushes and repeat orders all at once. No single right answer. Score points for a fast tail, few failures, few cooks and little waste.',
  workload: {
    arrivalRate: 50,
    service: { median: 30, sigma: 0.5 },
    stalls: { p: 0.03, minMs: 300, maxMs: 900, scope: 'request' },
    bursts: [{ atMs: 8000, durationMs: 4000, multiplier: 1.4, everyMs: 20000 }],
    cache: { hitRate: 0.5, hitMs: 4, burstHitRate: 0.3 },
  },
  metricsWindow: 3000,
  holdMs: 20_000,
  unlockedControls: ['cooks', 'hedge', 'queueOrder', 'shed', 'cache', 'timeout'],
  limits: { cooks: { min: 1, max: 10 }, shedMax: { min: 2, max: 60, step: 1 }, timeoutMs: { min: 50, max: 600, step: 10 } },
  defaults: { ...DEFAULT_CONTROLS, cooks: 4 },
  goals: [{ metric: 'score', op: '>=', value: 50 }],
  stars: [
    {
      goals: [{ metric: 'score', op: '>=', value: 70 }],
      hint: 'For a second star, hold a score of 70.',
      solution: {},
    },
    {
      goals: [{ metric: 'score', op: '>=', value: 85 }],
      hint: 'For a third star, hold a score of 85.',
      solution: { hedge: false, timeout: true, timeoutMs: 120, cancel: true },
    },
  ],
  insights: [
    {
      when: () => true,
      say: ({ m, controls }) => {
        const { score, parts } = headChefScore(m, controls);
        const lost = parts.filter((p) => p.points >= 0.5).sort((a, b) => b.points - a.points);
        return {
          lead: `Score ${Math.round(score)}.`,
          body: lost.length
            ? `Points lost: ${lost.map((p) => `${Math.round(p.points)} to ${p.label}`).join(', ')}.`
            : 'Nothing lost. Nicely run.',
        };
      },
    },
  ],
  score: headChefScore,
  scoreHelp:
    'Score = 100, minus 1 point per 10 ms of p99 over 150 ms, 3 per 1% of failed orders, 4 per cook or prep slot past two, and 5 per 10% of wasted work.',
  solution: { cooks: 3, cache: true, hedge: true, hedgeMs: 90 },
  debrief:
    'Real systems combine these tools: a cache in front, hedging for stragglers, bounded queues for bursts, and timeouts with cancellation as the last line of defence. Each one has a cost, and the best setup depends on which kind of slowness you have.',
};
