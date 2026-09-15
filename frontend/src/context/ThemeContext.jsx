/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

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
const FAMILIES = [
  { key: 'azure',     label: 'Azure',      light: ['#f8fafc', '#0369a1'], dark: ['#0b1120', '#38bdf8'] },
  { key: 'aurora',    label: 'Aurora',     light: ['#f0fdf4', '#047857'], dark: ['#04140e', '#34d399'] },
  { key: 'ember',     label: 'Ember',      light: ['#faf3e3', '#9a4a07'], dark: ['#1c0f0b', '#fb923c'] },
  { key: 'dusk',      label: 'Dusk',       light: ['#f5f1fc', '#74409f'], dark: ['#150a1c', '#c084fc'] },
  { key: 'rose',      label: 'Rose',       light: ['#fdf2f6', '#a8175a'], dark: ['#1a0910', '#ec6b83'] },
  { key: 'tide',      label: 'Tide',       light: ['#e6f0f7', '#14556b'], dark: ['#03141a', '#20d6e0'] },
  { key: 'mono',      label: 'Mono',       light: ['#ffffff', '#18181b'], dark: ['#000000', '#fafafa'] },
  { key: 'nord',      label: 'Nord',       light: ['#e5e9f0', '#04458e'], dark: ['#2e3440', '#88c0d0'] },
  { key: 'dracula',   label: 'Dracula',    light: ['#fffbeb', '#872372'], dark: ['#282a36', '#ff79c6'] },
  { key: 'vapor',     label: 'Vaporwave',  light: ['#fce9f6', '#b409a9'], dark: ['#0e0524', '#ee6ad9'] },
  { key: 'neon',      label: 'Neon',       light: ['#f1f0f7', '#2f7801'], dark: ['#120f1f', '#a3e635'] },
  { key: 'roast',     label: 'Roast',      light: ['#f4eae0', '#5e3406'], dark: ['#332519', '#d7a566'] },
  { key: 'signal',    label: 'Signal',     light: ['#fffbd1', '#554c00'], dark: ['#05060a', '#ffd60a'] },
  { key: 'slate',     label: 'Slate',      light: ['#edeef2', '#3f3ba3'], dark: ['#191a1f', '#8b86fa'] },
  { key: 'sage',      label: 'Sage',       light: ['#f7f1dd', '#4a6323'], dark: ['#171d0e', '#b0cf76'] },
];

