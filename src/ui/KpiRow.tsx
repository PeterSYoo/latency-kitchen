import { fmtMs, pct } from '../game/format';
import type { GoalMetric } from '../levels/types';
import { useGame } from '../game/store';
import { KpiTile } from './KpiTile';

export function KpiRow() {
  const view = useGame((s) => s.view);
  if (!view) return null;
  const m = view.metrics;
  const has = m.successes > 0;
  const lat = (v: number) => (has ? fmtMs(v) : '–');
  const goal = (metric: GoalMetric) => view.goals.find((g) => g.goal.metric === metric);
  const failing = (metric: GoalMetric) => goal(metric)?.pass === false;
  const p99Goal = goal('p99');
  const dropGoal = goal('errorRate');

  return (
    <section className="kpis" aria-label="Key metrics">
      <KpiTile name="Mean" value={lat(m.mean)} caption={`last ${m.count.toLocaleString()} orders`} spark="mean" breach={failing('mean')} />
      <KpiTile name="p50" value={lat(m.p50)} caption="median order" spark="p50" swatch="var(--p50)" breach={failing('p50')} />
      <KpiTile name="p95" value={lat(m.p95)} caption="1 in 20 is slower" spark="p95" swatch="var(--p95)" breach={failing('p95')} />
      <KpiTile
        name="p99"
        value={lat(m.p99)}
        caption={p99Goal ? `SLO < ${fmtMs(p99Goal.goal.value)}` : '1 in 100 is slower'}
        spark="p99"
        swatch="var(--p99)"
        breach={failing('p99')}
        limit={p99Goal?.goal.value}
      />
      <KpiTile name="Cooks busy" value={`${Math.round(m.utilization * 100)}%`} caption="utilization, last 1 s" spark="utilization" />
      <KpiTile
        name="Dropped"
        value={pct(m.errorRate)}
        caption={dropGoal ? `limit ${pct(dropGoal.goal.value, 0)}` : 'shed or timed out'}
        spark="errorRate"
        breach={failing('errorRate')}
      />
    </section>
  );
}
