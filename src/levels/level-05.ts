import { DEFAULT_CONTROLS } from '../sim';
import { fmtMs, pct } from '../game/format';
import type { LevelConfig } from './types';

export const level05: LevelConfig = {
  id: 'level-05',
  number: 5,
  title: 'Give up and try again',
  newTool: 'Timeouts and retries',
  story:
    'Cook 1 keeps getting distracted: 60% of their dishes take most of a second. Customers may give up and reorder. Keep p99 under 300 ms without spending more than 30% extra work.',
  workload: {
    arrivalRate: 90,
    service: { median: 30, sigma: 0.4 },
    stalls: { p: 0.6, minMs: 600, maxMs: 900, scope: 'cook' },
  },
  unlockedControls: ['cooks', 'hedge', 'queueOrder', 'shed', 'timeout'],
  limits: { cooks: { min: 1, max: 8 }, shedMax: { min: 5, max: 80, step: 5 }, timeoutMs: { min: 50, max: 600, step: 10 } },
  defaults: { ...DEFAULT_CONTROLS, cooks: 5, timeoutMs: 150, maxRetries: 2 },
  goals: [
    { metric: 'p99', op: '<', value: 300 },
    { metric: 'amplification', op: '<', value: 1.3 },
    { metric: 'errorRate', op: '<', value: 0.01 },
    { metric: 'cooks', op: '<=', value: 5 },
  ],
  stars: [
    {
      goals: [{ metric: 'p99', op: '<', value: 250 }],
      hint: 'For a second star, hold p99 under 250 ms.',
      solution: { timeout: true, timeoutMs: 100, maxRetries: 2, cancel: true },
    },
    {
      goals: [{ metric: 'errorRate', op: '<', value: 0.005 }],
      hint: 'For a third star, fail under 0.5% of orders.',
      solution: { timeout: true, timeoutMs: 120, maxRetries: 2, backoffMs: 20, cancel: true },
    },
  ],
  insights: [
    {
      when: ({ controls, m }) => controls.timeout && !controls.cancel && m.errorRate > 0.05,
      say: ({ m }) => ({
        lead: `Retry storm: ${pct(m.errorRate, 0)} of orders are failing.`,
        body: 'Abandoned orders keep cooking, so every retry adds load and makes the next timeout more likely. Stop abandoned work.',
      }),
    },
    {
      when: ({ controls }) => !controls.timeout && !controls.hedge,
      say: ({ m }) => ({
        lead: `Orders that land on cook 1 can take a second; p99 is ${fmtMs(m.p99)}.`,
        body: "Adding cooks doesn't help: cook 1 still gets its share. A customer who gives up and reorders will probably get someone else.",
      }),
    },
    {
      when: ({ m }) => m.amplification >= 1.3,
      say: ({ m }) => ({
        lead: `Amplification is ${Number.isFinite(m.amplification) ? m.amplification.toFixed(2) + '×' : '∞'}.`,
        body: 'Too much work goes to orders nobody is waiting for. A later timeout or cancellation cuts the waste.',
      }),
    },
    {
      when: ({ m }) => m.p99 < 300,
      say: ({ m }) => ({
        lead: `p99 is ${fmtMs(m.p99)} at ${m.amplification.toFixed(2)}× work.`,
        body: 'Cancelled attempts stop at once, so retries cost little more than the time lost on cook 1.',
      }),
    },
    {
      when: () => true,
      say: ({ m }) => ({ lead: `p99 is ${fmtMs(m.p99)}.`, body: 'Watch the cook rows: abandoned orders are outlined.' }),
    },
  ],
  solution: { timeout: true, timeoutMs: 120, maxRetries: 2, cancel: true },
  debrief:
    'Timeouts without cancellation are how retry storms start: the client gives up, the server keeps working, and every retry adds load. Real systems pass deadlines downstream, like gRPC deadlines or context cancellation in Go, and cap retries with budgets and backoff. Hedging would also have worked here; it is the proactive version of the same idea.',
};
