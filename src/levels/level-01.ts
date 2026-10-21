import { DEFAULT_CONTROLS } from '../sim';
import { fmtMs } from '../game/format';
import type { LevelConfig } from './types';

export const level01: LevelConfig = {
  id: 'level-01',
  number: 1,
  title: 'Fix the stragglers',
  newTool: 'Hedging',
  story:
    'Orders arrive at 30 per second. Most dishes take about 40 ms, but 4% hit a stall, like a GC pause, and take most of a second. Bring p99 under the 250 ms SLO without hiring more cooks.',
  workload: {
    arrivalRate: 30,
    service: { median: 38, sigma: 0.5 },
    stalls: { p: 0.04, minMs: 350, maxMs: 950, scope: 'request' },
  },
  unlockedControls: ['cooks', 'hedge'],
  limits: { cooks: { min: 1, max: 6 } },
  defaults: { ...DEFAULT_CONTROLS, cooks: 3, hedge: false, hedgeMs: 120 },
  goals: [
    { metric: 'p99', op: '<', value: 250 },
    { metric: 'errorRate', op: '<', value: 0.01 },
    { metric: 'cooks', op: '<=', value: 3 },
  ],
  stars: [
    {
      goals: [{ metric: 'p99', op: '<', value: 200 }],
      hint: 'For a second star, hold p99 under 200 ms.',
      solution: { hedge: true, hedgeMs: 90 },
    },
    {
      goals: [{ metric: 'amplification', op: '<', value: 1.2 }],
      hint: 'For a third star, waste less: keep amplification under 1.2×.',
      solution: { hedge: true, hedgeMs: 110 },
    },
  ],
  insights: [
    {
      when: ({ m }) => m.p99 < 250,
      say: ({ m }) => ({
        lead: `p99 is ${fmtMs(m.p99)}.`,
        body: 'The worst 1 in 100 customers now waits about as long as a normal order. Notice how little the mean changed compared with p99.',
      }),
    },
    {
      when: ({ controls }) => controls.cooks > 3 && !controls.hedge,
      say: ({ m }) => ({
        lead: `More cooks shortened the line, but p99 is still ${fmtMs(m.p99)}.`,
        body: "The slow orders aren't waiting, they're stalled on the stove. Extra capacity can't fix work that is itself slow.",
      }),
    },
    {
      when: ({ controls }) => controls.hedge && controls.hedgeMs < 70,
      say: ({ m }) => ({
        lead: 'Hedging this early copies most orders.',
        body: `Cooks are ${Math.round(m.utilization * 100)}% busy, so the copies start crowding out real work.`,
      }),
    },
    {
      when: ({ controls }) => controls.hedge && controls.hedgeMs > 200,
      say: ({ controls }) => ({
        lead: `Hedging at ${controls.hedgeMs} ms is too late to save the stragglers.`,
        body: 'A copy only helps if it can finish before the SLO. Try hedging near p95.',
      }),
    },
    {
      when: () => true,
      say: ({ m }) => ({
        lead: `The mean is ${fmtMs(m.mean)}, but p99 is ${fmtMs(m.p99)}, about ${Math.round(m.p99 / Math.max(1, m.mean))}× worse.`,
        body: 'A dashboard that only shows the average would say this kitchen is fine.',
      }),
    },
  ],
  solution: { cooks: 3, hedge: true, hedgeMs: 90 },
  debrief:
    "This is what Google's \"The Tail at Scale\" paper calls hedged requests. Most slow requests are slow because of something temporary on one server, so a second copy on another server usually finishes fast. Hedge near p95 and only about 5% of requests cost double.",
};
