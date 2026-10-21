import { HISTORY_SAMPLES, type Sample } from '../game/session';
import { fit } from './canvas';
import { LiveCanvas, type DrawFn } from './LiveCanvas';
import type { Theme } from './theme';

export type SparkKey = Exclude<keyof Sample, 't'>;

interface Props {
  metric: SparkKey;
  /** Dashed reference line, e.g. the SLO on the p99 tile. */
  limit?: number;
}

function colorFor(key: SparkKey, t: Theme): string {
  if (key === 'p50') return t.p50;
  if (key === 'p95') return t.p95;
  if (key === 'p99') return t.p99;
  return t.series;
}

export function Sparkline({ metric, limit }: Props) {
  const draw: DrawFn = (canvas, s, theme) => {
    const { ctx, w, h } = fit(canvas);
    const hist = s.history;
    if (hist.length < 2) return;
    const vals = hist.map((x) => x[metric]);
    const fraction = metric === 'utilization' || metric === 'errorRate';
    const floor = metric === 'utilization' ? 1 : metric === 'errorRate' ? 0.02 : 1;
    const hi = fraction ? Math.max(floor, ...vals) : Math.max(...vals, limit ?? 1) * 1.08;
    const off = HISTORY_SAMPLES - vals.length;
    const X = (i: number) => (i / (HISTORY_SAMPLES - 1)) * w;
    const Y = (v: number) => h - 2 - (v / (hi || 1)) * (h - 4);
    const col = colorFor(metric, theme);

    if (limit !== undefined) {
      ctx.strokeStyle = theme.crit;
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Y(limit));
      ctx.lineTo(w, Y(limit));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    vals.forEach((v, i) => (i ? ctx.lineTo(X(i + off), Y(v)) : ctx.moveTo(X(i + off), Y(v))));
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineTo(X(HISTORY_SAMPLES - 1), h);
    ctx.lineTo(X(off), h);
    ctx.closePath();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = col;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(X(HISTORY_SAMPLES - 1) - 2, Y(vals[vals.length - 1]), 2.5, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  };
  return <LiveCanvas className="spark" draw={draw} />;
}
