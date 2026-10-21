import { DEFAULT_CONTROLS } from '../sim';
import { fmtMs } from '../game/format';
import type { LevelConfig } from './types';

export const level07: LevelConfig = {
  id: 'level-07',
  number: 7,
  title: 'Everyone freezes',
  newTool: 'Shared stalls',
  story:
    'Every 5 seconds the whole kitchen stops to clean up for most of a second, like a stop-the-world garbage collector. Keep p99.9 under 1 s with six cooks.',
  workload: {
    arrivalRate: 60,
    service: { median: 30, sigma: 0.4 },
    stalls: { p: 1, minMs: 700, maxMs: 1300, scope: 'global', everyMs: 5000 },
  },
  metricsWindow: 3000,
  unlockedControls: ['cooks', 'hedge', 'staggerPauses', 'queueOrder', 'shed', 'timeout'],
  limits: { cooks: { min: 1, max: 12 }, shedMax: { min: 5, max: 80, step: 5 }, timeoutMs: { min: 50, max: 600, step: 10 } },
  defaults: { ...DEFAULT_CONTROLS, cooks: 6 },
  goals: [
    { metric: 'p999', op: '<', value: 1000 },
    { metric: 'cooks', op: '<=', value: 6 },
  ],
  stars: [
    {
      goals: [{ metric: 'cooks', op: '<=', value: 4 }],
      hint: 'For a second star, clear it with 4 cooks.',
      solution: { cooks: 4, staggerPauses: true, hedge: true, hedgeMs: 100 },
    },
    {
      goals: [{ metric: 'p999', op: '<', value: 120 }],
      hint: 'For a third star, hold p99.9 under 120 ms.',
      solution: { staggerPauses: true, hedge: true, hedgeMs: 60 },
    },
  ],
  insights: [
    {
      when: ({ controls }) => !controls.staggerPauses && controls.hedge,
      say: ({ m }) => ({
        lead: `Hedging can't help: when the kitchen stops, every cook stops. p99.9 is ${fmtMs(m.p999)}.`,
        body: 'A copy only helps if some other cook is still working.',
      }),
    },
    {
      when: ({ controls }) => !controls.staggerPauses,
      say: ({ m }) => ({
        lead: `Every order caught by a pause waits it out; p99.9 is ${fmtMs(m.p999)}.`,
        body: 'More cooks just means more cooks standing still. What if they took their breaks at different times?',
      }),
    },
    {
      when: ({ controls, m }) => controls.staggerPauses && !controls.hedge && m.p999 >= 1000,
      say: ({ m }) => ({
        lead: `p99 dropped to ${fmtMs(m.p99)}, but p99.9 is still ${fmtMs(m.p999)}.`,
        body: 'Now most cooks are working at any moment, but an order already on a pausing cook still waits. Something has to route around it.',
      }),
    },
    {
      when: () => true,
      say: ({ m }) => ({
        lead: `p99.9 is ${fmtMs(m.p999)}.`,
        body: 'With pauses staggered, a copy of a stuck order goes to a cook who is still working.',
      }),
    },
  ],
  solution: { staggerPauses: true, hedge: true, hedgeMs: 100 },
  debrief:
    "Hedging assumes slowness is independent. A stop-the-world pause on every replica at once breaks that assumption, and so does a shared dependency like a database or a lock. Staggering GC or deploys, or keeping each replica's pauses out of step, restores the independence that hedging and retries rely on.",
};
