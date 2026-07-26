import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'roundtrip.theme.v1';

/** Mirrors --color-ground for each theme, for the mobile browser chrome. */
const THEME_COLOR: Record<Theme, string> = {
  light: '#efe8d8',
  dark: '#0b1216',
};

/**
 * Light is the product default. A saved choice always wins; there is no
 * system-preference fallback, because the brief for this toggle is "light by
 * default", not "match the OS". The inline script in index.html applies a
 * saved 'dark' choice before first paint, so this only needs to agree with
 * what's already on the page.
 */
function initial(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Private browsing. Falls through to the default.
  }
  return 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR[theme]);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Private browsing. The session still works, it just will not persist.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  return { theme, toggle };
}
