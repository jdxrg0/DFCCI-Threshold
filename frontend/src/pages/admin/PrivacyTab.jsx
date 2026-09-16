/* ── Admin — Privacy ─────────────────────────────────────────────────────
   One tab for the three thread-privacy queues the monolith split across two:
   pending mirror deletions, pending restores and the retention archive. A
   segmented control (the same vocabulary automation.css uses) swaps between
   them, and every mutation refetches the shared lists so the badge stays
   honest. */

import { useEffect, useState } from 'react';
import * as threads from '../../services/threads';
import { EmptyState, Flow, Meter, Skeletons } from './shared';
import { RETENTION_DAYS, makeMutate, shortDate } from './utils';
import {
  CheckCircle, Clock, History, RefreshCw, RotateCcw, Trash2, X,
} from 'lucide-react';

const renderApprovals = (list, kind, handlers) => {
  const isDeletion = kind === 'deletion';
  if (!list.length) {
    return (
      <EmptyState
        icon={isDeletion ? Trash2 : RotateCcw}
        title={isDeletion ? 'No deletion requests' : 'No restore requests'}
        text={isDeletion
          ? 'Nothing is waiting for approval. Members ask here before a mirror thread is removed.'
          : 'Nothing is waiting to come back out of the archive.'}
      />
    );
  }
  return (
    <div className="adm-cards">
      {list.map((req) => (
        <div key={req._id} className="adm-card">
          <div className="adm-card__head">
            <span className="adm-chip" data-tone={isDeletion ? 'warn' : 'brand'}>
              {isDeletion ? 'Pending approval' : 'Restore pending'}
            </span>
            <span className="adm-card__stamp">
              {isDeletion ? shortDate(req.deletionRequestedAt) : 'Needs verification'}
            </span>
          </div>

          <Flow from={req.sender?.displayName} to={req.receiver?.displayName} />

          <div className="adm-card__foot">
            <button
              type="button"
              className={`btn ${isDeletion ? 'btn-success' : 'btn-primary'}`}
              style={{ flex: 1 }}
              onClick={() => (isDeletion ? handlers.approveDeletion(req._id) : handlers.approveRestore(req._id))}
            >
              {isDeletion ? <CheckCircle size={14} /> : <RotateCcw size={14} />}
              {isDeletion ? 'Approve' : 'Restore'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              style={{ flex: 1 }}
              onClick={() => (isDeletion ? handlers.rejectDeletion(req._id) : handlers.rejectRestore(req._id))}
            >
              <X size={14} /> {isDeletion ? 'Reject' : 'Dismiss'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const renderArchive = (recentlyDeleted) => {
  if (!recentlyDeleted.length) {
    return (
      <EmptyState
        icon={History}
        title="Archive is empty"
        text={`No deleted threads are being held. Approved deletions stay recoverable here for ${RETENTION_DAYS} days.`}
      />
    );
  }
  return (
    <div className="adm-cards">
      {recentlyDeleted.map((log) => {
        const deletedAt = new Date(log.deletedAt);
        const expiry = new Date(deletedAt.getTime() + RETENTION_DAYS * 86400000);
        const daysLeft = Math.max(0, Math.ceil((expiry - new Date()) / 86400000));
        const percentLeft = Math.max(0, Math.min(100, (daysLeft / RETENTION_DAYS) * 100));
        const tone = daysLeft < 15 ? 'var(--danger)' : daysLeft < 30 ? 'var(--warning)' : 'var(--success)';
        const toneName = daysLeft < 15 ? 'danger' : daysLeft < 30 ? 'warn' : 'ok';

        return (
          <div key={log._id} className="adm-card">
            <div className="adm-card__head">
              <span className="adm-chip" data-tone="muted">Archived log</span>
              <span className="adm-card__stamp">Deleted {shortDate(log.deletedAt)}</span>
            </div>

            <Flow from={log.sender?.displayName} to={log.receiver?.displayName} />

            <div className="adm-meter">
              <div className="adm-meter__row">
                <span className="adm-meter__label">Retention window</span>
                <span className="adm-meter__value" data-tone={toneName}>
                  <Clock size={11} style={{ verticalAlign: '-1px', marginRight: '0.2rem' }} />
                  {daysLeft} days left
                </span>
              </div>
              <Meter percent={percentLeft} tone={tone} />
              <div className="adm-meter__foot">
                <span>Purges {shortDate(expiry)}</span>
                <span>{RETENTION_DAYS}-day policy</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SHEETS = [
  { id: 'deletion', label: 'Deletion' },
  { id: 'restore', label: 'Restore' },
  { id: 'archive', label: 'Archive' },
];

const PrivacyTab = ({
  deletionRequests, restoreRequests, recentlyDeleted, ready,
  fetchDeletionRequests, fetchRestoreRequests, fetchRecentlyDeleted, alert,
}) => {
  const [sheet, setSheet] = useState('deletion');
  const mutate = makeMutate(alert);

  // The boots refetch everything; a revisit refreshes each queue.
  useEffect(() => {
    fetchDeletionRequests();
    fetchRestoreRequests();
    fetchRecentlyDeleted();
  }, [fetchDeletionRequests, fetchRestoreRequests, fetchRecentlyDeleted]);

  const refresh = () => {
    fetchDeletionRequests();
    fetchRestoreRequests();
    fetchRecentlyDeleted();
  };

  const handlers = {
    approveDeletion: (id) =>
      mutate(() => threads.approveDeletion(id), () =>
        Promise.all([fetchDeletionRequests(), fetchRecentlyDeleted()]), 'Failed to approve deletion'),
    rejectDeletion: (id) =>
      mutate(() => threads.rejectDeletion(id), fetchDeletionRequests, 'Failed to reject deletion'),
    approveRestore: (id) =>
      mutate(() => threads.approveRestore(id), () =>
        Promise.all([fetchRestoreRequests(), fetchRecentlyDeleted()]), 'Failed to approve restore'),
    rejectRestore: (id) =>
      mutate(() => threads.rejectRestore(id), fetchRestoreRequests, 'Failed to reject restore'),
  };

  if (!ready) return <Skeletons count={4} />;

  return (
    <>
      <div className="adm-toolbar">
        <div className="adm-segment" role="tablist" aria-label="Privacy records">
          {SHEETS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={sheet === id}
              className={`adm-segment__btn ${sheet === id ? 'is-active' : ''}`}
              onClick={() => setSheet(id)}
            >
              {label}
              <span className="adm-segment__count" data-tone={id === 'deletion' ? 'danger' : id === 'restore' ? 'warn' : undefined}>
                {id === 'deletion' ? deletionRequests.length : id === 'restore' ? restoreRequests.length : recentlyDeleted.length}
              </span>
            </button>
          ))}
        </div>

        <span className="adm-toolbar__spacer" />

        <button type="button" className="adm-ghost-btn" onClick={refresh}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {sheet === 'deletion' && renderApprovals(deletionRequests, 'deletion', handlers)}
      {sheet === 'restore' && renderApprovals(restoreRequests, 'restore', handlers)}
      {sheet === 'archive' && renderArchive(recentlyDeleted)}
    </>
  );
};

export default PrivacyTab;