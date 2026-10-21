import { DEFAULT_CONTROLS } from '../sim';
import { fmtMs } from '../game/format';
import type { LevelConfig } from './types';

export const level02: LevelConfig = {
  id: 'level-02',
  number: 2,
  title: 'Rush hour',
  newTool: 'Utilization dial',
  story:
    'Lunch rush. You decide how many orders per second the front desk accepts. Three cooks take about 45 ms a dish. Take as much business as you can while p99 stays under 300 ms.',
  workload: {
    arrivalRate: 64,
    service: { median: 40, sigma: 0.5 },
  },
  unlockedControls: ['arrivalRate', 'cooks', 'hedge'],
  limits: { cooks: { min: 1, max: 6 }, arrivalRate: { min: 20, max: 70, step: 2 } },
  defaults: { ...DEFAULT_CONTROLS, cooks: 3, arrivalRate: 64 },
  goals: [
    { metric: 'p99', op: '<', value: 300 },
    { metric: 'arrivalRate', op: '>=', value: 48 },
    { metric: 'cooks', op: '<=', value: 3 },
  ],
  stars: [
    {
      goals: [{ metric: 'arrivalRate', op: '>=', value: 52 }],
      hint: 'For a second star, hold the SLO at 52 orders/s.',
      solution: { arrivalRate: 52 },
    },
    {
      goals: [{ metric: 'arrivalRate', op: '>=', value: 54 }],
      hint: 'For a third star, hold it at 54 orders/s.',
      solution: { arrivalRate: 54 },
    },
  ],
  insights: [
    {
      when: ({ m }) => m.utilization > 0.85 && m.p99 >= 300,
      say: ({ m }) => ({
        lead: `Cooks are ${Math.round(m.utilization * 100)}% busy and p99 is ${fmtMs(m.p99)}.`,
        body: 'Past about 75% busy, each extra order waits behind a longer line. The queue grows much faster than the load.',
      }),
    },
    {
      when: ({ controls }) => (controls.arrivalRate ?? 0) < 48,
      say: ({ m }) => ({
        lead: `p99 is ${fmtMs(m.p99)}, but the cooks are idle ${Math.round((1 - m.utilization) * 100)}% of the time.`,
        body: 'Turning business away is the other way to miss the target. Find the highest rate that still holds the SLO.',
      }),
    },
    {
      when: ({ m }) => m.p99 < 300,
      say: ({ m }) => ({
        lead: `${Math.round(m.utilization * 100)}% busy, p99 ${fmtMs(m.p99)}.`,
        body: 'Try a little more load and watch how quickly p99 bends upward near the edge.',
      }),
    },
    {
      when: () => true,
      say: ({ m }) => ({
        lead: `p99 is ${fmtMs(m.p99)} with cooks ${Math.round(m.utilization * 100)}% busy.`,
        body: 'Random bursts of orders pile up faster than three cooks can clear them.',
      }),
    },
  ],
  solution: { arrivalRate: 48 },
  debrief:
    'Queueing delay grows roughly like ρ/(1−ρ), where ρ is utilization: going from 50% to 75% busy triples the wait, and 75% to 90% triples it again. This is why capacity planners aim for 60–75% at peak, and why autoscalers add servers well before 100%.',
};
