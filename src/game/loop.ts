// The game loop: each animation frame advances the engine by real elapsed time
// × speed, redraws the canvases from the session, and publishes a view to the
// store a few times a second so React re-renders rarely.

import type { Controls } from '../sim';
import type { LevelConfig } from '../levels/types';
import { readTheme, type Theme } from '../views/theme';
import { pickInsight } from './insights';
import { FIRST_SEED, SAMPLE_MS, Session } from './session';
import { useGame, type Speed } from './store';

export type FrameListener = (s: Session, theme: Theme) => void;

const MAX_FRAME_MS = 100;
const PUBLISH_EVERY_MS = 150;

let session: Session | null = null;
let seed = FIRST_SEED;
let rafId = 0;
let lastFrame = 0;
let lastPublish = 0;
const listeners = new Set<FrameListener>();

function publish(): void {
  if (!session) return;
  const controls = session.controls();
  useGame.setState({
    controls,
    view: {
      t: session.now,
      metrics: session.metrics,
      goals: session.goals,
      hold: session.hold,
      holdMs: session.holdMs,
      cleared: session.cleared,
      status: session.status(),
      insight: pickInsight(session.level, session.metrics, controls),
    },
  });
}

function draw(): void {
  if (!session || listeners.size === 0) return;
  const theme = readTheme();
  for (const fn of listeners) fn(session, theme);
}

function frame(now: number): void {
  const dt = Math.min(MAX_FRAME_MS, now - lastFrame);
  lastFrame = now;
  const { paused, speed } = useGame.getState();
  if (session && !paused && dt > 0) session.advance(dt * speed);
  draw();
  if (now - lastPublish >= PUBLISH_EVERY_MS) {
    lastPublish = now;
    publish();
  }
  rafId = requestAnimationFrame(frame);
}

export const game = {
  start(level: LevelConfig): void {
    session = new Session(level, seed);
    useGame.setState({ level });
    publish();
    if (!rafId) {
      lastFrame = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  },

  stop(): void {
    cancelAnimationFrame(rafId);
    rafId = 0;
  },

  reset(): void {
    if (!session) return;
    seed++;
    this.start(session.level);
    draw();
  },

  setControls(patch: Partial<Controls>): void {
    session?.setControls(patch);
    publish();
  },

  setSpeed(speed: Speed): void {
    useGame.setState({ speed, paused: false });
  },

  togglePause(): void {
    useGame.setState((s) => ({ paused: !s.paused }));
  },

  /** Advance one sample (500 simulated ms) while paused. */
  step(): void {
    if (!session) return;
    useGame.setState({ paused: true });
    session.advance(SAMPLE_MS);
    draw();
    publish();
  },

  onFrame(fn: FrameListener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  session(): Session | null {
    return session;
  },
};
