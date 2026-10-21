// Light, dark, or follow the system. Stored per viewer; storage may be unavailable.

const KEY = 'latency-kitchen:theme';
export type ThemeChoice = 'system' | 'light' | 'dark';
export const THEME_EVENT = 'latency-kitchen:themechange';

export function loadTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // The choice just won't survive a reload.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export const NEXT_THEME: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };
