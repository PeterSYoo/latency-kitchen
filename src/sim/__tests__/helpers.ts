import { createSim } from '../engine';
import type { Controls, SimConfig } from '../types';

export const SIM_MS = 90_000;
export const SEED = 42;

/** Level 1 workload from the reference prototype. */
export const PROTOTYPE: SimConfig = {
  workload: {
    arrivalRate: 30,
    service: { median: 38, sigma: 0.5 },
    stalls: { p: 0.04, minMs: 350, maxMs: 950, scope: 'request' },
  },
};

export function run(config: SimConfig, controls: Controls, seed = SEED, ms = SIM_MS) {
  const sim = createSim(config, controls, seed);
  sim.advanceTo(ms);
  return sim;
}
