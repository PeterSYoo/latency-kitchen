import { useEffect } from 'react';
import { game } from './game/loop';
import { useGame } from './game/store';
import { level01 } from './levels/level-01';
import { PlayScreen } from './ui/PlayScreen';

// Level map and debrief arrive in milestone 3; for now the app opens Level 1.
export function App() {
  const level = useGame((s) => s.level);
  useEffect(() => {
    game.start(level01);
    return () => game.stop();
  }, []);
  return level ? <PlayScreen /> : null;
}
