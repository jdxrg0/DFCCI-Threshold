import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { resolveBackTarget } from '../data/navMap';

/* ──────────────────────────────────────────────────────────────────────────
   BackBar — the app's one and only back control.

   Mounted once in App.jsx above <Routes>, so every module, sub-page and
   settings screen gets the same button, in the same place, with the same
   label and the same behaviour. Individual pages must NOT render their own
   back buttons; add the route to data/navMap.js instead.

   Behaviour: pop in-app history when there is any, otherwise fall back to
   the route's declared parent so deep links and refreshes still work.
   ────────────────────────────────────────────────────────────────────────── */
const BackBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const parentPath = resolveBackTarget(location.pathname);

  // Top-level screens (dashboard, auth) get no back control.
  if (!parentPath) return null;

  const handleBack = () => {
    // history.state.idx is React Router's position in its own history stack.
    // > 0 means there is an in-app entry to return to.
    const hasInAppHistory = window.history.state && window.history.state.idx > 0;
    if (hasInAppHistory) {
      navigate(-1);
    } else {
      navigate(parentPath, { replace: true });
    }
  };

  return (
    <div className="btn-back-wrapper page-back-bar">
      <button
        type="button"
        onClick={handleBack}
        className="btn-back-pill"
        aria-label={t('back') || 'Back'}
      >
        <ChevronLeft size={16} aria-hidden="true" /> {t('back') || 'Back'}
      </button>
    </div>
  );
};

export default BackBar;
