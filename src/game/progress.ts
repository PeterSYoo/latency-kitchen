// Cleared levels and stars, kept in localStorage. Storage can be missing or
// throw (private windows, blocked site data), so every access is guarded and
// the game still works without it.

import type { LevelConfig } from '../levels/types';
import type { Stars } from './session';

const KEY = 'latency-kitchen:progress:v1';

export type Progress = Record<string, { stars: Stars }>;

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Progress;
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Progress just won't survive a reload.
  }
}

/**
 * Merges newly earned stars in; stars are never taken away. Returns `p`
 * itself when nothing new was earned, so callers can skip saving.
 */
export function recordStars(p: Progress, levelId: string, stars: Stars): Progress {
  const old = p[levelId]?.stars ?? [false, false, false];
  if (!stars.some((s, i) => s && !old[i])) return p;
  return { ...p, [levelId]: { stars: old.map((s, i) => s || stars[i]) as Stars } };
}

/** Union of two progress records, star by star. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  let out = a;
  for (const [id, entry] of Object.entries(b)) out = recordStars(out, id, entry.stars);
  return out;
}

/**
 * Saves new stars on top of whatever is stored now, so another tab's progress
 * is never overwritten by this tab's older copy. Returns what was saved.
 */
export function saveNewStars(p: Progress, levelId: string, stars: Stars): Progress | null {
  if (recordStars(p, levelId, stars) === p) return null;
  const merged = recordStars(mergeProgress(loadProgress(), p), levelId, stars);
  saveProgress(merged);
  return merged;
}

export function starCount(p: Progress, levelId: string): number {
  return (p[levelId]?.stars ?? []).filter(Boolean).length;
}

/** Level 1 is always open; each later level opens when the one before is cleared. */
export function isUnlocked(p: Progress, levels: LevelConfig[], level: LevelConfig): boolean {
  const i = levels.indexOf(level);
  return i <= 0 || Boolean(p[levels[i - 1].id]?.stars[0]);
}
