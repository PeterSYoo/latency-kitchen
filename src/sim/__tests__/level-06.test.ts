import { describe, expect, it } from 'vitest';
import { level06 } from '../../levels/level-06';
import { earn, play } from './lesson-helpers';

describe('Level 6 · The banquet', () => {
  const all = play(level06, {});

  it('fails waiting for all ten dishes, even with more cooks', () => {
    expect(all.passes).toBe(false);
    expect(play(level06, { cooks: 14 }).m.p99).toBeGreaterThan(400);
  });

  it('the slowest dish sets the table: table p50 is far above dish p50', () => {
    expect(all.m.p50).toBeGreaterThan(all.m.leafP50 * 1.4);
  });

  it('a quorum of nine passes', () => {
    expect(play(level06, { quorum: 9 }).passes).toBe(true);
  });

  it('skipping the last dish wastes work that hedging does not', () => {
    const quorum = play(level06, { quorum: 9 }).m.amplification;
    const hedge = play(level06, { hedge: true, hedgeMs: 100 }).m.amplification;
    expect(quorum).toBeGreaterThan(hedge);
    expect(earn(level06, { hedge: true, hedgeMs: 100 }).cleared).toBe(true);
  });
});
