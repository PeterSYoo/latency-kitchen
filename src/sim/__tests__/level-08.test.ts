import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTROLS } from '../engine';
import { headChefScore, level08 } from '../../levels/level-08';
import type { Metrics } from '../types';
import { earn } from './lesson-helpers';

describe('Level 8 · Head chef', () => {
  it('scores a perfect kitchen 100 and penalises each part', () => {
    const m = { p99: 150, successes: 100, errorRate: 0, amplification: 1 } as Metrics;
    const c = { ...DEFAULT_CONTROLS, cooks: 2 };
    expect(headChefScore(m, c).score).toBe(100);
    expect(headChefScore({ ...m, p99: 250 }, c).score).toBe(90);
    expect(headChefScore({ ...m, errorRate: 0.01 }, c).score).toBe(97);
    expect(headChefScore(m, { ...c, cooks: 3 }).score).toBe(96);
    expect(headChefScore({ ...m, amplification: 1.1 }, c).score).toBe(95);
    expect(headChefScore({ ...m, successes: 0 }, c).score).toBe(0);
  });

  it('the obvious move, more cooks, scores poorly', () => {
    expect(earn(level08, { cooks: 6 }, 120).cleared).toBe(false);
  });
});
