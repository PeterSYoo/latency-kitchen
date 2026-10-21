export const fmtMs = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;

export const pct = (x: number, digits = 1): string => `${(x * 100).toFixed(digits)}%`;
