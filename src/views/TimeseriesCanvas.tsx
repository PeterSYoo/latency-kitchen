import { latencySlo } from '../game/goals';
import { HISTORY_SAMPLES, SAMPLE_MS } from '../game/session';
import { fit, logPos, tickLabel } from './canvas';
import { LiveCanvas, type DrawFn } from './LiveCanvas';

// Log y-axis from 10 ms to 2.5 s.
const LO = 10;
const HI = 2500;
const TICKS = [10, 25, 50, 100, 250, 500, 1000, 2500];

const draw: DrawFn = (canvas, s, theme) => {
  const { ctx, w, h } = fit(canvas);
  const L = 40, R = 8, T = 6, B = 22;
  const pw = w - L - R, ph = h - T - B;
  const Y = (ms: number) => T + ph - logPos(ms, LO, HI) * ph;
  const X = (i: number) => L + (i / (HISTORY_SAMPLES - 1)) * pw;
  const slo = latencySlo(s.level.goals);

  if (slo) {
    ctx.fillStyle = theme.critTint;
    ctx.fillRect(L, T, pw, Y(slo.value) - T);
  }
  ctx.font = `400 10.5px ${theme.mono}`;
  ctx.fillStyle = theme.muted;
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const t of TICKS) {
    const y = Y(t);
    ctx.beginPath();
    ctx.moveTo(L, y);
    ctx.lineTo(L + pw, y);
    ctx.stroke();
    ctx.fillText(tickLabel(t), L - 6, y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const sec of [60, 45, 30, 15, 0]) {
    const x = X(HISTORY_SAMPLES - 1 - (sec * 1000) / SAMPLE_MS);
    ctx.fillText(sec ? `−${sec} s` : 'now', Math.min(x, L + pw - 12), T + ph + 7);
  }
  if (slo) {
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = theme.crit;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(L, Y(slo.value));
    ctx.lineTo(L + pw, Y(slo.value));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = theme.crit;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('SLO', L + 4, Y(slo.value) - 3);
  }

  const hist = s.history;
  if (hist.length < 2) return;
  const off = HISTORY_SAMPLES - hist.length;
  const series = [
    ['p50', theme.p50, 1.5],
    ['p95', theme.p95, 1.5],
    ['p99', theme.p99, 2.25],
  ] as const;
  for (const [key, col, lw] of series) {
    ctx.beginPath();
    hist.forEach((p, i) => (i ? ctx.lineTo(X(i + off), Y(p[key])) : ctx.moveTo(X(i + off), Y(p[key]))));
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(X(HISTORY_SAMPLES - 1), Y(hist[hist.length - 1][key]), 3, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  }
};

export function TimeseriesCanvas({ label }: { label: string }) {
  return <LiveCanvas className="chart-ts" draw={draw} label={label} />;
}
