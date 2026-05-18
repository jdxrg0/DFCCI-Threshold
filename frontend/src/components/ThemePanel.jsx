import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// ── Reusable inner panel content (used by both floating & inline variants) ──
export const ThemePanelContent = ({ onThemeChange }) => {
  const { theme, setTheme, themes } = useTheme();

  const handleThemeClick = (key) => {
    setTheme(key);
    onThemeChange?.();
  };

  const darkThemes = themes.filter(t => t.type === 'dark');
  const lightThemes = themes.filter(t => t.type === 'light');

  const renderSwatches = (themeList) => (
    <div className="theme-swatches">
      {themeList.map((t) => (
        <button
          key={t.key}
          className={`theme-swatch${theme === t.key ? ' active' : ''}`}
          onClick={() => handleThemeClick(t.key)}
          title={t.label}
          style={{ background: 'none', cursor: 'pointer' }}
        >
          <div className="theme-swatch-circle" style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', background: t.swatch[0] }} />
            <span style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%', background: t.swatch[1] }} />
            {theme === t.key && (
              <span className="theme-swatch-check">
                <Check size={7} color="#fff" strokeWidth={3} />
              </span>
            )}
          </div>
          <span className="theme-swatch-label">{t.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <p className="theme-panel-title">Dark Modes</p>
      {renderSwatches(darkThemes)}
      
      <p className="theme-panel-title" style={{ marginTop: '1rem' }}>Light Modes</p>
      <div style={{ marginBottom: 0 }}>
        {renderSwatches(lightThemes)}
      </div>
    </>
  );
};

// ── Floating desktop panel (triggered by Palette button in navbar) ──────────
const ThemePanel = () => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
    const handleClickOutside = (e) => {
      if (
        panelRef.current && 
        !panelRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="btn btn-secondary"
        style={{ padding: '0.5rem', position: 'relative' }}
        aria-label="Theme Settings"
        title="Theme Settings"
      >
        <Palette
          size={20}
          style={{ color: open ? 'var(--primary)' : 'var(--text-main)', transition: 'color 0.2s' }}
        />
        {open && (
          <span style={{
            position: 'absolute', bottom: '3px', left: '50%',
            transform: 'translateX(-50%)', width: '4px', height: '4px',
            borderRadius: '50%', backgroundColor: 'var(--primary)',
          }} />
        )}
      </button>

      {open && (
        <div className="theme-panel" ref={panelRef}>
          <ThemePanelContent onThemeChange={() => setOpen(false)} />
        </div>
      )}
    </>
  );
};

export default ThemePanel;
