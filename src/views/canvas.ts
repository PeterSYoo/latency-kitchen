/** Sizes a canvas to its CSS box at device pixel ratio and clears it. */
export function fit(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } {
  const r = canvas.getBoundingClientRect();
  const d = window.devicePixelRatio || 1;
  const W = Math.max(1, Math.round(r.width * d));
  const H = Math.max(1, Math.round(r.height * d));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.clearRect(0, 0, r.width, r.height);
  return { ctx, w: r.width, h: r.height };
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** Position of ms on a log axis between lo and hi, clamped to [0, 1]. */
export function logPos(ms: number, lo: number, hi: number): number {
  const v = Math.log10(Math.max(lo, Math.min(hi, ms)));
  return (v - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
}

export const tickLabel = (t: number): string => (t >= 1000 ? `${t / 1000} s` : String(t));
