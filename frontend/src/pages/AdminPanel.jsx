/* ──────────────────────────────────────────────────────────────────────────
   Admin Dashboard — /admin

   The shell only: access control, the shared attention/meta slice the badges
   and the Overview draw from, the ModuleTabs navigation (desktop pill row +
   mobile bottom bar from components/ModuleTabs.jsx), the popup modal, and
   the lazy boot of the eight section panels.

   Each tab is its own chunk, loaded here via React.lazy so opening the page
   never pays for all of them:
     overview   OverviewTab.jsx      KPI rail + attention list
     users      MembersTab.jsx       GET /users (+role, verify, resend-otp,
                                     delete, reminders, rename, date power
                                     and the /bulk/* set; CSV export)
     signups    SignupsTab.jsx       GET /users/admin/pending-signups
     privacy    PrivacyTab.jsx       deletion-requests + restore-requests +
                                     recently-deleted behind one segment
     tickets    RequestsTab.jsx      GET /tickets (+ PATCH /:id/admin)
     emails     EmailsTab.jsx        GET /emails (+ POST /:id/resend, drawer)
     audit      AuditTab.jsx         GET /users/admin/audit
     limits     LimitsTab.jsx        GET /users/admin/platform-limits
                                     GET /users/admin/platform-history

   Boilerplate lives in pages/admin/shared.jsx and pages/admin/utils.js; the
   boot payload in pages/admin/useAdminMeta.js. Presentation stays in
   styles/admin.css — no inline colour here, it is what stopped this page
   working on the light themes.
   ────────────────────────────────────────────────────────────────────────── */

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import PopupModal from '../components/PopupModal';
import PageHeader from '../components/PageHeader';
import ModuleTabs from '../components/ModuleTabs';
import { useAdminMeta } from './admin/useAdminMeta';
import { Skeletons } from './admin/shared';
import {
  AlertTriangle,
  Clock,
  HardDrive,
  LayoutDashboard,
  Mail,
  MessageSquare,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

const OverviewTab = lazy(() => import('./admin/OverviewTab'));
const MembersTab = lazy(() => import('./admin/MembersTab'));
const SignupsTab = lazy(() => import('./admin/SignupsTab'));
const PrivacyTab = lazy(() => import('./admin/PrivacyTab'));
const RequestsTab = lazy(() => import('./admin/RequestsTab'));
const EmailsTab = lazy(() => import('./admin/EmailsTab'));
const AuditTab = lazy(() => import('./admin/AuditTab'));
const LimitsTab = lazy(() => import('./admin/LimitsTab'));

const TAB_IDS = ['overview', 'users', 'signups', 'privacy', 'tickets', 'emails', 'audit', 'limits'];

const AdminPanel = () => {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const meta = useAdminMeta();

  // Every other module restores its section on mount; Admin does the same. A
  // persisted id predates the restructure (deletion-requests, restore-requests,
  // recently-deleted became `privacy`), so unknown values resolve to Overview —
  // and ModuleTabs rights the stored one on its first render.
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem('admin_activeTab') || 'overview',
  );
  const activeResolved = TAB_IDS.includes(activeTab) ? activeTab : 'overview';

  // One-way seed from the Overview "Verified" tile, consumed by MembersTab on
  // mount so the jump lands on a filtered roster rather than the unfiltered one.
  const [memberStatusSeed, setMemberStatusSeed] = useState('');
  const consumeStatusSeed = useCallback(() => setMemberStatusSeed(''), []);

  const [popup, setPopup] = useState({
    isOpen: false, title: '', message: '', onConfirm: null,
    isAlert: false, isPrompt: false, promptValue: '',
  });

  const showAlert = useCallback((title, message) =>
    setPopup({ isOpen: true, title, message, onConfirm: null, isAlert: true, isPrompt: false, promptValue: '' }), []);
  const showConfirm = useCallback((title, message, onConfirm) =>
    setPopup({ isOpen: true, title, message, onConfirm, isAlert: false, isPrompt: false, promptValue: '' }), []);
  const showPrompt = useCallback((title, message, onConfirm) =>
    setPopup({ isOpen: true, title, message, onConfirm, isAlert: false, isPrompt: true, promptValue: '' }), []);

  /* ── Boot & access ──────────────────────────────────────────────────── */

  useEffect(() => {
    if (authLoading || !user) return; // wait for auth before deciding on access
    if (user.role !== 'ADMIN') {
      navigate('/dashboard');
      return;
    }
    meta.boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, navigate, meta.boot]);

  useEffect(() => {
    localStorage.setItem('admin_activeTab', activeResolved);
  }, [activeResolved]);

  // Re-fetch the queues behind the section being opened so the badges and the
  // panels never age. Platform limits are excluded here: that call hits the
  // Cloudinary API and runs dbStats over every collection, so it loads once
  // and refreshes only on request or the global Refresh.
  useEffect(() => {
    if (!meta.ready) return;
    if (activeResolved === 'signups') meta.fetchSignups();
    if (activeResolved === 'privacy') {
      meta.fetchDeletionRequests();
      meta.fetchRestoreRequests();
      meta.fetchRecentlyDeleted();
    }
    if (activeResolved === 'tickets') meta.fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeResolved, meta.ready,
      meta.fetchSignups, meta.fetchDeletionRequests, meta.fetchRestoreRequests,
      meta.fetchRecentlyDeleted, meta.fetchTickets]);

  const liveSignups = meta.signups.filter((s) => !s.expired).length;
  const pendingApprovals = meta.deletionRequests.length + meta.restoreRequests.length;
  const openTickets = meta.ticketsList.filter((tk) => tk.status === 'open' || tk.status === 'in-progress').length;

  const tabs = useMemo(() => [
    { id: 'overview', label: 'Overview', short: 'Overview', Icon: LayoutDashboard, count: 0 },
    { id: 'users', label: 'Members', short: 'Members', Icon: Users, count: 0 },
    { id: 'signups', label: 'Signups', short: 'Signups', Icon: UserPlus, count: liveSignups, tone: 'warn' },
    { id: 'privacy', label: 'Privacy', short: 'Privacy', Icon: ShieldAlert, count: pendingApprovals, tone: 'danger' },
    { id: 'tickets', label: 'Requests', short: 'Requests', Icon: MessageSquare, count: openTickets, tone: 'violet' },
    { id: 'emails', label: t('admin_emails_tab') || 'Emails', short: 'Emails', Icon: Mail, count: 0 },
    { id: 'audit', label: 'Audit', short: 'Audit', Icon: ScrollText, count: 0 },
    { id: 'limits', label: 'Platform Limits', short: 'Limits', Icon: HardDrive, count: 0 },
  ], [liveSignups, pendingApprovals, openTickets, t]);

  const jump = useCallback((tab) => setActiveTab(tab), []);

  const openVerifiedMembers = useCallback(() => {
    setMemberStatusSeed('verified');
    setActiveTab('users');
  }, []);

  return (
    <div className="adm-page">
      <PageHeader
        icon={ShieldCheck}
        title="Admin Dashboard"
        subtitle="System administration and platform integrity control."
        actions={
          <>
            {meta.lastSync && (
              <span className="adm-sync">
                <Clock size={12} aria-hidden="true" />
                Synced {new Date(meta.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              type="button"
              className="btn btn-secondary page-header-btn"
              onClick={meta.refreshAll}
              disabled={meta.refreshing || meta.loading}
            >
              <RefreshCw size={15} className={meta.refreshing ? 'adm-spin' : undefined} aria-hidden="true" />
              <span>{meta.refreshing ? 'Refreshing' : 'Refresh'}</span>
            </button>
          </>
        }
      />

      {/* One shared banner, fed by the boot fetchers and every tab that pages
          server-side. The old build set this state and rendered it nowhere. */}
      {meta.error && (
        <div className="adm-error" role="alert">
          <AlertTriangle size={17} aria-hidden="true" />
          <span className="adm-error__text">{meta.error}</span>
          <button type="button" className="adm-error__btn" onClick={meta.refreshAll}>Retry</button>
          <button type="button" className="adm-error__btn" onClick={() => meta.setError('')} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      )}

      <ModuleTabs
        tabs={tabs}
        activeId={activeResolved}
        onChange={setActiveTab}
        ariaLabel="Admin sections"
        panelIdPrefix="adm"
        moreLabel="More"
      />

      <Suspense fallback={<div className="adm-panel"><Skeletons count={6} /></div>}>
        {activeResolved === 'overview' && (
          <div className="adm-panel" role="tabpanel" id="adm-panel-overview" aria-labelledby="adm-tab-overview" tabIndex={-1}>
            <OverviewTab
              userStats={meta.userStats}
              deletionRequests={meta.deletionRequests}
              restoreRequests={meta.restoreRequests}
              signups={meta.signups}
              ticketsList={meta.ticketsList}
              emailsLoggedAll={meta.emailsLoggedAll}
              ready={meta.ready}
              onJump={jump}
              onOpenVerifiedMembers={openVerifiedMembers}
            />
          </div>
        )}
        {activeResolved === 'users' && (
          <div className="adm-panel" role="tabpanel" id="adm-panel-users" aria-labelledby="adm-tab-users" tabIndex={-1}>
            <MembersTab
              user={user}
              refreshKey={meta.refreshKey}
              initialStatus={memberStatusSeed}
              onStatusConsumed={consumeStatusSeed}
              onUserStats={meta.recordUserStats}
              onError={meta.reportError}
              confirm={showConfirm}
              alert={showAlert}
              prompt={showPrompt}
            />
          </div>
        )}
        {activeResolved === 'signups' && (
          <div className="adm-panel" role="tabpanel" id="adm-panel-signups" aria-labelledby="adm-tab-signups" tabIndex={-1}>
            <SignupsTab
              signups={meta.signups}
              signupsLoading={meta.signupsLoading}
              ready={meta.ready}
              fetchSignups={meta.fetchSignups}
              alert={showAlert}
              confirm={showConfirm}
            />
          </div>
        )}
        {activeResolved === 'privacy' && (
          <div className="adm-panel" role="tabpanel" id="adm-panel-privacy" aria-labelledby="adm-tab-privacy" tabIndex={-1}>
            <PrivacyTab
              deletionRequests={meta.deletionRequests}
              restoreRequests={meta.restoreRequests}
              recentlyDeleted={meta.recentlyDeleted}
              ready={meta.ready}
              fetchDeletionRequests={meta.fetchDeletionRequests}
              fetchRestoreRequests={meta.fetchRestoreRequests}
              fetchRecentlyDeleted={meta.fetchRecentlyDeleted}
              alert={showAlert}
            />
          </div>
        )}
        {activeResolved === 'tickets' && (
          <div className="adm-panel" role="tabpanel" id="adm-panel-tickets" aria-labelledby="adm-tab-tickets" tabIndex={-1}>
            <RequestsTab
              ticketsList={meta.ticketsList}
              ready={meta.ready}
              fetchTickets={meta.fetchTickets}
              alert={showAlert}
              prompt={showPrompt}
            />
          </div>
        )}
        {activeResolved === 'emails' && (
          <div className="adm-panel" role="tabpanel" id="adm-panel-emails" aria-labelledby="adm-tab-emails" tabIndex={-1}>
            <EmailsTab
              refreshKey={meta.refreshKey}
              onEmailsTotal={meta.recordEmailsTotal}
              onError={meta.reportError}
              alert={showAlert}
            />
          </div>
        )}
        {activeResolved === 'audit' && (
          <div className="adm-panel" role="tabpanel" id="adm-panel-audit" aria-labelledby="adm-tab-audit" tabIndex={-1}>
            <AuditTab refreshKey={meta.refreshKey} onError={meta.reportError} />
          </div>
        )}
        {activeResolved === 'limits' && (
          <div className="adm-panel" role="tabpanel" id="adm-panel-limits" aria-labelledby="adm-tab-limits" tabIndex={-1}>
            <LimitsTab refreshKey={meta.refreshKey} />
          </div>
        )}
      </Suspense>

      <PopupModal
        isOpen={popup.isOpen}
        onClose={() => setPopup((p) => ({ ...p, isOpen: false }))}
        title={popup.title}
        message={popup.message}
        onConfirm={popup.onConfirm}
        isAlert={popup.isAlert}
        isPrompt={popup.isPrompt}
        promptValue={popup.promptValue}
        onPromptChange={(val) => setPopup((p) => ({ ...p, promptValue: val }))}
      />
    </div>
  );
};

export default AdminPanel;