const MODES = [
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

/**
 * Shuffle.
 *
 * When it is on, the pre-paint bootstrap in index.html rolls a family (and,
 * until the user states a mode preference, a mode) and writes them straight
 * onto <html>. React must READ THAT BACK rather than roll again — a second
 * roll here would repaint the whole site the instant the app mounts.
 *
 * Shuffle also never touches the 'theme' key. An explicit pick has to survive
 * being switched on and off again, so the roll lives in 'themeLastRoll'.
 */
const bootFamily = () => {
  try {
    const v = document.documentElement.getAttribute('data-theme');
    return FAMILY_KEYS.has(v) ? v : null;
  } catch {
    return null;
  }
};

const bootMode = () => {
  try {
    const c = document.documentElement.className;
    return c === 'dark' || c === 'light' ? c : null;
  } catch {
    return null;
  }
};

/** Rolls a family, never the one just shown. Mirrors the bootstrap's rule. */
const rollFamily = (exclude) => {
  const pool = FAMILIES.map(f => f.key).filter(k => k !== exclude);
  return pool[Math.floor(Math.random() * pool.length)] || DEFAULT_FAMILY;
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
  const [shuffle, setShuffleState] = useState(() => read('themeShuffle') === '1');

  // Set the moment the user touches Light/Dark/System. From then on shuffle
  // leaves the mode alone.
  const [modeLocked, setModeLocked] = useState(() => {
    if (read('themeModeLocked') === '1') return true;
    // Migration: the pre-shuffle app wrote 'themeMode' on every mount, so an
    // explicit light/dark there is the only record a returning user left of
    // choosing. Treat it as a lock — see the matching note in index.html.
    const stored = read('themeMode');
    return stored === 'light' || stored === 'dark';
  });

  const [theme, setThemeState] = useState(
    () => (shuffle && bootFamily()) || resolveFamily(read('theme')),
  );

  const [mode, setModeState] = useState(() => {
    // An unlocked shuffled mode was decided pre-paint; adopting it keeps React
    // and the painted page in agreement.
    if (shuffle && !modeLocked) {
      const rolled = bootMode();
      if (rolled) return rolled;
    }
    const stored = read('themeMode');
    if (MODE_KEYS.has(stored)) return stored;
    // First run after the upgrade: a legacy key carried a mode with it, so
    // honour that rather than silently flipping the user to system.
    //
    // This deliberately checks LEGACY_FAMILY *before* FAMILY_KEYS: aurora,
    // dusk, nord, dracula and slate are both old theme names and new family
    // names, and while themeMode is absent the old meaning is the right one.
    // Must stay identical to the bootstrap in index.html — audit:themes checks.
    const legacy = read('theme');
    if (legacy && LEGACY_FAMILY[legacy]) {
      return LEGACY_DARK.has(legacy) ? 'dark' : 'light';
    }
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
    queueMicrotask(() => setSystemDark(mq.matches));
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
    // Deliberately NOT persisting here. This effect runs for every change,
    // including a shuffled one, and writing 'theme' from it would quietly
    // overwrite the user's saved pick with whatever the dice produced. The
    // setters below persist instead, so storage only ever records a choice
    // the user actually made.
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

  /** Picking a swatch is a decision, so it also ends the shuffle. */
  const setTheme = useCallback((key) => {
    const family = resolveFamily(key);
    setThemeState(family);
    write('theme', family);
    setShuffleState(false);
    write('themeShuffle', '0');
  }, []);

  const setMode = useCallback((key) => {
    const next = MODE_KEYS.has(key) ? key : DEFAULT_MODE;
    setModeState(next);
    write('themeMode', next);
    // Stating a mode preference locks it. Someone who chose dark for
    // photosensitivity must never be handed a white page by the dice.
    setModeLocked(true);
    write('themeModeLocked', '1');
  }, []);

  /**
   * Turning shuffle ON rolls immediately — a toggle that does nothing until
   * the next reload reads as broken. Turning it OFF keeps whatever is on
   * screen and commits it, which is what "stop, I like this one" means.
   */
  const setShuffle = useCallback((on) => {
    setShuffleState(on);
    write('themeShuffle', on ? '1' : '0');

    // Reading state from the closure rather than a functional updater is
    // deliberate: these branches roll dice and write to storage, and React
    // double-invokes updaters under StrictMode. An impure updater would roll
    // twice, leaving 'themeLastRoll' recording a family that was never shown.
    if (on) {
      const next = rollFamily(theme);
      setThemeState(next);
      // Same keys the bootstrap reads, so the next load inside the visit
      // window reuses this roll instead of rolling again.
      write('themeRoll', next);
      write('themeRollAt', String(Date.now()));
      if (!modeLocked) {
        const rolled = Math.random() < 0.5 ? 'dark' : 'light';
        write('themeRollMode', rolled);
        setModeState(rolled);
      }
    } else {
      // Switching off is an UNDO, so it restores the pick that was saved before
      // shuffle started rather than committing whatever the dice happened to be
      // showing. Turning it on to try it must not cost you your theme. To keep
      // a rolled theme instead, click its swatch — which is what the toggle's
      // sub-label tells you to do.
      setThemeState(resolveFamily(read('theme')));
      if (!modeLocked) {
        const stored = read('themeMode');
        setModeState(MODE_KEYS.has(stored) ? stored : DEFAULT_MODE);
      }
    }
  }, [theme, modeLocked]);

  /** Legacy helper: flips between explicit light and dark, leaving system. */
  const toggleTheme = useCallback(() => {
    setModeState((m) => {
      const current = m === 'system' ? (prefersDark() ? 'dark' : 'light') : m;
      const next = current === 'dark' ? 'light' : 'dark';
      write('themeMode', next);
      return next;
    });
    setModeLocked(true);
    write('themeModeLocked', '1');
  }, []);

  const value = useMemo(() => {
    const currentFamily = FAMILIES.find(f => f.key === theme) || FAMILIES[0];
    return {
      theme,
      setTheme,
      mode,
      setMode,
      shuffle,
      setShuffle,
      modeLocked,
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
  }, [theme, mode, resolvedMode, shuffle, modeLocked, setTheme, setMode, setShuffle, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
