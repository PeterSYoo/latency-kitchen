import { DEFAULT_CONTROLS } from '../sim';
import { fmtMs, pct } from '../game/format';
import type { LevelConfig } from './types';

export const level03: LevelConfig = {
  id: 'level-03',
  number: 3,
  title: 'Who goes first',
  newTool: 'Queue order and shedding',
  story:
    'Tour buses pull up every 15 seconds and swamp eight cooks for a few seconds at a time. Keep p99 under 400 ms. You may turn some customers away at the door, but no more than 5%.',
  workload: {
    arrivalRate: 88,
    service: { median: 40, sigma: 0.5 },
    bursts: [{ atMs: 8000, durationMs: 4000, multiplier: 2.25, everyMs: 15000 }],
  },
  metricsWindow: 3000,
  holdMs: 20_000,
  unlockedControls: ['cooks', 'hedge', 'queueOrder', 'shed'],
  limits: { cooks: { min: 1, max: 10 }, shedMax: { min: 5, max: 80, step: 5 } },
  defaults: { ...DEFAULT_CONTROLS, cooks: 8, shedMax: 40 },
  goals: [
    { metric: 'p99', op: '<', value: 400 },
    { metric: 'errorRate', op: '<', value: 0.05 },
    { metric: 'cooks', op: '<=', value: 8 },
  ],
  stars: [
    {
      goals: [{ metric: 'errorRate', op: '<', value: 0.03 }],
      hint: 'For a second star, clear it turning away under 3%.',
      solution: { shed: true, shedMax: 45 },
    },
    {
      goals: [{ metric: 'p99', op: '<', value: 300 }],
      hint: 'For a third star, go the other way: p99 under 300 ms.',
      solution: { shed: true, shedMax: 25 },
    },
  ],
  insights: [
    {
      when: ({ controls }) => controls.queueOrder === 'lifo',
      say: ({ m }) => ({
        lead: `LIFO makes p50 look great (${fmtMs(m.p50)}) while p99 is ${fmtMs(m.p99)}.`,
        body: 'The newest order always goes first, so whoever arrived early in a burst waits until the line is empty.',
      }),
    },
    {
      when: ({ m }) => m.errorRate >= 0.05,
      say: ({ m }) => ({
        lead: `${pct(m.errorRate)} of customers were turned away.`,
        body: 'A short line protects latency but costs customers. Let the line grow a little longer.',
      }),
    },
    {
      when: ({ controls, m }) => !controls.shed && m.p99 >= 400,
      say: ({ m }) => ({
        lead: `Each burst leaves a line behind it, and p99 is ${fmtMs(m.p99)}.`,
        body: 'Everyone who arrives behind that line waits for all of it. Capping the line turns some slow orders into quick refusals.',
      }),
    },
    {
      when: ({ m }) => m.p99 < 400,
      say: ({ m }) => ({
        lead: `p99 is ${fmtMs(m.p99)} with ${pct(m.errorRate)} turned away.`,
        body: 'The cap keeps every burst short. That is the trade: a few fast errors for no slow successes.',
      }),
    },
    {
      when: () => true,
      say: ({ m }) => ({
        lead: `p99 is ${fmtMs(m.p99)}.`,
        body: 'The line is still long enough to push the tail over 400 ms. Try a lower cap.',
      }),
    },
  ],
  solution: { shed: true, shedMax: 35 },
  debrief:
    'A bounded queue turns overload into fast failures instead of slow successes, which is why servers cap their accept queues and thread pools. Some systems switch to LIFO under overload, such as Facebook\'s adaptive LIFO, but only alongside timeouts, because on its own LIFO starves the oldest requests.',
};
