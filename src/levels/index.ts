import { level01 } from './level-01';
import { level02 } from './level-02';
import { level03 } from './level-03';
import { level04 } from './level-04';
import { level05 } from './level-05';
import type { LevelConfig } from './types';

export const LEVELS: LevelConfig[] = [level01, level02, level03, level04, level05];

export function levelByNumber(n: number): LevelConfig | undefined {
  return LEVELS.find((l) => l.number === n);
}
