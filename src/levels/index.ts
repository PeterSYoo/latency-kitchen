import { level01 } from './level-01';
import type { LevelConfig } from './types';

export const LEVELS: LevelConfig[] = [level01];

export function levelById(id: string): LevelConfig | undefined {
  return LEVELS.find((l) => l.id === id);
}
