import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../levels';
import { Session, FIRST_SEED } from '../../game/session';
import { earn } from './lesson-helpers';

// Every level must open failing and be clearable by its stored setups, checked in CI.
describe.each(LEVELS)('Level $number · $title', (level) => {
  it('opens failing, with full charts', () => {
    const s = new Session(level, FIRST_SEED);
    expect(s.history).toHaveLength(120);
    expect(s.status().kind).toBe('failing');
  });

  it('clears with its stored solution within 4 simulated minutes', () => {
    expect(earn(level, level.solution).cleared).toBe(true);
  });

  it.each([1, 2])('earns star %i with its stored setup', (star) => {
    const s = earn(level, { ...level.solution, ...level.stars[star - 1].solution });
    expect(s.stars[star]).toBe(true);
  });

  it('only unlocks controls the defaults define', () => {
    for (const key of level.unlockedControls) expect(level.defaults[key]).toBeDefined();
  });
});
