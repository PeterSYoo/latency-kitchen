import { diffControls } from '../game/describe';
import { fmtMs, pct } from '../game/format';
import { latencySlo } from '../game/goals';
import { game } from '../game/loop';
import { href } from '../game/route';
import { useGame } from '../game/store';
import { LEVELS } from '../levels';
import { DebriefHistogram } from '../views/DebriefHistogram';
import { StarRow } from './StarRow';

export function Debrief() {
  const level = useGame((s) => s.level)!;
  const view = useGame((s) => s.view);
  const session = game.session();
  if (!session || !session.after || !view) return null;
  const { before, after } = session;
  const changes = diffControls(level, before.controls, after.controls);
  const slo = latencySlo(level.goals)?.value ?? null;
  const next = LEVELS.find((l) => l.number === level.number + 1);
  const nextStar = view.nextStar;

  return (
    <div className="wrap debrief">
      <header className="topbar">
        <div className="brand">
          <h1>
            <span className="logo" aria-hidden="true" />
            <a href={href({ screen: 'map' })}>Latency Kitchen</a>
          </h1>
          <span className="crumb">
            / Level {level.number} · {level.title} · debrief
          </span>
        </div>
      </header>

      <section className="panel">
        <div className="ph">
          <h2>Level {level.number} cleared</h2>
          <StarRow stars={view.stars} size="lg" />
        </div>
        <div className="pb">
          <p className="debrief-text">{level.debrief}</p>
          {nextStar !== null && nextStar > 0 && <p className="note">{level.stars[nextStar - 1].hint}</p>}
        </div>
      </section>

      <div className="debrief-grid">
        <section className="panel">
          <div className="ph">
            <h2>Before and after</h2>
            <span className="meta">last {after.metrics.count.toLocaleString()} orders · log scale</span>
          </div>
          <div className="pb">
            <DebriefHistogram
              before={before.metrics.histogram}
              after={after.metrics.histogram}
              slo={slo}
              label={`Before: p50 ${fmtMs(before.metrics.p50)}, p99 ${fmtMs(before.metrics.p99)}. After: p50 ${fmtMs(after.metrics.p50)}, p99 ${fmtMs(after.metrics.p99)}.`}
            />
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col" />
                  <th scope="col">Before</th>
                  <th scope="col">After</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Mean', fmtMs(before.metrics.mean), fmtMs(after.metrics.mean)],
                    ['p50', fmtMs(before.metrics.p50), fmtMs(after.metrics.p50)],
                    ['p99', fmtMs(before.metrics.p99), fmtMs(after.metrics.p99)],
                    ['Dropped', pct(before.metrics.errorRate), pct(after.metrics.errorRate)],
                  ] as const
                ).map(([k, a, b]) => (
                  <tr key={k}>
                    <th scope="row">{k}</th>
                    <td className="mono">{a}</td>
                    <td className="mono">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="ph">
            <h2>What you changed</h2>
          </div>
          <div className="pb">
            {changes.length ? (
              <ul className="changes">
                {changes.map((d) => (
                  <li key={d.name}>
                    <span className="name">{d.name}</span>
                    <span className="mono">
                      {d.from} → <b>{d.to}</b>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="note">Nothing: the default setup cleared on its own.</p>
            )}
          </div>
        </section>
      </div>

      <nav className="debrief-actions" aria-label="Next">
        {next && (
          <a className="btn primary" href={href({ screen: 'play', level: next.number })}>
            Next: Level {next.number} · {next.title}
          </a>
        )}
        <a className="btn" href={href({ screen: 'play', level: level.number })}>
          {nextStar === null ? 'Back to the kitchen' : 'Keep playing for more stars'}
        </a>
        <a className="btn" href={href({ screen: 'map' })}>
          All levels
        </a>
      </nav>
    </div>
  );
}
