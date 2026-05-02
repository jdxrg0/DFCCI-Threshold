import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, RotateCcw } from 'lucide-react';
import { useTheme, THEMES } from '../context/ThemeContext';

// ── Color row used for each customizable variable ────────────────────────────
const ColorRow = ({ label, value, defaultValue, customValue, onChange, onReset }) => (
  <div className="theme-color-row">
    <div
      className="theme-color-preview"
      style={{ background: value }}
      title={value}
    />
    <span className="theme-color-label">{label}</span>
    <input
      type="color"
      className="theme-color-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={`Pick ${label} color`}
    />
    {customValue && (
      <button
        className="theme-color-reset"
        onClick={onReset}
        title={`Reset to theme default (${defaultValue})`}
      >
        <RotateCcw size={11} />
      </button>
    )}
  </div>
);

// ── Group label inside the panel ─────────────────────────────────────────────
const GroupLabel = ({ children }) => (
  <p className="theme-panel-title" style={{ marginTop: '0.75rem' }}>{children}</p>
);

// ── Reusable inner panel content (used by both floating & inline variants) ──
export const ThemePanelContent = ({ onThemeChange }) => {
  const {
    theme, setTheme,
    customPrimary,   setCustomPrimary,   resetCustomPrimary,
    customSecondary, setCustomSecondary, resetCustomSecondary,
    customBgColor,   setCustomBgColor,   resetCustomBgColor,
    customTextMain,  setCustomTextMain,  resetCustomTextMain,
    customTextMuted, setCustomTextMuted, resetCustomTextMuted,
    customBorder,    setCustomBorder,    resetCustomBorder,
    resetAllCustom,
    hasAnyCustom,
    currentThemeDef,
  } = useTheme();

  const d = currentThemeDef.defaults;

  const handleThemeClick = (key) => {
    setTheme(key);
    onThemeChange?.();
  };

  return (
    <>
      {/* ── Theme swatches ── */}
      <p className="theme-panel-title">Theme</p>
      <div className="theme-swatches">
        {THEMES.map((t) => (
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

      <div className="theme-panel-divider" />

      {/* ── Custom Colors Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <p className="theme-panel-title" style={{ margin: 0 }}>Custom Colors</p>
        {hasAnyCustom && (
          <button
            className="theme-color-reset"
            onClick={resetAllCustom}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem' }}
          >
            <RotateCcw size={10} /> Reset all
          </button>
        )}
      </div>

      {/* ── Accent Colors ── */}
      <GroupLabel>Accents</GroupLabel>
      <ColorRow
        label="Primary"
        value={customPrimary || d.primary}
        defaultValue={d.primary}
        customValue={customPrimary}
        onChange={setCustomPrimary}
        onReset={resetCustomPrimary}
      />
      <ColorRow
        label="Secondary"
        value={customSecondary || d.secondary}
        defaultValue={d.secondary}
        customValue={customSecondary}
        onChange={setCustomSecondary}
        onReset={resetCustomSecondary}
      />

      {/* ── Background & Text ── */}
      <GroupLabel>Background & Text</GroupLabel>
      <ColorRow
        label="Background"
        value={customBgColor || d.bgColor}
        defaultValue={d.bgColor}
        customValue={customBgColor}
        onChange={setCustomBgColor}
        onReset={resetCustomBgColor}
      />
      <ColorRow
        label="Main Text"
        value={customTextMain || d.textMain}
        defaultValue={d.textMain}
        customValue={customTextMain}
        onChange={setCustomTextMain}
        onReset={resetCustomTextMain}
      />
      <ColorRow
        label="Muted Text"
        value={customTextMuted || d.textMuted}
        defaultValue={d.textMuted}
        customValue={customTextMuted}
        onChange={setCustomTextMuted}
        onReset={resetCustomTextMuted}
      />

      {/* ── Structure ── */}
      <GroupLabel>Structure</GroupLabel>
      <ColorRow
        label="Border"
        value={customBorder || d.border}
        defaultValue={d.border}
        customValue={customBorder}
        onChange={setCustomBorder}
        onReset={resetCustomBorder}
      />
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
        aria-label="Theme & Color Settings"
        title="Theme & Color Settings"
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
