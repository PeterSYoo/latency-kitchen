import type { ReactNode } from 'react';
import type { Controls as ControlValues } from '../sim';
import { game } from '../game/loop';
import { useGame } from '../game/store';

const HEDGE = { min: 40, max: 400, step: 10 };
const BACKOFF = { min: 0, max: 200, step: 10 };
const MAX_RETRIES = 4;

const set = (patch: Partial<ControlValues>) => game.setControls(patch);

export function Controls() {
  const level = useGame((s) => s.level)!;
  const c = useGame((s) => s.controls);
  if (!c) return null;
  const unlocked = new Set(level.unlockedControls);
  const { limits } = level;
  const cache = level.workload.cache;

  return (
    <section className="panel" aria-label="Controls" id="controls" tabIndex={-1}>
      <div className="ph">
        <h2>Controls</h2>
      </div>
      <div className="pb" style={{ gap: 0 }}>
        {unlocked.has('arrivalRate') && limits.arrivalRate && (
          <Ctl help="How many orders per second the front desk lets in.">
            <div className="row">
              <label htmlFor="rate">Orders accepted</label>
              <span className="val">{c.arrivalRate}/s</span>
            </div>
            <input
              id="rate"
              type="range"
              {...limits.arrivalRate}
              value={c.arrivalRate ?? level.workload.arrivalRate}
              onChange={(e) => set({ arrivalRate: Number(e.target.value) })}
            />
          </Ctl>
        )}

        {unlocked.has('cooks') && (
          <Ctl help="Each cook works one order at a time.">
            <div className="row">
              <span className="lbl" id="cooks-lbl">
                Cooks
              </span>
              <Stepper
                labelledBy="cooks-lbl"
                value={c.cooks}
                min={limits.cooks.min}
                max={limits.cooks.max}
                less="Fewer cooks"
                more="More cooks"
                onChange={(cooks) => set({ cooks })}
              />
            </div>
          </Ctl>
        )}

        {unlocked.has('quorum') && level.workload.fanOut && (
          <Ctl help="Serve a table once this many of its dishes are ready. Dishes still cooking are thrown away.">
            <div className="row">
              <span className="lbl" id="quorum-lbl">
                Dishes needed (of {level.workload.fanOut.k})
              </span>
              <Stepper
                labelledBy="quorum-lbl"
                value={c.quorum ?? level.workload.fanOut.k}
                min={Math.ceil(level.workload.fanOut.k / 2)}
                max={level.workload.fanOut.k}
                less="Fewer dishes"
                more="More dishes"
                onChange={(quorum) => set({ quorum })}
              />
            </div>
          </Ctl>
        )}

        {unlocked.has('staggerPauses') && (
          <Ctl help="Cooks stop for cleaning at different times instead of all at once.">
            <Toggle
              id="stagger-on"
              label="Stagger pauses"
              checked={c.staggerPauses}
              onChange={(staggerPauses) => set({ staggerPauses })}
            />
          </Ctl>
        )}

        {unlocked.has('hedge') && (
          <Ctl help="If an order isn't done this long after it arrived, a second cook starts a copy.">
            <Toggle id="hedge-on" label="Hedge slow orders" checked={c.hedge} onChange={(hedge) => set({ hedge })} />
            <Slider
              label="Hedge after milliseconds"
              range={HEDGE}
              value={c.hedgeMs}
              disabled={!c.hedge}
              display={`${c.hedgeMs} ms`}
              onChange={(hedgeMs) => set({ hedgeMs })}
            />
          </Ctl>
        )}

        {unlocked.has('queueOrder') && (
          <Ctl help="Oldest order first, or newest order first.">
            <div className="row">
              <span className="lbl" id="order-lbl">
                Queue order
              </span>
              <span className="seg" role="group" aria-labelledby="order-lbl">
                {(['fifo', 'lifo'] as const).map((o) => (
                  <button key={o} type="button" aria-pressed={c.queueOrder === o} onClick={() => set({ queueOrder: o })}>
                    {o.toUpperCase()}
                  </button>
                ))}
              </span>
            </div>
          </Ctl>
        )}

        {unlocked.has('shed') && limits.shedMax && (
          <Ctl help="Turn away new orders when this many are already waiting. Each one counts as dropped.">
            <Toggle id="shed-on" label="Shed load" checked={c.shed} onChange={(shed) => set({ shed })} />
            <Slider
              label="Maximum orders waiting"
              range={limits.shedMax}
              value={c.shedMax}
              disabled={!c.shed}
              display={`${c.shedMax} max`}
              onChange={(shedMax) => set({ shedMax })}
            />
          </Ctl>
        )}

        {unlocked.has('cache') && cache && (
          <Ctl
            help={`Serves ${Math.round(cache.hitRate * 100)}% of orders from prep in ${cache.hitMs} ms. Takes one cook's spot.`}
          >
            <Toggle id="cache-on" label="Prep ahead (cache)" checked={c.cache} onChange={(on) => set({ cache: on })} />
          </Ctl>
        )}

        {unlocked.has('timeout') && limits.timeoutMs && (
          <Ctl help="Customers give up on an order after this long and reorder, up to the retry limit.">
            <Toggle id="timeout-on" label="Give up and reorder" checked={c.timeout} onChange={(timeout) => set({ timeout })} />
            <Slider
              label="Give up after milliseconds"
              range={limits.timeoutMs}
              value={c.timeoutMs}
              disabled={!c.timeout}
              display={`${c.timeoutMs} ms`}
              onChange={(timeoutMs) => set({ timeoutMs })}
            />
            <div className="row">
              <span className="lbl sub" id="retries-lbl">
                Retries
              </span>
              <Stepper
                labelledBy="retries-lbl"
                value={c.maxRetries}
                min={0}
                max={MAX_RETRIES}
                less="Fewer retries"
                more="More retries"
                disabled={!c.timeout}
                onChange={(maxRetries) => set({ maxRetries })}
              />
            </div>
            <div className="row">
              <span className="lbl sub">Backoff</span>
              <span className="val">{c.backoffMs ? `${c.backoffMs} ms` : 'none'}</span>
            </div>
            <input
              type="range"
              {...BACKOFF}
              value={c.backoffMs}
              disabled={!c.timeout}
              aria-label="Backoff milliseconds"
              onChange={(e) => set({ backoffMs: Number(e.target.value) })}
            />
            <Toggle
              id="cancel-on"
              label="Cancel abandoned orders"
              checked={c.cancel}
              onChange={(cancel) => set({ cancel })}
              sub
            />
          </Ctl>
        )}
      </div>
    </section>
  );
}

