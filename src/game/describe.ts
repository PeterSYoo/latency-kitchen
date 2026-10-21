import type { Controls } from '../sim';
import type { ControlKey, LevelConfig } from '../levels/types';

const NAMES: Record<ControlKey, string> = {
  arrivalRate: 'Orders accepted',
  cooks: 'Cooks',
  hedge: 'Hedging',
  queueOrder: 'Queue order',
  shed: 'Shedding',
  cache: 'Prep (cache)',
  timeout: 'Timeouts',
};

export function describeControl(key: ControlKey, c: Controls, level: LevelConfig): string {
  switch (key) {
    case 'arrivalRate':
      return `${c.arrivalRate ?? level.workload.arrivalRate}/s`;
    case 'cooks':
      return String(c.cooks);
    case 'hedge':
      return c.hedge ? `after ${c.hedgeMs} ms` : 'off';
    case 'queueOrder':
      return c.queueOrder.toUpperCase();
    case 'shed':
      return c.shed ? `past ${c.shedMax} waiting` : 'off';
    case 'cache':
      return c.cache ? 'on' : 'off';
    case 'timeout':
      if (!c.timeout) return 'off';
      return [
        `${c.timeoutMs} ms`,
        `${c.maxRetries} ${c.maxRetries === 1 ? 'retry' : 'retries'}`,
        c.backoffMs ? `${c.backoffMs} ms backoff` : null,
        c.cancel ? 'cancel abandoned' : 'no cancellation',
      ]
        .filter(Boolean)
        .join(', ');
  }
}

/** The controls that differ between two setups, as "name: before → after". */
export function diffControls(level: LevelConfig, from: Controls, to: Controls): { name: string; from: string; to: string }[] {
  return level.unlockedControls
    .map((k) => ({ name: NAMES[k], from: describeControl(k, from, level), to: describeControl(k, to, level) }))
    .filter((d) => d.from !== d.to);
}
