import { describe, expect, it } from 'vitest';
import { PROTOTYPE, run } from './helpers';

// Level 1 lesson numbers that don't need hedging yet. Targets come from the
// reference prototype (seed 42): 3 cooks ~900 ms, 6 cooks ~840 ms, LIFO ~1,240 ms.
describe('prototype workload (Level 1, no hedging)', () => {
  const three = run(PROTOTYPE, { cooks: 3, queueOrder: 'fifo' }).metrics();
  const six = run(PROTOTYPE, { cooks: 6, queueOrder: 'fifo' }).metrics();
  const lifo = run(PROTOTYPE, { cooks: 3, queueOrder: 'lifo' }).metrics();

  it('fails the 250 ms goal with 3 cooks', () => {
    expect(three.p99).toBeGreaterThan(250);
    expect(three.mean).toBeLessThan(three.p99 / 3);
  });

  it('barely moves p99 with 6 cooks', () => {
    expect(six.p99).toBeGreaterThan(250);
    expect(Math.abs(six.p99 - three.p99) / three.p99).toBeLessThan(0.15);
  });

  it('LIFO improves p50 and hurts p99', () => {
    expect(lifo.p50).toBeLessThan(three.p50);
    expect(lifo.p99).toBeGreaterThan(three.p99);
  });

  it('logs the numbers for tuning', () => {
    const fmt = (m: typeof three) =>
      `mean ${m.mean.toFixed(0)}  p50 ${m.p50.toFixed(0)}  p95 ${m.p95.toFixed(0)}  p99 ${m.p99.toFixed(0)}  util ${(m.utilization * 100).toFixed(0)}%`;
    console.log(`3 cooks FIFO  ${fmt(three)}\n6 cooks FIFO  ${fmt(six)}\n3 cooks LIFO  ${fmt(lifo)}`);
  });
});
