import React from 'react';

// ── Define preset identifiers ──
export const PRESETS = [
  'preset-1',
  'preset-2',
  'preset-3',
  'preset-4',
  'preset-5',
  'preset-6',
  'preset-7',
  'preset-8'
];

// ── Render the custom vector SVG preset avatar inline ──
export const renderPresetSvg = (presetId, size = 32, style = {}) => {
  const finalStyle = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    display: 'block',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    ...style
  };

  switch (presetId) {
    case 'preset-1': // Sunset Bliss
      return (
        <svg viewBox="0 0 100 100" style={finalStyle}>
          <defs>
            <linearGradient id="presetGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF512F" />
              <stop offset="100%" stopColor="#DD2476" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="50" fill="url(#presetGrad1)" />
          <circle cx="50" cy="50" r="25" fill="#ffffff" opacity="0.15" />
          <polygon points="50,25 57,43 75,43 60,54 66,72 50,61 34,72 40,54 25,43 43,43" fill="#ffffff" />
        </svg>
      );

    case 'preset-2': // Neon Horizon
      return (
        <svg viewBox="0 0 100 100" style={finalStyle}>
          <defs>
            <radialGradient id="presetGrad2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#8A2387" />
              <stop offset="60%" stopColor="#E94057" />
              <stop offset="100%" stopColor="#F27121" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="50" fill="url(#presetGrad2)" />
          <circle cx="50" cy="50" r="32" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.3" />
          <circle cx="50" cy="50" r="18" fill="#ffffff" opacity="0.2" />
        </svg>
      );

    case 'preset-3': // Nordic Aurora
      return (
        <svg viewBox="0 0 100 100" style={finalStyle}>
          <defs>
            <linearGradient id="presetGrad3" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0575E6" />
              <stop offset="100%" stopColor="#00F260" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="50" fill="url(#presetGrad3)" />
          <circle cx="50" cy="50" r="25" fill="#ffffff" opacity="0.15" />
          <polygon points="50,30 65,60 35,60" fill="#ffffff" />
        </svg>
      );

    case 'preset-4': // Ocean Breeze
      return (
        <svg viewBox="0 0 100 100" style={finalStyle}>
          <defs>
            <linearGradient id="presetGrad4" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00c6ff" />
              <stop offset="100%" stopColor="#0072ff" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="50" fill="url(#presetGrad4)" />
          <path d="M20,60 Q35,45 50,60 T80,60 L80,85 L20,85 Z" fill="#ffffff" opacity="0.25" />
          <circle cx="50" cy="40" r="12" fill="#ffffff" opacity="0.3" />
        </svg>
      );

    case 'preset-5': // Citrus Mint
      return (
        <svg viewBox="0 0 100 100" style={finalStyle}>
          <defs>
            <linearGradient id="presetGrad5" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#11998e" />
              <stop offset="100%" stopColor="#38ef7d" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="50" fill="url(#presetGrad5)" />
          <circle cx="50" cy="50" r="24" fill="#ffffff" opacity="0.2" />
          <rect x="42" y="42" width="16" height="16" fill="#ffffff" transform="rotate(45 50 50)" />
        </svg>
      );

    case 'preset-6': // Royal Velvet
      return (
        <svg viewBox="0 0 100 100" style={finalStyle}>
          <defs>
            <linearGradient id="presetGrad6" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#654ea3" />
              <stop offset="100%" stopColor="#eaafc8" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="50" fill="url(#presetGrad6)" />
          <circle cx="50" cy="50" r="30" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.3" />
          <circle cx="50" cy="50" r="16" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.4" />
        </svg>
      );

    case 'preset-7': // Crimson Fire
      return (
        <svg viewBox="0 0 100 100" style={finalStyle}>
          <defs>
            <linearGradient id="presetGrad7" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f12711" />
              <stop offset="100%" stopColor="#f5af19" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="50" fill="url(#presetGrad7)" />
          <circle cx="50" cy="50" r="32" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.35" />
          <circle cx="50" cy="50" r="8" fill="#ffffff" />
        </svg>
      );

    case 'preset-8': // Deep Space
      return (
        <svg viewBox="0 0 100 100" style={finalStyle}>
          <defs>
            <radialGradient id="presetGrad8" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#232526" />
              <stop offset="100%" stopColor="#414345" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="50" fill="url(#presetGrad8)" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="#00FFCC" strokeWidth="3" opacity="0.6" />
          <circle cx="50" cy="50" r="6" fill="#00FFCC" />
        </svg>
      );

    default:
      return null;
  }
};

// ── Unified rendering utility for Avatars ──
export const renderAvatarHelper = (user, size = 32, style = {}) => {
  const name = user?.displayName || user?.email || '?';
  const initial = name.charAt(0).toUpperCase();

  if (user?.profilePicture) {
    // If it's one of the vector presets, render natively
    if (PRESETS.includes(user.profilePicture)) {
      return renderPresetSvg(user.profilePicture, size, style);
    }

    // Otherwise render custom uploaded image
    return (
      <img
        src={user.profilePicture}
        alt={name}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid var(--primary)',
          boxShadow: '0 0 10px rgba(var(--primary-rgb), 0.2)',
          transition: 'all 0.3s ease',
          display: 'block',
          ...style
        }}
        className="navbar-avatar"
      />
    );
  }

  // Fallback to beautiful gradient initials circle
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: `${size * 0.45}px`,
        border: '2px solid var(--border-color)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        textShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'all 0.3s ease',
        ...style
      }}
      className="navbar-avatar"
    >
      {initial}
    </div>
  );
};
