import { game } from '../game/loop';
import { useGame } from '../game/store';

const HEDGE_MIN = 40;
const HEDGE_MAX = 400;
const HEDGE_STEP = 10;

export function Controls() {
  const level = useGame((s) => s.level)!;
  const c = useGame((s) => s.controls);
  if (!c) return null;
  const unlocked = new Set(level.unlockedControls);
  const { min, max } = level.limits.cooks;

  return (
    <section className="panel" aria-label="Controls">
      <div className="ph">
        <h2>Controls</h2>
      </div>
      <div className="pb" style={{ gap: 0 }}>
        {unlocked.has('cooks') && (
          <div className="ctl">
            <div className="row">
              <span className="lbl" id="cooks-lbl">
                Cooks
              </span>
              <span className="stepper" role="group" aria-labelledby="cooks-lbl">
                <button type="button" aria-label="Fewer cooks" disabled={c.cooks <= min} onClick={() => game.setControls({ cooks: c.cooks - 1 })}>
                  −
                </button>
                <span className="val" aria-live="polite">
                  {c.cooks}
                </span>
                <button type="button" aria-label="More cooks" disabled={c.cooks >= max} onClick={() => game.setControls({ cooks: c.cooks + 1 })}>
                  +
                </button>
              </span>
            </div>
            <p>Each cook works one order at a time.</p>
          </div>
        )}

        {unlocked.has('hedge') && (
          <div className="ctl">
            <div className="row">
              <label htmlFor="hedge-on">Hedge slow orders</label>
              <input
                id="hedge-on"
                type="checkbox"
                className="switch"
                role="switch"
                checked={c.hedge}
                onChange={(e) => game.setControls({ hedge: e.target.checked })}
              />
            </div>
            <div className="row">
              <input
                type="range"
                min={HEDGE_MIN}
                max={HEDGE_MAX}
                step={HEDGE_STEP}
                value={c.hedgeMs}
                disabled={!c.hedge}
                aria-label="Hedge after milliseconds"
                onChange={(e) => game.setControls({ hedgeMs: Number(e.target.value) })}
              />
              <span className="val">{c.hedgeMs} ms</span>
            </div>
            <p>If an order isn't done this long after it arrived, a second cook starts a copy.</p>
          </div>
        )}

        {unlocked.has('queueOrder') && (
          <div className="ctl">
            <div className="row">
              <span className="lbl" id="order-lbl">
                Queue order
              </span>
              <span className="seg" role="group" aria-labelledby="order-lbl">
                {(['fifo', 'lifo'] as const).map((o) => (
                  <button key={o} type="button" aria-pressed={c.queueOrder === o} onClick={() => game.setControls({ queueOrder: o })}>
                    {o.toUpperCase()}
                  </button>
                ))}
              </span>
            </div>
            <p>Oldest order first, or newest order first.</p>
          </div>
        )}
      </div>
    </section>
  );
}
