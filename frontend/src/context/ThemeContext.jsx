import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

// ── Built-in theme definitions ─────────────────────────────────────────────
// defaults must all be hex strings so they work with <input type="color">
export const THEMES = [
  {
    key: 'dark',
    label: 'Midnight Navy',
    swatch: ['#0b1120', '#0ea5e9'],
    defaults: {
      primary:    '#0ea5e9',
      secondary:  '#14b8a6',
      bgColor:    '#0b1120',
      textMain:   '#f8fafc',
      textMuted:  '#94a3b8',
      border:     '#1e3a50',
    },
  },
  {
    key: 'light',
    label: 'Crisp White',
    swatch: ['#f8fafc', '#0284c7'],
    defaults: {
      primary:    '#0284c7',
      secondary:  '#0d9488',
      bgColor:    '#f8fafc',
      textMain:   '#0f172a',
      textMuted:  '#475569',
      border:     '#cbd5e1',
    },
  },
  {
    key: 'aurora',
    label: 'Aurora',
    swatch: ['#0a1a12', '#00e5a0'],
    defaults: {
      primary:    '#00e5a0',
      secondary:  '#00bfff',
      bgColor:    '#0a1a12',
      textMain:   '#e8fff6',
      textMuted:  '#7ec8a0',
      border:     '#0d3322',
    },
  },
  {
    key: 'dusk',
    label: 'Dusk',
    swatch: ['#1a0a1f', '#c084fc'],
    defaults: {
      primary:    '#c084fc',
      secondary:  '#f472b6',
      bgColor:    '#1a0a1f',
      textMain:   '#fdf4ff',
      textMuted:  '#c4a8d4',
      border:     '#3b1a52',
    },
  },
  {
    key: 'ocean',
    label: 'Deep Ocean',
    swatch: ['#040d1a', '#22d3ee'],
    defaults: {
      primary:    '#22d3ee',
      secondary:  '#38bdf8',
      bgColor:    '#040d1a',
      textMain:   '#ecfeff',
      textMuted:  '#7dd3e8',
      border:     '#0a2535',
    },
  },
  {
    key: 'slate',
    label: 'Slate Pro',
    swatch: ['#e2e8f0', '#6366f1'],
    defaults: {
      primary:    '#6366f1',
      secondary:  '#8b5cf6',
      bgColor:    '#f1f5f9',
      textMain:   '#1e293b',
      textMuted:  '#64748b',
      border:     '#cbd5e1',
    },
  },
  // ── Gen Z themes ─────────────────────────────────────────────────────────
  {
    key: 'brat',
    label: 'Brat',
    swatch: ['#0d0d0d', '#aaff00'],
    defaults: {
      primary:    '#aaff00',
      secondary:  '#ccff33',
      bgColor:    '#0d0d0d',
      textMain:   '#f0f0e8',
      textMuted:  '#888877',
      border:     '#2a2a1a',
    },
  },
  {
    key: 'vaporwave',
    label: 'Vaporwave',
    swatch: ['#0d0620', '#ff6ec7'],
    defaults: {
      primary:    '#ff6ec7',
      secondary:  '#00fff5',
      bgColor:    '#0d0620',
      textMain:   '#f5e6ff',
      textMuted:  '#b39ddb',
      border:     '#2d1545',
    },
  },
  {
    key: 'cottagecore',
    label: 'Cottagecore',
    swatch: ['#f5f0e8', '#6b8e5a'],
    defaults: {
      primary:    '#6b8e5a',
      secondary:  '#c17b5c',
      bgColor:    '#f5f0e8',
      textMain:   '#2c2416',
      textMuted:  '#7a6652',
      border:     '#d4c9b4',
    },
  },
  {
    key: 'y2k',
    label: 'Y2K',
    swatch: ['#f0eeff', '#ff69b4'],
    defaults: {
      primary:    '#ff69b4',
      secondary:  '#a78bfa',
      bgColor:    '#f0eeff',
      textMain:   '#1a0a2e',
      textMuted:  '#7050a0',
      border:     '#d4b8f0',
    },
  },
  {
    key: 'cherry',
    label: 'Cherry Blossom',
    swatch: ['#fff5f7', '#e8527a'],
    defaults: {
      primary:    '#e8527a',
      secondary:  '#f4a0b8',
      bgColor:    '#fff5f7',
      textMain:   '#2d0a16',
      textMuted:  '#9e6678',
      border:     '#f0c0cc',
    },
  },
  {
    key: 'matcha',
    label: 'Matcha',
    swatch: ['#f4f5ee', '#4a7c59'],
    defaults: {
      primary:    '#4a7c59',
      secondary:  '#8fb996',
      bgColor:    '#f4f5ee',
      textMain:   '#1a2616',
      textMuted:  '#6b7d67',
      border:     '#c8d4be',
    },
  },
];

// ── Helper: make a custom color state pair (state + localStorage key) ───────
const makeColorState = (key) => ({
  state: () => localStorage.getItem(key) || '',
  lsKey: key,
});

