import { useEffect, useRef } from 'react';
import { game } from '../game/loop';
import type { Session } from '../game/session';
import type { Theme } from './theme';

export type DrawFn = (canvas: HTMLCanvasElement, s: Session, theme: Theme) => void;

interface Props {
  draw: DrawFn;
  className?: string;
  label?: string;
}

/** A canvas redrawn on every animation frame from the live session. */
export function LiveCanvas({ draw, className, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(
    () =>
      game.onFrame((s, theme) => {
        if (ref.current) drawRef.current(ref.current, s, theme);
      }),
    [],
  );

  return <canvas ref={ref} className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}
