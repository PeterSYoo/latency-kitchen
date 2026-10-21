import { isUnlocked } from '../game/progress';
import { href } from '../game/route';
import { useGame } from '../game/store';
import { LEVELS } from '../levels';
import { StarRow } from './StarRow';

export function LevelMap() {
  const progress = useGame((s) => s.progress);
  const total = LEVELS.reduce((n, l) => n + (progress[l.id]?.stars.filter(Boolean).length ?? 0), 0);

  return (
    <div className="wrap">
      <header className="topbar">
        <div className="brand">
          <h1>
            <span className="logo" aria-hidden="true" />
            Latency Kitchen
          </h1>
          <span className="crumb">/ Levels</span>
        </div>
        <span className="pill">
          {total} of {LEVELS.length * 3} stars
        </span>
      </header>
      <p className="lede">
        Orders are requests, cooks are workers and the ticket rail is the queue. Each level sets a latency target and
        teaches one technique for hitting it. Adding cooks is rarely the answer.
      </p>
      <ol className="levels">
        {LEVELS.map((level) => {
          const open = isUnlocked(progress, LEVELS, level);
          const stars = progress[level.id]?.stars ?? [false, false, false];
          const body = (
            <>
              <span className="num mono">Level {level.number}</span>
              <span className="title">{level.title}</span>
              <span className="tool">{level.newTool}</span>
              <span className="foot">
                {open ? <StarRow stars={stars} /> : <span className="locked">Clear level {level.number - 1} to unlock</span>}
              </span>
            </>
          );
          return (
            <li key={level.id}>
              {open ? (
                <a className="level-card" href={href({ screen: 'play', level: level.number })}>
                  {body}
                </a>
              ) : (
                <div className="level-card locked" aria-disabled="true">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
