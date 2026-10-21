// Hash routes, so a reload on any screen works on a static host with no
// server-side rewrites (GitHub Pages).

import { useSyncExternalStore } from 'react';

export type Route = { screen: 'map' } | { screen: 'play'; level: number } | { screen: 'debrief'; level: number };

export function parseRoute(hash: string): Route {
  const m = /^#\/level\/(\d+)(\/debrief)?\/?$/.exec(hash);
  if (!m) return { screen: 'map' };
  const level = Number(m[1]);
  return m[2] ? { screen: 'debrief', level } : { screen: 'play', level };
}

export function href(route: Route): string {
  if (route.screen === 'map') return '#/';
  return route.screen === 'play' ? `#/level/${route.level}` : `#/level/${route.level}/debrief`;
}

export function navigate(route: Route, replace = false): void {
  const next = href(route);
  if (replace) history.replaceState(null, '', next);
  else location.hash = next;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return parseRoute(hash);
}
