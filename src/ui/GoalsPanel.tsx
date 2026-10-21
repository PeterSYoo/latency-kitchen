import { useGame } from '../game/store';

export function GoalsPanel() {
  const view = useGame((s) => s.view);
  const level = useGame((s) => s.level)!;
  if (!view) return null;
  const held = view.cleared ? view.holdMs : Math.min(view.hold, view.holdMs);
  const holdS = view.holdMs / 1000;

  return (
    <section className="panel" aria-label="Level goals">
      <div className="ph">
        <h2>Level goals</h2>
        <span className="meta">all must pass</span>
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
        <div className="hold">
          <div className="row">
            <span>Hold for {holdS} s</span>
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
        <p className="note">
          {view.cleared ? `Cleared. ${level.secondStar.hint}` : 'Any control change restarts the hold.'}
        </p>
      </div>
    </section>
  );
}
