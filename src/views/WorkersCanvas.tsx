import { fmtMs } from '../game/format';
import { latencySlo } from '../game/goals';
import { fit, roundRect } from './canvas';
import { LiveCanvas, type DrawFn } from './LiveCanvas';

const LABEL_W = 64;
const ROW_H = 32;
const TOP = 44;
const SCALE_MS = 1000;

const draw: DrawFn = (canvas, s, theme) => {
  const snap = s.sim.snapshot();
  const want = `${TOP + snap.cooks.length * ROW_H + 14}px`;
  if (canvas.style.height !== want) canvas.style.height = want;
  const { ctx, w } = fit(canvas);
  const slo = latencySlo(s.level.goals)?.value ?? 250;
  const now = snap.t;
  ctx.font = `400 11px ${theme.mono}`;
  ctx.textBaseline = 'middle';

  // Queue: one small bar per waiting ticket, shaded by age, red past the SLO.
  ctx.fillStyle = theme.muted;
  ctx.textAlign = 'left';
  ctx.fillText('queue', 0, 14);
  ctx.textAlign = 'right';
  ctx.fillStyle = snap.queue.length > 10 ? theme.crit : theme.ink;
  ctx.fillText(`${snap.queue.length} waiting`, w, 14);
  const cw = 7, cg = 3;
  const maxBars = Math.max(0, Math.floor((w - LABEL_W - 80) / (cw + cg)));
  snap.queue.slice(0, maxBars).forEach((q, i) => {
    const age = now - q.arrivedAt;
    const over = age > slo;
    const x = LABEL_W + i * (cw + cg);
    ctx.fillStyle = over ? theme.crit : theme.series;
    ctx.globalAlpha = over ? 1 : 0.35 + 0.65 * Math.min(1, age / slo);
    roundRect(ctx, x, 5, cw, 18, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (q.hedge) {
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = theme.p99;
      ctx.lineWidth = 1.25;
      roundRect(ctx, x - 0.5, 4.5, cw + 1, 19, 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });
  if (snap.queue.length > maxBars) {
    ctx.fillStyle = theme.muted;
    ctx.textAlign = 'left';
    ctx.fillText(`+${snap.queue.length - maxBars}`, LABEL_W + maxBars * (cw + cg) + 2, 14);
  }
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 34);
  ctx.lineTo(w, 34);
  ctx.stroke();

  // Cooks: one row each, like a trace view, elapsed time on a 0–1 s scale.
  const trackW = w - LABEL_W - 118;
  const scale = (ms: number) => (Math.min(SCALE_MS, ms) / SCALE_MS) * trackW;
  snap.cooks.forEach((c, i) => {
    const y = TOP + i * ROW_H;
    const mid = y + 11;
    ctx.fillStyle = theme.muted;
    ctx.textAlign = 'left';
    ctx.fillText(`cook-${i + 1}`, 0, mid);
    roundRect(ctx, LABEL_W, y + 3, trackW, 16, 4);
    ctx.fillStyle = theme.sunken;
    ctx.fill();
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    const sx = LABEL_W + scale(slo);
    ctx.strokeStyle = theme.crit;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx, y);
    ctx.lineTo(sx, y + 22);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const tk = c.ticket;
    if (!tk) {
      ctx.fillStyle = c.stalled ? theme.crit : theme.faint;
      ctx.fillText(c.stalled ? 'paused' : 'idle', LABEL_W + trackW + 10, mid);
      return;
    }
    const elapsed = now - tk.startedAt;
    roundRect(ctx, LABEL_W, y + 3, Math.max(4, scale(elapsed)), 16, 4);
    ctx.fillStyle = c.stalled ? theme.crit : theme.series;
    ctx.globalAlpha = c.stalled ? 0.9 : 0.75;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (tk.hedge) {
      ctx.setLineDash([3, 2]);
      ctx.strokeStyle = theme.p99;
      ctx.lineWidth = 1.5;
      roundRect(ctx, LABEL_W - 1, y + 2, trackW + 2, 18, 5);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = c.stalled ? theme.crit : theme.ink;
    ctx.fillText(`#${tk.orderId}${tk.hedge ? ' copy' : ''}`, LABEL_W + trackW + 10, mid - 6);
    ctx.fillStyle = theme.muted;
    ctx.fillText(`${fmtMs(now - tk.arrivedAt)} total`, LABEL_W + trackW + 10, mid + 7);
  });

  ctx.fillStyle = theme.faint;
  ctx.font = `400 10px ${theme.mono}`;
  const ly = TOP + snap.cooks.length * ROW_H + 2;
  ctx.textAlign = 'left';
  ctx.fillText('0', LABEL_W, ly);
  ctx.textAlign = 'center';
  ctx.fillText(fmtMs(slo), LABEL_W + scale(slo), ly);
  ctx.textAlign = 'right';
  ctx.fillText('1 s', LABEL_W + trackW, ly);
};

export function WorkersCanvas({ label }: { label: string }) {
  return <LiveCanvas className="chart-workers" draw={draw} label={label} />;
}
