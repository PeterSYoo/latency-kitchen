import { DEFAULT_CONTROLS } from '../sim';
import { fmtMs, pct } from '../game/format';
import type { LevelConfig } from './types';

export const level04: LevelConfig = {
  id: 'level-04',
  number: 4,
  title: 'The walk-in fridge',
  newTool: 'Cache',
  story:
    'Most orders are repeats, so a prep station can serve 60% of them in 4 ms. Prep takes one of your three spots, and when a tour bus arrives its orders are new and mostly miss. Keep p99 under 200 ms.',
  workload: {
    arrivalRate: 92,
    service: { median: 30, sigma: 0.5 },
    bursts: [{ atMs: 8000, durationMs: 4000, multiplier: 1.2, everyMs: 20000 }],
    cache: { hitRate: 0.6, hitMs: 4, burstHitRate: 0.35 },
  },
  metricsWindow: 3000,
  holdMs: 20_000,
  unlockedControls: ['cooks', 'hedge', 'queueOrder', 'shed', 'cache'],
  limits: { cooks: { min: 1, max: 6 }, shedMax: { min: 2, max: 30, step: 1 } },
  defaults: { ...DEFAULT_CONTROLS, cooks: 3, shedMax: 12 },
  goals: [
    { metric: 'p99', op: '<', value: 200 },
    { metric: 'errorRate', op: '<', value: 0.05 },
    { metric: 'cooks', op: '<=', value: 3 },
  ],
  stars: [
    {
      goals: [{ metric: 'p99', op: '<', value: 150 }],
      hint: 'For a second star, hold p99 under 150 ms.',
      solution: { cooks: 2, cache: true, shed: true, shedMax: 4 },
    },
    {
      goals: [{ metric: 'errorRate', op: '<', value: 0.035 }],
      hint: 'For a third star, turn away under 3.5%.',
      solution: { cooks: 2, cache: true, shed: true, shedMax: 8 },
    },
  ],
  insights: [
    {
      when: ({ controls, m }) => !controls.cache && m.utilization > 0.95,
      say: ({ m }) => ({
        lead: `Three cooks can't keep up: they're ${Math.round(m.utilization * 100)}% busy.`,
        body: 'Most orders are repeats. Prep can serve them without a cook, if you give it a spot.',
      }),
    },
    {
      when: ({ controls, m }) => controls.cache && m.cacheHitRate < 0.45,
      say: ({ m }) => ({
        lead: `Prep is hitting only ${pct(m.cacheHitRate, 0)} right now.`,
        body: 'Burst orders are new dishes, so the cache misses exactly when the kitchen is busiest.',
      }),
    },
    {
      when: ({ controls, m }) => controls.cache && !controls.shed && m.p99 >= 200,
      say: ({ m }) => ({
        lead: `Between bursts the kitchen is fine, but p99 is ${fmtMs(m.p99)}.`,
        body: 'Two cooks can carry the load only while prep hits. When it misses, the line needs a limit.',
      }),
    },
    {
      when: ({ m }) => m.p99 < 200,
      say: ({ m }) => ({
        lead: `p99 is ${fmtMs(m.p99)} with prep hitting ${pct(m.cacheHitRate, 0)}.`,
        body: 'The cache does the steady work and the queue cap absorbs the misses.',
      }),
    },
    {
      when: () => true,
      say: ({ m }) => ({ lead: `p99 is ${fmtMs(m.p99)}.`, body: 'Look at what happens to the line during each burst.' }),
    },
  ],
  solution: { cooks: 2, cache: true, shed: true, shedMax: 6 },
  debrief:
    "A cache is capacity you can't fully count on. A cold start, a launch or a flush sends full load to the backend at once, the thundering herd. Teams either size the backend for cache-miss traffic or shed load when the hit rate drops.",
};
