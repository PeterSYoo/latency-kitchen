import type { Stars } from '../game/session';

export function StarRow({ stars, size = 'md' }: { stars: readonly boolean[] | Stars; size?: 'md' | 'lg' }) {
  const n = stars.filter(Boolean).length;
  return (
    <span className={`stars stars-${size}`} role="img" aria-label={`${n} of 3 stars`}>
      {stars.map((s, i) => (
        <span key={i} className={s ? 'star on' : 'star'} aria-hidden="true">
          {s ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}
