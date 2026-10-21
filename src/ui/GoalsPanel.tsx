import { href } from '../game/route';
import { useGame } from '../game/store';
import { StarRow } from './StarRow';

export function GoalsPanel() {
  const view = useGame((s) => s.view);
  const level = useGame((s) => s.level)!;
  if (!view) return null;
  const holdS = view.holdMs / 1000;
  const held = Math.min(view.hold, view.holdMs);
  const next = view.nextStar;
  const holdLabel = next === null || next === 0 ? `Hold for ${holdS} s` : `Star ${next + 1}: hold for ${holdS} s`;

  return (
    <section className="panel" aria-label="Level goals">
      <div className="ph">
        <h2>Level goals</h2>
        {view.cleared ? <StarRow stars={view.stars} /> : <span className="meta">all must pass</span>}
      </div>
      <div className="pb">
        <ul className="slo">
          {view.goals.map((g) => (
            <li key={g.label}>
              <span className="name">{g.label}</span>
              <span className="val">{g.display}</span>
              <span className={g.pass ? 'tag pass' : 'tag fail'}>{g.pass ? 'PASS' : 'FAIL'}</span>
            </li>
          ))}
        </ul>
        {next !== null && (
          <div className="hold">
            <div className="row">
              <span>{holdLabel}</span>
              <span className="mono">
                {(held / 1000).toFixed(1)} / {holdS} s
              </span>
            </div>
            <div
              className="track"
              role="progressbar"
              aria-label="Hold window"
              aria-valuemin={0}
              aria-valuemax={holdS}
              aria-valuenow={Math.round(held / 100) / 10}
            >
              <i style={{ width: `${(held / view.holdMs) * 100}%` }} />
            </div>
          </div>
        )}
        {level.scoreHelp && <p className="note">{level.scoreHelp}</p>}
        <p className="note">
          {!view.cleared
            ? 'Any control change restarts the hold.'
            : next === null
              ? 'All three stars earned.'
              : `Cleared. ${level.stars[next - 1].hint}`}
        </p>
        {view.cleared && (
          <a className="btn primary" href={href({ screen: 'debrief', level: level.number })}>
            See the debrief
          </a>
        )}
      </div>
    </section>
  );
}
