import { latencySlo } from '../game/goals';
import { HISTOGRAM_BINS, histogramEdges } from '../sim';
import { fit, logPos, roundRect, tickLabel } from './canvas';
import { LiveCanvas, type DrawFn } from './LiveCanvas';

const EDGES = histogramEdges();
const LO = EDGES[0];
const HI = EDGES[HISTOGRAM_BINS];
const TICKS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500];

const draw: DrawFn = (canvas, s, theme) => {
  const { ctx, w, h } = fit(canvas);
  const m = s.metrics;
  const slo = latencySlo(s.level.goals);
  const L = 12, R = 12, T = 18, B = 22;
  const pw = w - L - R, ph = h - T - B;
  const X = (ms: number) => L + logPos(ms, LO, HI) * pw;
  const maxC = Math.max(1, ...m.histogram);
  // Square-root y-axis so the tail stays visible.
  const Y = (c: number) => T + ph - Math.sqrt(c / maxC) * ph;

  ctx.font = `400 10.5px ${theme.mono}`;
  ctx.fillStyle = theme.muted;
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const t of TICKS) {
    const x = X(t);
    ctx.beginPath();
    ctx.moveTo(x, T);
    ctx.lineTo(x, T + ph);
    ctx.stroke();
    ctx.fillText(tickLabel(t), x, T + ph + 7);
  }
  ctx.beginPath();
  ctx.moveTo(L, T + ph);
  ctx.lineTo(L + pw, T + ph);
  ctx.stroke();

  m.histogram.forEach((c, i) => {
    if (!c) return;
    const x0 = X(EDGES[i]);
    const x1 = X(EDGES[i + 1]);
    const mid = Math.sqrt(EDGES[i] * EDGES[i + 1]);
    const over = slo !== null && mid > slo.value;
    const y = Y(c);
    ctx.fillStyle = over ? theme.crit : theme.series;
    ctx.globalAlpha = over ? 0.8 : 0.7;
    roundRect(ctx, x0 + 1, y, Math.max(1, x1 - x0 - 2), T + ph - y, 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  if (slo) {
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = theme.crit;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(X(slo.value), T);
    ctx.lineTo(X(slo.value), T + ph);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (!m.successes) {
    if (m.count) {
      ctx.font = `500 12px ${theme.mono}`;
      ctx.fillStyle = theme.crit;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`None of the last ${m.count.toLocaleString()} orders succeeded`, L + pw / 2, T + ph / 2);
    }
    return;
  }

  // Percentile markers, labels staggered when they would overlap.
  const marks = [
    ['p50', m.p50, theme.p50],
    ['p95', m.p95, theme.p95],
    ['p99', m.p99, theme.p99],
  ] as const;
  let prevX = -999;
  let row = 0;
  ctx.font = `500 10.5px ${theme.mono}`;
  ctx.textBaseline = 'bottom';
  for (const [label, v, col] of marks) {
    const x = X(v);
    row = x - prevX < 30 ? row + 1 : 0;
    prevX = x;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, T + row * 12);
    ctx.lineTo(x, T + ph);
    ctx.stroke();
    ctx.fillStyle = col;
    const right = x > L + pw - 24;
    ctx.textAlign = right ? 'right' : 'left';
    ctx.fillText(label, x + (right ? -4 : 4), T + 10 + row * 12);
  }
};

export function HistogramCanvas({ label }: { label: string }) {
  return <LiveCanvas className="chart-hist" draw={draw} label={label} />;
}
