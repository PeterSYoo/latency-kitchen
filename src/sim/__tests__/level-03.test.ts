import { describe, expect, it } from 'vitest';
import { level03 } from '../../levels/level-03';
import { earn, play } from './lesson-helpers';

describe('Level 3 · Who goes first', () => {
  const fifo = play(level03, {});
  const lifo = play(level03, { queueOrder: 'lifo' });

  it('fails with an unbounded FIFO queue', () => {
    expect(fifo.passes).toBe(false);
    expect(fifo.m.p99).toBeGreaterThan(400);
  });

  it('LIFO looks great at p50 and is far worse at p99', () => {
    expect(lifo.m.p50).toBeLessThan(fifo.m.p50);
    expect(lifo.m.p99).toBeGreaterThan(fifo.m.p99 * 2);
    expect(earn(level03, { queueOrder: 'lifo' }).cleared).toBe(false);
  });

  it('does not clear by hiring a ninth cook', () => {
    expect(earn(level03, { cooks: 9 }).cleared).toBe(false);
  });

  it('trades latency for errors as the cap tightens', () => {
    const tight = play(level03, { shed: true, shedMax: 10 });
    const loose = play(level03, { shed: true, shedMax: 60 });
    expect(tight.m.p99).toBeLessThan(loose.m.p99);
    expect(tight.m.errorRate).toBeGreaterThan(loose.m.errorRate);
    expect(earn(level03, { shed: true, shedMax: 5 }).cleared).toBe(false);
  });
});
