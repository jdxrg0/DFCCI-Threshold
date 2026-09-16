/* ── Admin — Audit ───────────────────────────────────────────────────────
   The admin action feed. Server-paged, -searched and -filtered by action and
   date range; the before/after JSON blobs sit behind an expander per row
   rather than flexed into the table. */

import { Fragment, useCallback, useEffect, useState } from 'react';
import * as users from '../../services/users';
import { useLanguage } from '../../context/LanguageContext';
import { EmptyState, Pager, Skeletons } from './shared';
import { AUDIT_PER_PAGE, auditLabel, auditTone, stamp } from './utils';
import { ChevronDown, ScrollText, Search, X } from 'lucide-react';

const AuditTab = ({ refreshKey, onError }) => {
  const { t } = useLanguage();

  const [auditEntries, setAuditEntries] = useState([]);
  const [auditActions, setAuditActions] = useState([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditOpen, setAuditOpen] = useState(null);

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const data = await users.getAuditLog({
        page: auditPage, limit: AUDIT_PER_PAGE, search: auditSearch,
        action: auditAction, from: auditFrom, to: auditTo,
      });
      setAuditEntries(data.entries || []);
      setAuditTotalPages(data.totalPages || 1);
      setAuditTotalCount(data.totalCount || 0);
      // Comes from what is actually stored, so the dropdown can never offer a
      // filter that only ever returns an empty page.
      setAuditActions(data.actions || []);
      onError('');
    } catch (err) {
      onError(`Could not load the audit log. ${err.response?.data?.message || err.message || ''}`.trim());
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage, auditSearch, auditAction, auditFrom, auditTo, onError]);

  useEffect(() => {
    const id = setTimeout(fetchAudit, 280);
    return () => clearTimeout(id);
  }, [fetchAudit, refreshKey]);

  // before/after are arbitrary JSON blobs. They go behind an expander rather
  // than into the table, which is the difference between a readable feed and
  // a dump.
  const auditDataOf = (entry) => (
    <div className="adm-diff">
      {entry.before && (
        <div className="adm-diff__side">
          <span className="adm-diff__label">Before</span>
          <pre className="adm-pre">{JSON.stringify(entry.before, null, 2)}</pre>
        </div>
      )}
      {entry.after && (
        <div className="adm-diff__side">
          <span className="adm-diff__label">After</span>
          <pre className="adm-pre">{JSON.stringify(entry.after, null, 2)}</pre>
        </div>
      )}
      {entry.ip && <span className="adm-card__stamp">Recorded from {entry.ip}</span>}
    </div>
  );

  const auditToggleOf = (entry, idPrefix, openLabel) => {
    const open = auditOpen === entry._id;
    return (
      <button
        type="button"
        className="adm-expand"
        aria-expanded={open}
        aria-controls={`${idPrefix}${entry._id}`}
        onClick={() => setAuditOpen(open ? null : entry._id)}
      >
        <ChevronDown
          size={13}
          className={open ? 'adm-expand__caret adm-expand__caret--open' : 'adm-expand__caret'}
          aria-hidden="true"
        />
        {open ? 'Hide data' : openLabel}
      </button>
    );
  };

  return (
    <>
      <div className="adm-toolbar">
        <div className="adm-search">
          <Search size={15} className="adm-search__icon" aria-hidden="true" />
          <input
            className="adm-field"
            type="search"
            value={auditSearch}
            onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }}
            placeholder="Search summary, actor or target…"
            aria-label="Search the audit log"
          />
          {auditSearch && (
            <button
              type="button"
              className="adm-search__clear"
              onClick={() => { setAuditSearch(''); setAuditPage(1); }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Built from the response's own `actions`, never a hard-coded list — a
            filter this page invented could only ever return an empty page. */}
        <select
          className="adm-field adm-field--auto"
          value={auditAction}
          onChange={(e) => { setAuditAction(e.target.value); setAuditPage(1); }}
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          {auditActions.map((action) => (
            <option key={action} value={action}>{auditLabel(action)}</option>
          ))}
        </select>

        <div className="adm-dates">
          <label className="adm-dates__field">
            <span className="adm-dates__label">From</span>
            <input
              type="date"
              className="adm-field"
              value={auditFrom}
              max={auditTo || undefined}
              onChange={(e) => { setAuditFrom(e.target.value); setAuditPage(1); }}
            />
          </label>
          <label className="adm-dates__field">
            <span className="adm-dates__label">To</span>
            <input
              type="date"
              className="adm-field"
              value={auditTo}
              min={auditFrom || undefined}
              onChange={(e) => { setAuditTo(e.target.value); setAuditPage(1); }}
            />
          </label>
        </div>

        <span className="adm-toolbar__meta">
          {auditLoading ? 'Loading…' : `${auditTotalCount} entries`}
        </span>
      </div>

      {auditEntries.length === 0 ? (
        auditLoading ? <Skeletons count={6} /> : (
          <EmptyState
            icon={ScrollText}
            title="No admin actions recorded yet."
            text="Every role change, verification, deletion and approval an administrator makes is written here and kept for a year."
          />
        )
      ) : (
        <div className={auditLoading ? 'adm-stale' : undefined} aria-busy={auditLoading || undefined}>
          <div className="adm-table-wrap adm-desk">
            <div className="adm-table-scroll">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Action</th>
                    <th scope="col">Target</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map((entry) => {
                    const hasData = !!(entry.before || entry.after);
                    const open = auditOpen === entry._id;
                    return (
                      <Fragment key={entry._id}>
                        <tr>
                          <td className="adm-td-dim">{stamp(entry.createdAt)}</td>
                          <td>
                            <div className="adm-ident__text">
                              <span className="adm-ident__name">{entry.actorName || 'Unknown'}</span>
                              <span className="adm-ident__mail">{entry.actorEmail || '—'}</span>
                            </div>
                          </td>
                          <td>
                            <span className="adm-chip" data-tone={auditTone(entry.action)}>
                              {auditLabel(entry.action)}
                            </span>
                          </td>
                          <td className="adm-td-dim">{entry.targetLabel || '—'}</td>
                          <td>
                            <div className="adm-audit__cell">
                              <span className="adm-audit__summary">{entry.summary}</span>
                              {hasData && auditToggleOf(entry, 'adm-audit-', 'Data')}
                            </div>
                          </td>
                        </tr>
                        {hasData && open && (
                          <tr id={`adm-audit-${entry._id}`}>
                            <td colSpan={5}>{auditDataOf(entry)}</td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="adm-cards adm-cards--single adm-mob">
            {auditEntries.map((entry) => {
              const hasData = !!(entry.before || entry.after);
              const open = auditOpen === entry._id;
              return (
                <div key={entry._id} className="adm-card">
                  <div className="adm-card__head">
                    <span className="adm-chip" data-tone={auditTone(entry.action)}>
                      {auditLabel(entry.action)}
                    </span>
                    <span className="adm-card__stamp">{stamp(entry.createdAt)}</span>
                  </div>
                  <p className="adm-card__body">{entry.summary}</p>
                  <div className="adm-card__head">
                    <span className="adm-ident__mail">{entry.actorName || 'Unknown'}</span>
                    <span className="adm-card__stamp">{entry.targetLabel || '—'}</span>
                  </div>
                  {hasData && (
                    <>
                      {auditToggleOf(entry, 'adm-audit-m-', 'Show data')}
                      {open && <div id={`adm-audit-m-${entry._id}`}>{auditDataOf(entry)}</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Pager
        page={auditPage}
        totalPages={auditTotalPages}
        onChange={setAuditPage}
        label={{ previous: t('previous'), next: t('next'), of: t('page_of')(auditPage, auditTotalPages) }}
      />
    </>
  );
};

export default AuditTab;