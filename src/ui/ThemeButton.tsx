import { useState } from 'react';
import { applyTheme, loadTheme, NEXT_THEME, type ThemeChoice } from '../game/theme';

const LABEL: Record<ThemeChoice, string> = { system: 'System', light: 'Light', dark: 'Dark' };

export function ThemeButton() {
  const [choice, setChoice] = useState<ThemeChoice>(loadTheme);
  return (
    <button
      type="button"
      className="btn theme-btn"
      aria-label={`Theme: ${LABEL[choice]}. Switch to ${LABEL[NEXT_THEME[choice]]}`}
      onClick={() => {
        const next = NEXT_THEME[choice];
        applyTheme(next);
        setChoice(next);
      }}
    >
      Theme: {LABEL[choice]}
    </button>
  );
}
