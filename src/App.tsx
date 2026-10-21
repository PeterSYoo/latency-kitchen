import { useEffect, useRef } from 'react';
import { game } from './game/loop';
import { isUnlocked } from './game/progress';
import { navigate, useRoute } from './game/route';
import { useGame } from './game/store';
import { LEVELS, levelByNumber } from './levels';
import { Debrief } from './ui/Debrief';
import { LevelMap } from './ui/LevelMap';
import { PlayScreen } from './ui/PlayScreen';

export function App() {
  const route = useRoute();
  const progress = useGame((s) => s.progress);
  const current = useGame((s) => s.level);
  const level = route.screen === 'map' ? undefined : levelByNumber(route.level);
  const allowed = level !== undefined && isUnlocked(progress, LEVELS, level);
  const hasDebrief = route.screen === 'debrief' && current?.id === level?.id && game.session()?.after;

  useEffect(() => {
    if (route.screen === 'map') {
      game.stop();
      return;
    }
    if (!allowed) {
      navigate({ screen: 'map' }, true);
      return;
    }
    if (route.screen === 'debrief') {
      if (!hasDebrief) navigate({ screen: 'play', level: route.level }, true);
      game.stop();
      return;
    }
    game.open(level!);
    return () => game.stop();
  }, [route.screen, level, allowed, hasDebrief]);

  // On each screen change: a page title that says where you are, the top of
  // the page, and focus on the new screen so screen readers start there.
  const first = useRef(true);
  useEffect(() => {
    document.title =
      route.screen === 'map' || !level
        ? 'Latency Kitchen'
        : `${route.screen === 'debrief' ? 'Debrief · ' : ''}Level ${level.number} · ${level.title} · Latency Kitchen`;
    window.scrollTo(0, 0);
    if (first.current) {
      first.current = false;
      return;
    }
    requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
  }, [route.screen, level]);

  if (route.screen === 'map') return <LevelMap />;
  if (!level || !allowed || current?.id !== level.id) return null;
  if (route.screen === 'debrief') return hasDebrief ? <Debrief /> : null;
  return <PlayScreen />;
}
