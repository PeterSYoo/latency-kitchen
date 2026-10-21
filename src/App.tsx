import { useEffect } from 'react';
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.screen]);

  if (route.screen === 'map') return <LevelMap />;
  if (!level || !allowed || current?.id !== level.id) return null;
  if (route.screen === 'debrief') return hasDebrief ? <Debrief /> : null;
  return <PlayScreen />;
}
