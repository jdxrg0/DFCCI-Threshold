import React from 'react';

/* ──────────────────────────────────────────────────────────────────────────
   PageHeader — the app's one and only page title block.

   Every module, form and settings page uses this, so titles share one size,
   weight, colour, icon size and spacing. Pages must NOT hand-roll a heading
   with inline styles; extend this component instead.

   Always renders an <h1>: several pages previously used <h2> as their page
   title, which left them with no top-level heading at all.

     <PageHeader
       icon={Gamepad2}
       title={t('games_dashboard')}
       subtitle="Test your knowledge and climb the ranks."
       actions={<Link to="/games/create" className="btn btn-primary">New</Link>}
     />

   `title` and `subtitle` accept nodes as well as strings, for the pages that
   need a badge or a metadata row rather than plain text.
   ────────────────────────────────────────────────────────────────────────── */
const PageHeader = ({ icon: Icon, title, subtitle, actions, className = '' }) => (
  <header className={`page-header ${className}`.trim()}>
    <div className="page-header-text">
      <h1 className="page-header-title">
        {Icon && <Icon className="page-header-icon" aria-hidden="true" />}
        <span>{title}</span>
      </h1>
      {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="page-header-actions">{actions}</div>}
  </header>
);

export default PageHeader;
