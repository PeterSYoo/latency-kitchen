import { useEffect, useRef } from 'react';
import { HISTOGRAM_BINS, histogramEdges } from '../sim';
import { fit, logPos, roundRect, tickLabel } from './canvas';
import { THEME_EVENT } from '../game/theme';
import { readTheme } from './theme';

const EDGES = histogramEdges();
const LO = EDGES[0];
const HI = EDGES[HISTOGRAM_BINS];
const TICKS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500];

interface Props {
  before: number[];
  after: number[];
  slo: number | null;
  label: string;
}

/** Before and after distributions on one log axis, each scaled to its own peak. */
export function DebriefHistogram({ before, after, slo, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const theme = readTheme();
      const { ctx, w, h } = fit(canvas);
      const L = 12, R = 12, T = 8, B = 22, gap = 14;
      const pw = w - L - R;
      const rowH = (h - T - B - gap) / 2;
      const X = (ms: number) => L + logPos(ms, LO, HI) * pw;

      const rows: [number[], string, number][] = [
        [before, theme.faint, T],
        [after, theme.series, T + rowH + gap],
      ];
      for (const [counts, color, top] of rows) {
        const max = Math.max(1, ...counts);
        counts.forEach((c, i) => {
          if (!c) return;
          const x0 = X(EDGES[i]);
          const x1 = X(EDGES[i + 1]);
          const mid = Math.sqrt(EDGES[i] * EDGES[i + 1]);
          const bh = Math.sqrt(c / max) * rowH;
          ctx.fillStyle = slo !== null && mid > slo ? theme.crit : color;
          ctx.globalAlpha = 0.75;
          roundRect(ctx, x0 + 1, top + rowH - bh, Math.max(1, x1 - x0 - 2), bh, 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.strokeStyle = theme.line;
        ctx.beginPath();
        ctx.moveTo(L, top + rowH);
        ctx.lineTo(L + pw, top + rowH);
        ctx.stroke();
      }
      ctx.font = `500 10.5px ${theme.mono}`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillStyle = theme.muted;
      ctx.fillText('before', L, T);
      ctx.fillText('after', L, T + rowH + gap);
      if (slo !== null) {
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = theme.crit;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(X(slo), T);
        ctx.lineTo(X(slo), T + 2 * rowH + gap);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.font = `400 10.5px ${theme.mono}`;
      ctx.fillStyle = theme.muted;
      ctx.textAlign = 'center';
      for (const t of TICKS) ctx.fillText(tickLabel(t), X(t), h - B + 7);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', draw);
    window.addEventListener(THEME_EVENT, draw);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', draw);
      window.removeEventListener(THEME_EVENT, draw);
    };
  }, [before, after, slo]);

  return <canvas ref={ref} className="chart-debrief" role="img" aria-label={label} />;
}
