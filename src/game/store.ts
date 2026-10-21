// React-facing state. The render loop writes a fresh view a few times a second;
// canvases read the session directly every frame and never go through here.

import { create } from 'zustand';
import type { Controls, Metrics } from '../sim';
import type { Insight, LevelConfig } from '../levels/types';
import type { GoalResult } from './goals';
import type { Status } from './session';

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
}

export interface GameState {
  level: LevelConfig | null;
  controls: Controls | null;
  speed: Speed;
  paused: boolean;
  view: PlayView | null;
}

export const useGame = create<GameState>(() => ({
  level: null,
  controls: null,
  speed: 5,
  paused: false,
  view: null,
}));
