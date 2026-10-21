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

/** Merges newly earned stars in; stars are never taken away. */
export function recordStars(p: Progress, levelId: string, stars: Stars): Progress {
  const old = p[levelId]?.stars ?? [false, false, false];
  const merged = old.map((s, i) => s || stars[i]) as Stars;
  if (merged.every((s, i) => s === old[i]) && p[levelId]) return p;
  return { ...p, [levelId]: { stars: merged } };
}

export function starCount(p: Progress, levelId: string): number {
  return (p[levelId]?.stars ?? []).filter(Boolean).length;
}

/** Level 1 is always open; each later level opens when the one before is cleared. */
export function isUnlocked(p: Progress, levels: LevelConfig[], level: LevelConfig): boolean {
  const i = levels.indexOf(level);
  return i <= 0 || Boolean(p[levels[i - 1].id]?.stars[0]);
}
