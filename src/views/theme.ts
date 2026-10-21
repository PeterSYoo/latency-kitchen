// Canvas colours come from the same CSS custom properties as the rest of the UI.

export interface Theme {
  surface: string;
  sunken: string;
  line: string;
  ink: string;
  muted: string;
  faint: string;
  series: string;
  p50: string;
  p95: string;
  p99: string;
  ok: string;
  crit: string;
  critTint: string;
  mono: string;
}

export function readTheme(): Theme {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    surface: v('--surface'),
    sunken: v('--sunken'),
    line: v('--line'),
    ink: v('--ink'),
    muted: v('--muted'),
    faint: v('--faint'),
    series: v('--series'),
    p50: v('--p50'),
    p95: v('--p95'),
    p99: v('--p99'),
    ok: v('--ok'),
    crit: v('--crit'),
    critTint: v('--crit-tint'),
    mono: v('--font-mono'),
  };
}
