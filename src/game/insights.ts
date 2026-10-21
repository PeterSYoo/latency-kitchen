import type { Controls, Metrics } from '../sim';
import type { Insight, LevelConfig } from '../levels/types';

export function pickInsight(level: LevelConfig, m: Metrics, controls: Controls): Insight {
  if (m.count < 300) return { lead: 'Warming up the kitchen…' };
  const ctx = { m, controls, level };
  for (const rule of level.insights) if (rule.when(ctx)) return rule.say(ctx);
  return { lead: '' };
}
