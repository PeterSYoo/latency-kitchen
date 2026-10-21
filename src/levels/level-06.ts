import { DEFAULT_CONTROLS } from '../sim';
import { fmtMs } from '../game/format';
import type { LevelConfig } from './types';

const DISHES = 10;
const STALL_P = 0.01;
/** Share of tables that wait on at least one slow dish. */
const SLOW_TABLES = 1 - (1 - STALL_P) ** DISHES;

export const level06: LevelConfig = {
  id: 'level-06',
  number: 6,
  title: 'The banquet',
  newTool: 'Fan-out and quorum',
  story:
    'Every table orders 10 dishes, cooked in parallel by ten cooks. A dish stalls only 1% of the time, but the table waits for its slowest dish. Keep table p99 under 400 ms.',
  workload: {
    arrivalRate: 25,
    service: { median: 20, sigma: 0.4 },
    stalls: { p: STALL_P, minMs: 400, maxMs: 900, scope: 'request' },
    fanOut: { k: DISHES },
  },
  unlockedControls: ['cooks', 'quorum', 'hedge', 'queueOrder', 'shed', 'timeout'],
  limits: {
    cooks: { min: 4, max: 16 },
    shedMax: { min: 10, max: 200, step: 10 },
    timeoutMs: { min: 50, max: 600, step: 10 },
  },
  defaults: { ...DEFAULT_CONTROLS, cooks: 10, quorum: DISHES, shedMax: 100 },
  goals: [
    { metric: 'p99', op: '<', value: 400 },
    { metric: 'cooks', op: '<=', value: 10 },
  ],
  stars: [
    {
      goals: [{ metric: 'p99', op: '<', value: 200 }],
      hint: 'For a second star, hold table p99 under 200 ms.',
      solution: { quorum: 9 },
    },
    {
      goals: [{ metric: 'amplification', op: '<', value: 1.1 }],
      hint: 'For a third star, waste less: amplification under 1.1×.',
      solution: { quorum: DISHES, hedge: true, hedgeMs: 100 },
    },
  ],
  insights: [
    {
      when: ({ controls }) => (controls.quorum ?? DISHES) >= DISHES && !controls.hedge,
      say: ({ m }) => ({
        lead: `A single dish takes ${fmtMs(m.leafP50)} at the median, but a table takes ${fmtMs(m.p50)}.`,
        body: `Each dish is slow only 1% of the time, yet ${Math.round(SLOW_TABLES * 100)}% of tables wait on at least one slow dish. The slowest dish sets the table's time.`,
      }),
    },
    {
      when: ({ m }) => m.p99 < 400,
      say: ({ m, controls }) => ({
        lead: `Table p99 is ${fmtMs(m.p99)}.`,
        body:
          (controls.quorum ?? DISHES) < DISHES
            ? 'Serving without the last dish means one straggler no longer holds up the table. The skipped dish is wasted work.'
            : 'Copying slow dishes means a straggler rarely sets the table time.',
      }),
    },
    {
      when: () => true,
      say: ({ m }) => ({
        lead: `Single-dish p99 is ${fmtMs(m.leafP99)}; table p99 is ${fmtMs(m.p99)}.`,
        body: 'More cooks shorten the line, but a stalled dish is still stalled.',
      }),
    },
  ],
  solution: { quorum: 9 },
  debrief:
    'Fan-out turns rare slowness into common slowness: with 10 parallel calls, the root waits on the slowest, so leaf p93 becomes root p50. At 100 calls, leaf p99 is the root median. Search engines and databases answer with a quorum or partial results, or hedge the slow leaves, rather than wait for every shard.',
};
