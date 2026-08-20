import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, X } from 'lucide-react';

/* ── Module section tabs ─────────────────────────────────────────────────
   One source for every module's section navigation, so the modules cannot
   drift apart the way they had. Each caller passes a single `tabs` array and
   gets two presentations out of it:

     desktop (>768px)   a horizontal pill row
     mobile  (<=768px)  a fixed bottom bar, thumb-reachable

   Only one is ever displayed — the other is display:none, which also keeps it
   out of the accessibility tree, so a screen reader sees a single tablist.

   A bottom bar stops being tappable past five columns, so a module with more
   sections than that keeps the first four and folds the rest into a "More"
   sheet. Nothing ends up parked off-screen the way a scroller parks it.

   tabs: [{ id, label, short?, Icon, count?, tone? }]
   ──────────────────────────────────────────────────────────────────────── */

const BOTTOM_SLOTS = 5;

// Which tone wins when several overflow sections are waiting at once.
const TONE_RANK = { danger: 4, warn: 3, violet: 2, info: 1, brand: 1, ok: 1, muted: 0 };

const ModuleTabs = ({
  tabs,
  activeId,
  onChange,
  ariaLabel = 'Sections',
  // Admin keeps its own vertical rail on desktop and only wants the bottom bar.
  desktop = true,
  // When set, tabs are wired to their panels as `${prefix}-panel-${id}`.
  panelIdPrefix,
  moreLabel = 'More',
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const tabRefs = useRef([]);
  const bottomRefs = useRef([]);
  const panelRef = useRef(null);
  const moreRef = useRef(null);

  const overflows = tabs.length > BOTTOM_SLOTS;
  const primary = overflows ? tabs.slice(0, BOTTOM_SLOTS - 1) : tabs;
  const overflow = overflows ? tabs.slice(BOTTOM_SLOTS - 1) : [];
  const activeOverflowTab = overflow.find((t) => t.id === activeId) || null;

  // A count behind the sheet is a count nobody sees: on a phone an admin would
  // never learn that deletion requests are waiting. Roll the hidden totals onto
  // the More button, wearing the most urgent tone among them.
  const overflowCount = overflow.reduce((n, t) => n + (t.count > 0 ? t.count : 0), 0);
  const overflowTone = overflow
    .filter((t) => t.count > 0 && t.tone)
    .sort((a, b) => (TONE_RANK[b.tone] || 0) - (TONE_RANK[a.tone] || 0))[0]?.tone;

  useEffect(() => {
    if (!sheetOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSheetOpen(false); };
    const trigger = moreRef.current;
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      // Send focus back where it came from, or it lands on <body>.
      trigger?.focus();
    };
  }, [sheetOpen]);

  // Roving arrow-key movement — the behaviour AdminPanel's rail already had,
  // now every module gets it.
  const onKeyDown = (e, index) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 }[e.key];
    let next = null;
    if (step) next = (index + step + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].id);
    tabRefs.current[next]?.focus();
  };

  // Same roving movement as the desktop row, but scoped to the columns the
  // bottom bar actually shows — the overflow ones live behind the sheet.
  const onBottomKeyDown = (e, index) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    let next = null;
    if (step) next = (index + step + primary.length) % primary.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = primary.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(primary[next].id);
    bottomRefs.current[next]?.focus();
  };

  const panelAttrs = (tab) => (panelIdPrefix
    ? { id: `${panelIdPrefix}-tab-${tab.id}`, 'aria-controls': `${panelIdPrefix}-panel-${tab.id}` }
    : {});

  const countOf = (tab) => (tab.count > 0 ? tab.count : null);

  return (
    <>
      {desktop && (
        <div className="mod-tabs">
          <div className="mod-tabs__track" role="tablist" aria-label={ariaLabel}>
            {tabs.map((tab, i) => {
              const selected = tab.id === activeId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  ref={(el) => { tabRefs.current[i] = el; }}
                  className={`mod-tab ${selected ? 'is-active' : ''}`}
                  onClick={() => onChange(tab.id)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  {...panelAttrs(tab)}
                >
                  <tab.Icon size={15} aria-hidden="true" />
                  <span>{tab.label}</span>
                  {countOf(tab) && (
                    <span className="mod-tab__count" data-tone={tab.tone}>{tab.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Portalled to <body> so `position: fixed` cannot be captured by a
          transformed ancestor. CSS decides which bar is shown. */}
      {createPortal(
        <>
          <nav className="mod-bottomnav" aria-label={ariaLabel}>
            <div
              className="mod-bottomnav__track"
              role="tablist"
              aria-label={ariaLabel}
              style={{ '--slots': primary.length }}
            >
              {primary.map((tab, i) => {
                const selected = tab.id === activeId;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    ref={(el) => { bottomRefs.current[i] = el; }}
                    className={`mod-bottomnav__btn ${selected ? 'is-active' : ''}`}
                    onClick={() => onChange(tab.id)}
                    onKeyDown={(e) => onBottomKeyDown(e, i)}
                  >
                    <span className="mod-bottomnav__icon">
                      <tab.Icon size={19} aria-hidden="true" />
                      {countOf(tab) && (
                        <span className="mod-bottomnav__count" data-tone={tab.tone}>{tab.count}</span>
                      )}
                    </span>
                    <span className="mod-bottomnav__label">{tab.short || tab.label}</span>
                  </button>
                );
              })}
            </div>

            {overflows && (
              // Outside the tablist on purpose: it opens a sheet, it is not a tab.
              <button
                type="button"
                ref={moreRef}
                className={`mod-bottomnav__btn is-more ${activeOverflowTab ? 'is-active' : ''}`}
                onClick={() => setSheetOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                aria-label={overflowCount > 0
                  ? `${moreLabel} — ${overflowCount} awaiting attention`
                  : undefined}
              >
                <span className="mod-bottomnav__icon">
                  <MoreHorizontal size={19} aria-hidden="true" />
                  {overflowCount > 0 && (
                    <span className="mod-bottomnav__count" data-tone={overflowTone}>
                      {overflowCount}
                    </span>
                  )}
                </span>
                {/* Naming the active section rather than "More" keeps the bar
                    honest about where the reader currently is. */}
                <span className="mod-bottomnav__label">
                  {activeOverflowTab ? (activeOverflowTab.short || activeOverflowTab.label) : moreLabel}
                </span>
              </button>
            )}
          </nav>

          {sheetOpen && (
            <div className="mod-sheet" role="presentation" onClick={() => setSheetOpen(false)}>
              <div
                className="mod-sheet__panel"
                role="dialog"
                aria-modal="true"
                aria-label={`${moreLabel} — ${ariaLabel}`}
                tabIndex={-1}
                ref={panelRef}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mod-sheet__head">
                  <span className="mod-sheet__title">{moreLabel}</span>
                  <button
                    type="button"
                    className="mod-sheet__close"
                    onClick={() => setSheetOpen(false)}
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="mod-sheet__list">
                  {overflow.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`mod-sheet__item ${tab.id === activeId ? 'is-active' : ''}`}
                      onClick={() => { onChange(tab.id); setSheetOpen(false); }}
                    >
                      <tab.Icon size={18} aria-hidden="true" />
                      <span className="mod-sheet__itemlabel">{tab.label}</span>
                      {countOf(tab) && (
                        <span className="mod-tab__count" data-tone={tab.tone}>{tab.count}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>,
        document.body
      )}
    </>
  );
};

export default ModuleTabs;
