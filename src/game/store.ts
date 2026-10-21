// React-facing state. The render loop writes a fresh view a few times a second;
// canvases read the session directly every frame and never go through here.

import { create } from 'zustand';
import type { Controls, Metrics } from '../sim';
import type { Insight, LevelConfig } from '../levels/types';
import type { GoalResult } from './goals';
import { loadProgress, mergeProgress, type Progress } from './progress';
import type { Stars, Status } from './session';

export type Speed = 1 | 5 | 20;

export interface PlayView {
  t: number;
  metrics: Metrics;
  goals: GoalResult[];
  hold: number;
  holdMs: number;
  cleared: boolean;
  status: Status;
  insight: Insight;
  stars: Stars;
  /** The star being worked towards (0 = clearing), or null when all are earned. */
  nextStar: 0 | 1 | 2 | null;
}

export interface GameState {
  level: LevelConfig | null;
  controls: Controls | null;
  speed: Speed;
  paused: boolean;
  view: PlayView | null;
  progress: Progress;
}

export const useGame = create<GameState>(() => ({
  level: null,
  controls: null,
  speed: 5,
  paused: false,
  view: null,
  progress: loadProgress(),
}));

// Progress earned in another tab shows up here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key.startsWith('latency-kitchen:progress')) {
      useGame.setState((s) => ({ progress: mergeProgress(s.progress, loadProgress()) }));
    }
  });
}