function Ctl({ help, children }: { help: string; children: ReactNode }) {
  return (
    <div className="ctl">
      {children}
      <p>{help}</p>
    </div>
  );
}

function Toggle(props: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; sub?: boolean }) {
  return (
    <div className="row">
      <label htmlFor={props.id} className={props.sub ? 'sub' : undefined}>
        {props.label}
      </label>
      <input
        id={props.id}
        type="checkbox"
        className="switch"
        role="switch"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
    </div>
  );
}

function Slider(props: {
  label: string;
  range: { min: number; max: number; step: number };
  value: number;
  disabled?: boolean;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="row">
      <input
        type="range"
        {...props.range}
        value={props.value}
        disabled={props.disabled}
        aria-label={props.label}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      <span className="val">{props.display}</span>
    </div>
  );
}

function Stepper(props: {
  labelledBy: string;
  value: number;
  min: number;
  max: number;
  less: string;
  more: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const { value, min, max, disabled } = props;
  return (
    <span className="stepper" role="group" aria-labelledby={props.labelledBy}>
      <button type="button" aria-label={props.less} disabled={disabled || value <= min} onClick={() => props.onChange(value - 1)}>
        −
      </button>
      <span className="val" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label={props.more} disabled={disabled || value >= max} onClick={() => props.onChange(value + 1)}>
        +
      </button>
    </span>
  );
}
