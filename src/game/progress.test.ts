import { describe, expect, it } from 'vitest';
import { mergeProgress, recordStars, type Progress } from './progress';

describe('progress', () => {
  it('never takes stars away and skips no-op updates', () => {
    const p: Progress = { 'level-01': { stars: [true, false, true] } };
    expect(recordStars(p, 'level-01', [false, false, false])).toBe(p);
    expect(recordStars(p, 'level-01', [true, false, false])).toBe(p);
    expect(recordStars(p, 'level-01', [false, true, false])['level-01'].stars).toEqual([true, true, true]);
  });

  it('does not add an entry for a level with no stars', () => {
    expect(recordStars({}, 'level-02', [false, false, false])).toEqual({});
  });

  it('merges two records star by star', () => {
    const a: Progress = { 'level-01': { stars: [true, false, false] }, 'level-02': { stars: [true, false, false] } };
    const b: Progress = { 'level-01': { stars: [false, true, false] }, 'level-03': { stars: [true, false, false] } };
    expect(mergeProgress(a, b)).toEqual({
      'level-01': { stars: [true, true, false] },
      'level-02': { stars: [true, false, false] },
      'level-03': { stars: [true, false, false] },
    });
  });
});
