/* ── Admin — small shared render pieces ───────────────────────────────────
   The tiles, meters, flows, pager and skeletons the admin tabs all draw
   from. Pure components only: data lives in the tabs and in useAdminMeta.js. */

import { ArrowRight } from 'lucide-react';

export const Meter = ({ percent, tone }) => {
  const width = Math.min(100, Math.max(0, percent || 0));
  return (
    <div
      className="adm-meter__track"
      role="progressbar"
      aria-valuenow={Math.round(width)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="adm-meter__fill" style={{ width: `${width}%`, '--tone': tone }} />
    </div>
  );
};

export const EmptyState = ({ icon: Icon, title, text }) => (
  <div className="adm-empty">
    <Icon size={38} className="adm-empty__icon" aria-hidden="true" />
    <h4 className="adm-empty__title">{title}</h4>
    <p className="adm-empty__text">{text}</p>
  </div>
);

export const Skeletons = ({ count = 5 }) => (
  <div aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="adm-skel" />
    ))}
  </div>
);

export const Flow = ({ from, to }) => (
  <div className="adm-flow">
    <div className="adm-flow__side">
      <span className="adm-flow__label">Sender</span>
      <span className="adm-flow__name">{from || 'Unknown'}</span>
    </div>
    <ArrowRight size={14} className="adm-flow__arrow" aria-hidden="true" />
    <div className="adm-flow__side adm-flow__side--to">
      <span className="adm-flow__label">Receiver</span>
      <span className="adm-flow__name">{to || 'Unknown'}</span>
    </div>
  </div>
);

export const Pager = ({ page, totalPages, onChange, label }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="adm-pager">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
      >
        {label.previous}
      </button>
      <span className="adm-pager__label">{label.of}</span>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={page >= totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
      >
        {label.next}
      </button>
    </div>
  );
};