const COLOR_KEYS = {
  primary:   'custom-primary',
  secondary: 'custom-secondary',
  bgColor:   'custom-bg-color',
  textMain:  'custom-text-main',
  textMuted: 'custom-text-muted',
  border:    'custom-border',
};

// ── Apply a single custom CSS var override ───────────────────────────────────
const applyVar = (cssVar, value, ...extras) => {
  const root = document.documentElement;
  if (value) {
    root.style.setProperty(cssVar, value);
    extras.forEach(([v, val]) => root.style.setProperty(v, val));
  } else {
    root.style.removeProperty(cssVar);
    extras.forEach(([v]) => root.style.removeProperty(v));
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') || 'dark');

  // One state per customizable color
  const [customPrimary,   setCustomPrimaryState]   = useState(() => localStorage.getItem(COLOR_KEYS.primary)   || '');
  const [customSecondary, setCustomSecondaryState] = useState(() => localStorage.getItem(COLOR_KEYS.secondary) || '');
  const [customBgColor,   setCustomBgColorState]   = useState(() => localStorage.getItem(COLOR_KEYS.bgColor)   || '');
  const [customTextMain,  setCustomTextMainState]  = useState(() => localStorage.getItem(COLOR_KEYS.textMain)  || '');
  const [customTextMuted, setCustomTextMutedState] = useState(() => localStorage.getItem(COLOR_KEYS.textMuted) || '');
  const [customBorder,    setCustomBorderState]    = useState(() => localStorage.getItem(COLOR_KEYS.border)    || '');

  // Apply theme class to <html>
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.className = theme;
  }, [theme]);

  // Apply each custom CSS var whenever its value or the theme changes
  useEffect(() => {
    applyVar('--primary', customPrimary, ['--primary-hover', customPrimary]);
  }, [customPrimary, theme]);

  useEffect(() => {
    applyVar('--secondary', customSecondary);
  }, [customSecondary, theme]);

  useEffect(() => {
    if (customBgColor) {
      document.documentElement.style.setProperty('--bg-color', customBgColor);
      // Flatten gradient to solid color when user overrides bg
      document.documentElement.style.setProperty(
        '--bg-gradient',
        `linear-gradient(135deg, ${customBgColor} 0%, ${customBgColor} 100%)`
      );
    } else {
      document.documentElement.style.removeProperty('--bg-color');
      document.documentElement.style.removeProperty('--bg-gradient');
    }
  }, [customBgColor, theme]);

  useEffect(() => {
    applyVar('--text-main', customTextMain);
  }, [customTextMain, theme]);

  useEffect(() => {
    applyVar('--text-muted', customTextMuted);
  }, [customTextMuted, theme]);

  useEffect(() => {
    applyVar('--border-color', customBorder);
  }, [customBorder, theme]);

  // ── Setters (update state + localStorage) ─────────────────────────────────
  const makeSetters = (stateSet, lsKey) => ({
    set: (v) => { stateSet(v); localStorage.setItem(lsKey, v); },
    reset: () => { stateSet(''); localStorage.removeItem(lsKey); },
  });

  const p   = makeSetters(setCustomPrimaryState,   COLOR_KEYS.primary);
  const s   = makeSetters(setCustomSecondaryState, COLOR_KEYS.secondary);
  const bg  = makeSetters(setCustomBgColorState,   COLOR_KEYS.bgColor);
  const tm  = makeSetters(setCustomTextMainState,  COLOR_KEYS.textMain);
  const tmu = makeSetters(setCustomTextMutedState, COLOR_KEYS.textMuted);
  const bo  = makeSetters(setCustomBorderState,    COLOR_KEYS.border);

  const resetAllCustom = () => {
    [p, s, bg, tm, tmu, bo].forEach(({ reset }) => reset());
  };

  const setTheme = (key) => {
    setThemeState(key);
    // Optionally clear all custom overrides on theme switch so defaults show cleanly.
    // We intentionally do NOT clear here — user may want to carry over tweaks.
    // But we flush CSS vars so the new theme class takes over for anything not overridden.
  };

  // Legacy toggle
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const currentThemeDef = THEMES.find(t => t.key === theme) || THEMES[0];

  // Expose whether any custom overrides are active
  const hasAnyCustom = !!(customPrimary || customSecondary || customBgColor || customTextMain || customTextMuted || customBorder);

  return (
    <ThemeContext.Provider value={{
      theme, setTheme, toggleTheme,
      // per-color state + setters + resets
      customPrimary,   setCustomPrimary:   p.set,   resetCustomPrimary:   p.reset,
      customSecondary, setCustomSecondary: s.set,   resetCustomSecondary: s.reset,
      customBgColor,   setCustomBgColor:   bg.set,  resetCustomBgColor:   bg.reset,
      customTextMain,  setCustomTextMain:  tm.set,  resetCustomTextMain:  tm.reset,
      customTextMuted, setCustomTextMuted: tmu.set, resetCustomTextMuted: tmu.reset,
      customBorder,    setCustomBorder:    bo.set,  resetCustomBorder:    bo.reset,
      resetAllCustom,
      hasAnyCustom,
      currentThemeDef,
      themes: THEMES,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
