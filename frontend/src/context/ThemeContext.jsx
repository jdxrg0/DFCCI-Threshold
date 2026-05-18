import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const THEMES = [
  // Dark Themes
  { key: 'dark', label: 'Midnight Navy', type: 'dark', swatch: ['#0b1120', '#0ea5e9'] },
  { key: 'obsidian', label: 'Obsidian', type: 'dark', swatch: ['#000000', '#ffffff'] },
  { key: 'aurora', label: 'Aurora', type: 'dark', swatch: ['#0a1a12', '#00e5a0'] },
  { key: 'dusk', label: 'Dusk', type: 'dark', swatch: ['#1a0a1f', '#c084fc'] },
  { key: 'dracula', label: 'Dracula', type: 'dark', swatch: ['#282a36', '#ff79c6'] },
  { key: 'nord', label: 'Nord', type: 'dark', swatch: ['#2e3440', '#88c0d0'] },
  { key: 'sunset', label: 'Sunset', type: 'dark', swatch: ['#2a1215', '#f97316'] },
  { key: 'vaporwave', label: 'Vaporwave', type: 'dark', swatch: ['#0d0620', '#ff6ec7'] },
  { key: 'cyberpunk', label: 'Cyberpunk', type: 'dark', swatch: ['#09090b', '#fde047'] },

  // Light Themes
  { key: 'light', label: 'Crisp White', type: 'light', swatch: ['#f8fafc', '#0284c7'] },
  { key: 'slate', label: 'Slate Pro', type: 'light', swatch: ['#e2e8f0', '#6366f1'] },
  { key: 'cottagecore', label: 'Cottagecore', type: 'light', swatch: ['#f5f0e8', '#6b8e5a'] },
  { key: 'sepia', label: 'Sepia', type: 'light', swatch: ['#fef3c7', '#d97706'] },
  { key: 'mint', label: 'Mint Breeze', type: 'light', swatch: ['#f0fdf4', '#10b981'] },
  { key: 'lavender', label: 'Lavender', type: 'light', swatch: ['#faf5ff', '#9333ea'] },
];

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.className = theme;
  }, [theme]);

  const setTheme = (key) => {
    setThemeState(key);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const currentThemeDef = THEMES.find(t => t.key === theme) || THEMES[0];

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      toggleTheme,
      currentThemeDef,
      themes: THEMES,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
