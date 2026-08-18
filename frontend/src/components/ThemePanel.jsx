import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const MODE_ICONS = { light: Sun, dark: Moon, system: Monitor };

// ── Reusable inner panel content (used by both floating & inline variants) ──
export const ThemePanelContent = ({ onThemeChange }) => {
  const { theme, setTheme, families, mode, setMode, modes, resolvedMode } = useTheme();

  const handleThemeClick = (key) => {
    setTheme(key);
    onThemeChange?.();
  };

  return (
    <>
      {/* ── Mode ── */}
      <p className="theme-panel-title">Appearance</p>
      <div className="mode-switch" role="group" aria-label="Appearance">
        {modes.map(({ key, label }) => {
          const Icon = MODE_ICONS[key];
          const active = mode === key;
          return (
            <button
              key={key}
              type="button"
              className={`mode-switch-btn${active ? ' active' : ''}`}
              onClick={() => setMode(key)}
              aria-pressed={active}
              title={key === 'system' ? 'Follow your device setting' : label}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      {mode === 'system' && (
        <p className="theme-panel-hint">
          Following your device — currently {resolvedMode}.
        </p>
      )}

      {/* ── Family ── */}
      <p className="theme-panel-title" style={{ marginTop: '1rem' }}>Theme</p>
      <div className="theme-swatches">
        {families.map((f) => {
          // Preview the variant the user will actually get in the current mode.
          const pair = (resolvedMode === 'dark' ? f.dark : f.light) || f.dark || f.light;
          const active = theme === f.key;
          return (
            <button
              key={f.key}
              type="button"
              className={`theme-swatch${active ? ' active' : ''}`}
              onClick={() => handleThemeClick(f.key)}
              title={f.label}
              aria-pressed={active}
              style={{ background: 'none', cursor: 'pointer' }}
            >
              <div className="theme-swatch-circle" style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', background: pair[0] }} />
                <span style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%', background: pair[1] }} />
                {active && (
                  <span className="theme-swatch-check">
                    <Check size={7} color="#fff" strokeWidth={3} />
                  </span>
                )}
              </div>
              <span className="theme-swatch-label">{f.label}</span>
            </button>
          );
        })}
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
