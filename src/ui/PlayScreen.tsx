import { useMemo } from 'react';
import { fmtMs } from '../game/format';
import { latencySlo } from '../game/goals';
import { useGame } from '../game/store';
import { HistogramCanvas } from '../views/HistogramCanvas';
import { TimeseriesCanvas } from '../views/TimeseriesCanvas';
import { WorkersCanvas } from '../views/WorkersCanvas';
import { Controls } from './Controls';
import { GoalsPanel } from './GoalsPanel';
import { InsightPanel } from './InsightPanel';
import { KpiRow } from './KpiRow';
import { LessonsFooter } from './LessonsFooter';
import { TopBar } from './TopBar';

export function PlayScreen() {
  const level = useGame((s) => s.level)!;
  const view = useGame((s) => s.view);
  const slo = latencySlo(level.goals);
  const sloText = slo ? `SLO ${fmtMs(slo.value)}` : null;

  // Text summaries for the canvases, refreshed once a simulated second.
  const second = view ? Math.floor(view.t / 1000) : 0;
  const labels = useMemo(() => {
    if (!view) return { ts: '', hist: '', workers: '' };
    const m = view.metrics;
    return {
      ts: `Latency over the last 60 simulated seconds, log scale. Now p50 ${fmtMs(m.p50)}, p95 ${fmtMs(m.p95)}, p99 ${fmtMs(m.p99)}${sloText ? `, ${sloText}` : ''}.`,
      hist: `Histogram of the last ${m.count} orders. p50 ${fmtMs(m.p50)}, p99 ${fmtMs(m.p99)}, slowest ${fmtMs(m.max)}.`,
      workers: `${m.queueLength} orders waiting, ${m.busyCooks} of ${m.cooks} cooks busy.`,
    };
  }, [second, level]);

  return (
    <div className="wrap">
      <TopBar />
      <p className="lede">{level.story}</p>
      <KpiRow />
      <div className="grid">
        <div className="col">
          <section className="panel" aria-label="Latency over time">
            <div className="ph">
              <h2>Latency percentiles</h2>
              <div className="legend">
                <span><i style={{ background: 'var(--p50)' }} />p50</span>
                <span><i style={{ background: 'var(--p95)' }} />p95</span>
                <span><i style={{ background: 'var(--p99)' }} />p99</span>
                {sloText && <span><i className="dash" />{sloText}</span>}
              </div>
            </div>
            <div className="pb">
              <TimeseriesCanvas label={labels.ts} />
            </div>
          </section>

          <section className="panel" aria-label="Latency distribution">
            <div className="ph">
              <h2>Latency distribution</h2>
              <span className="meta">last {view?.metrics.count.toLocaleString() ?? 0} orders · log scale</span>
            </div>
            <div className="pb">
              <HistogramCanvas label={labels.hist} />
            </div>
          </section>

          <section className="panel" aria-label="Queue and cooks">
            <div className="ph">
              <h2>Queue and cooks</h2>
              <div className="legend">
                <span><i className="box" style={{ background: 'var(--series)' }} />Cooking</span>
                <span><i className="box" style={{ background: 'var(--crit)' }} />Stalled</span>
                {level.unlockedControls.includes('hedge') && <span><i className="box hedge" />Hedge copy</span>}
                {level.unlockedControls.includes('timeout') && <span><i className="box" style={{ background: 'var(--faint)' }} />Abandoned</span>}
              </div>
            </div>
            <div className="pb">
              <WorkersCanvas label={labels.workers} />
            </div>
          </section>
        </div>

        <div className="col">
          <GoalsPanel />
          <Controls />
          <InsightPanel />
        </div>
      </div>
      <LessonsFooter level={level.number} />
    </div>
  );
}
