import { createSim } from '../engine';
import type { Controls, Metrics } from '../types';
import type { LevelConfig } from '../../levels/types';
import { evaluateGoal, goalContext } from '../../game/goals';
import { FIRST_SEED, Session } from '../../game/session';
import { SEED, SIM_MS } from './helpers';

/** Runs a level's workload for 90 simulated seconds at seed 42 and checks its goals. */
export function play(level: LevelConfig, patch: Partial<Controls>): { m: Metrics; passes: boolean } {
  const controls = { ...level.defaults, ...patch };
  const sim = createSim(level, controls, SEED);
  sim.advanceTo(SIM_MS);
  const m = sim.metrics();
  const ctx = goalContext(level);
  return { m, passes: level.goals.every((g) => evaluateGoal(g, m, controls, ctx).pass) };
}

/** Plays a session the way the game does, and reports which stars a setup earns. */
export function earn(level: LevelConfig, patch: Partial<Controls>, maxS = 240, seed = FIRST_SEED): Session {
  const s = new Session(level, seed);
  s.setControls(patch);
  for (let i = 0; i < maxS && s.nextStar !== null; i++) s.advance(1000);
  return s;
}
