import { game } from '../game/loop';
import { useGame, type Speed } from '../game/store';

const SPEEDS: Speed[] = [1, 5, 20];

export function TopBar() {
  const level = useGame((s) => s.level)!;
  const status = useGame((s) => s.view?.status);
  const t = useGame((s) => s.view?.t ?? 0);
  const speed = useGame((s) => s.speed);
  const paused = useGame((s) => s.paused);

  const pillClass = !status ? 'pill' : status.kind === 'failing' ? 'pill crit' : 'pill ok';
  const pillText = !status
    ? 'Warming up'
    : status.kind === 'cleared'
      ? 'Level cleared'
      : status.kind === 'passing'
        ? 'All goals passing'
        : status.text;

  return (
    <header className="topbar">
      <div className="brand">
        <h1>
          <span className="logo" aria-hidden="true" />
          Latency Kitchen
        </h1>
        <span className="crumb">
          / Level {level.number} · {level.title}
        </span>
      </div>
      <div className="bar-right">
        <span className={pillClass} role="status">
          {pillText}
        </span>
        <span className="clock mono">{(t / 1000).toFixed(1)} s simulated</span>
        <span className="seg" role="group" aria-label="Simulation speed">
          <button type="button" aria-pressed={paused} onClick={() => game.togglePause()}>
            {paused ? 'Paused' : 'Pause'}
          </button>
          {SPEEDS.map((sp) => (
            <button key={sp} type="button" aria-pressed={!paused && speed === sp} onClick={() => game.setSpeed(sp)}>
              {sp}×
            </button>
          ))}
          <button type="button" onClick={() => game.step()} aria-label="Step half a second">
            Step
          </button>
        </span>
        <button type="button" className="btn" onClick={() => game.reset()}>
          Reset
        </button>
      </div>
    </header>
  );
}
