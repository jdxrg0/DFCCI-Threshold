import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const ThemeContext = createContext();

/**
 * Theme registry.
 *
 * A theme is a FAMILY (an identity — Aurora, Dracula, Ember) and is independent
 * of MODE (light / dark / system). Every family ships both a light and a dark
 * variant, so switching mode keeps your theme and only changes the lighting.
 *
 * Colours live in src/styles/themes.css:
 *     :root[data-theme="aurora"]        -> light variant seeds
 *     :root.dark[data-theme="aurora"]   -> dark variant seeds
 * and everything else is derived from those seeds by src/styles/tokens.css.
 *
 * The swatch pairs below are [background, primary] per variant and must match
 * the CSS exactly — `npm run audit:themes` fails the build if they drift.
 */
export const FAMILIES = [
  { key: 'azure',   label: 'Azure',     light: ['#f8fafc', '#0369a1'], dark: ['#0b1120', '#38bdf8'] },
  { key: 'aurora',  label: 'Aurora',    light: ['#f0fdf4', '#047857'], dark: ['#04140e', '#34d399'] },
  { key: 'tide',    label: 'Tide',      light: ['#e6f0f7', '#14556b'], dark: ['#03141a', '#20d6e0'] },
  { key: 'nord',    label: 'Nord',      light: null,                   dark: ['#2e3440', '#88c0d0'] },
  { key: 'slate',   label: 'Slate',     light: ['#edeef2', '#3f3ba3'], dark: null },
  { key: 'dusk',    label: 'Dusk',      light: ['#f5f1fc', '#74409f'], dark: ['#150a1c', '#c084fc'] },
  { key: 'dracula', label: 'Dracula',   light: null,                   dark: ['#282a36', '#ff79c6'] },
  { key: 'vapor',   label: 'Vaporwave', light: null,                   dark: ['#0e0524', '#ee6ad9'] },
  { key: 'rose',    label: 'Rose',      light: ['#fdf2f6', '#a8175a'], dark: ['#1a0910', '#ec6b83'] },
  { key: 'ember',   label: 'Ember',     light: ['#faf3e3', '#9a4a07'], dark: ['#1c0f0b', '#fb923c'] },
  { key: 'roast',   label: 'Roast',     light: null,                   dark: ['#332519', '#d7a566'] },
  { key: 'sage',    label: 'Sage',      light: ['#f7f1dd', '#4a6323'], dark: null },
  { key: 'neon',    label: 'Neon',      light: null,                   dark: ['#120f1f', '#a3e635'] },
  { key: 'mono',    label: 'Mono',      light: null,                   dark: ['#000000', '#fafafa'] },
  { key: 'signal',  label: 'Signal',    light: null,                   dark: ['#05060a', '#ffd60a'] },
];

export const MODES = [
  { key: 'light',  label: 'Light' },
  { key: 'dark',   label: 'Dark' },
  { key: 'system', label: 'System' },
];

const DEFAULT_FAMILY = 'azure';
const DEFAULT_MODE = 'system';

const FAMILY_KEYS = new Set(FAMILIES.map(f => f.key));
const MODE_KEYS = new Set(MODES.map(m => m.key));

/**
 * Themes used to be one flat list where the key encoded the mode ("mint" was
 * light, "aurora" was dark). Map each old key onto its family so an existing
 * preference survives, and remember which mode it implied.
 *
 * Kept in sync with the bootstrap script in index.html.
 */
const LEGACY_FAMILY = {
  light: 'azure', dark: 'azure',
  mint: 'aurora', aurora: 'aurora',
  sepia: 'ember', sunset: 'ember',
  lavender: 'dusk', dusk: 'dusk',
  peony: 'rose', claret: 'rose',
  glacier: 'tide', abyss: 'tide',
  obsidian: 'mono', nord: 'nord', dracula: 'dracula',
  vaporwave: 'vapor', cyberpunk: 'neon', espresso: 'roast',
  beacon: 'signal', slate: 'slate', cottagecore: 'sage',
};

const LEGACY_DARK = new Set([
  'dark', 'aurora', 'dusk', 'sunset', 'obsidian', 'nord', 'dracula',
  'vaporwave', 'cyberpunk', 'abyss', 'espresso', 'claret', 'beacon',
]);

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // Safari private mode and some embedded webviews throw
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Persistence is best-effort; the choice still applies for this session
  }
};

/** Maps any stored value — family, legacy key, or junk — onto a live family. */
const resolveFamily = (value) => {
  if (FAMILY_KEYS.has(value)) return value;
  if (LEGACY_FAMILY[value]) return LEGACY_FAMILY[value];
  return DEFAULT_FAMILY;
};

const prefersDark = () => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => resolveFamily(read('theme')));

  const [mode, setModeState] = useState(() => {
    const stored = read('themeMode');
    if (MODE_KEYS.has(stored)) return stored;
    // First run after the upgrade: a legacy key carried a mode with it, so
    // honour that rather than silently flipping the user to system.
    const legacy = read('theme');
    if (legacy && LEGACY_FAMILY[legacy] && !FAMILY_KEYS.has(legacy)) {
      return LEGACY_DARK.has(legacy) ? 'dark' : 'light';
    }
    if (legacy === 'dark' || legacy === 'light') return legacy;
    return DEFAULT_MODE;
  });

  const [systemDark, setSystemDark] = useState(prefersDark);

  // Track the OS preference only while it can actually matter.
  useEffect(() => {
    if (mode !== 'system') return undefined;
    let mq;
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return undefined;
    }
    const onChange = (e) => setSystemDark(e.matches);
    setSystemDark(mq.matches);
    // addListener is the pre-Safari-14 spelling and still the only one there
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else if (mq.removeListener) mq.removeListener(onChange);
    };
  }, [mode]);

  const resolvedMode = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    write('theme', theme);
    write('themeMode', mode);

    const el = document.documentElement;
    el.className = resolvedMode;
    el.setAttribute('data-theme', theme);
    // Tells the UA to render native controls, scrollbars and form widgets to
    // match; without it a dark page gets white scrollbars and date pickers.
    el.style.colorScheme = resolvedMode;

    // Mobile browser chrome should track the page, not a hardcoded navy.
    try {
      const bg = getComputedStyle(el).getPropertyValue('--bg-color').trim();
      if (bg) {
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = 'theme-color';
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', bg);
      }
    } catch {
      // Purely cosmetic; never worth breaking a render over
    }
  }, [theme, mode, resolvedMode]);

  const setTheme = useCallback((key) => setThemeState(resolveFamily(key)), []);

  const setMode = useCallback((key) => {
    setModeState(MODE_KEYS.has(key) ? key : DEFAULT_MODE);
  }, []);

  /** Legacy helper: flips between explicit light and dark, leaving system. */
  const toggleTheme = useCallback(() => {
    setModeState((m) => {
      const current = m === 'system' ? (prefersDark() ? 'dark' : 'light') : m;
      return current === 'dark' ? 'light' : 'dark';
    });
  }, []);

  const value = useMemo(() => {
    const currentFamily = FAMILIES.find(f => f.key === theme) || FAMILIES[0];
    return {
      theme,
      setTheme,
      mode,
      setMode,
      resolvedMode,
      isDark: resolvedMode === 'dark',
      toggleTheme,
      families: FAMILIES,
      modes: MODES,
      currentFamily,
      // Back-compat for callers that predate families
      currentThemeDef: currentFamily,
      themes: FAMILIES,
    };
  }, [theme, mode, resolvedMode, setTheme, setMode, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
