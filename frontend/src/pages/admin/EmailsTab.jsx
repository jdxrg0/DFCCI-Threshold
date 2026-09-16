/* ── Admin — Emails ──────────────────────────────────────────────────────
   The outgoing email log. Throws open the monolith's drawer next to the
   rows that summon it (its Esc/scroll-lock effect moved with it), resends
   failures, and reports the unfiltered total up to the Overview KPI. */

import { useCallback, useEffect, useState } from 'react';
import * as emailsApi from '../../services/emails';
import { useLanguage } from '../../context/LanguageContext';
import { EmptyState, Pager, Skeletons } from './shared';
import { EMAILS_PER_PAGE } from './utils';
import { Eye, Mail, RefreshCw, Search, X } from 'lucide-react';

const EmailsTab = ({ refreshKey, onEmailsTotal, onError, alert }) => {
  const { t } = useLanguage();

  const [emails, setEmails] = useState([]);
  const [emailsSearch, setEmailsSearch] = useState('');
  const [emailsStatus, setEmailsStatus] = useState('');
  const [emailsPage, setEmailsPage] = useState(1);
  const [emailsTotalPages, setEmailsTotalPages] = useState(1);
  const [emailsTotalCount, setEmailsTotalCount] = useState(0);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null);
  const [resendingId, setResendingId] = useState(null);

  const fetchEmails = useCallback(async () => {
    setEmailsLoading(true);
    try {
      const data = await emailsApi.listEmails({ page: emailsPage, limit: EMAILS_PER_PAGE, search: emailsSearch, status: emailsStatus });
      setEmails(data.emails || []);
      setEmailsTotalPages(data.totalPages || 1);
      setEmailsTotalCount(data.totalCount || 0);
      // Keep an unfiltered total for the Overview KPI, so filtering the log
      // does not make the headline number jump around.
      if (!emailsSearch && !emailsStatus) onEmailsTotal(data.totalCount || 0);
      onError('');
    } catch (err) {
      onError(`Could not load the email log. ${err.response?.data?.message || err.message || ''}`.trim());
    } finally {
      setEmailsLoading(false);
    }
  }, [emailsPage, emailsSearch, emailsStatus, onEmailsTotal, onError]);

  // Same debounce as the old page: one request per keystroke was too much.
  // `refreshKey` lets the global Refresh button re-run with the live filters.
  useEffect(() => {
    const id = setTimeout(fetchEmails, 280);
    return () => clearTimeout(id);
  }, [fetchEmails, refreshKey]);

  // ── Drawer behaviour (moved from the monolith with the preview itself) ──
  useEffect(() => {
    if (!emailPreview) return;
    const onKey = (e) => { if (e.key === 'Escape') setEmailPreview(null); };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [emailPreview]);

  const handleResendEmail = async (id) => {
    setResendingId(id);
    try {
      await emailsApi.resendEmail(id);
      alert('Success', t('email_resend_success'));
      fetchEmails();
    } catch (err) {
      alert('Error', err.response?.data?.message || t('email_resend_error'));
    } finally {
      setResendingId(null);
    }
  };

  return (
    <>
      <div className="adm-toolbar">
        <div className="adm-search">
          <Search size={15} className="adm-search__icon" aria-hidden="true" />
          <input
            className="adm-field"
            type="search"
            value={emailsSearch}
            onChange={(e) => { setEmailsSearch(e.target.value); setEmailsPage(1); }}
            placeholder={t('email_search_placeholder')}
            aria-label="Search the email log"
          />
          {emailsSearch && (
            <button
              type="button"
              className="adm-search__clear"
              onClick={() => { setEmailsSearch(''); setEmailsPage(1); }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="adm-field adm-field--auto"
          value={emailsStatus}
          onChange={(e) => { setEmailsStatus(e.target.value); setEmailsPage(1); }}
          aria-label="Filter by delivery status"
        >
          <option value="">{t('email_all_statuses')}</option>
          <option value="sent">{t('email_status_sent')}</option>
          <option value="failed">{t('email_status_failed')}</option>
        </select>

        <span className="adm-toolbar__meta">
          {emailsLoading ? 'Loading…' : `${emailsTotalCount} logged`}
        </span>
      </div>

      {emailsLoading && emails.length === 0 ? (
        <Skeletons count={5} />
      ) : emails.length === 0 ? (
        <EmptyState icon={Mail} title={t('email_no_logs')} text="Every outgoing notice, OTP and dues reminder is recorded here once sent." />
      ) : (
        <>
          <div className="adm-table-wrap adm-desk">
            <div className="adm-table-scroll">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th scope="col">{t('email_to')}</th>
                    <th scope="col">{t('email_subject')}</th>
                    <th scope="col">{t('email_sent_at')}</th>
                    <th scope="col">{t('email_status')}</th>
                    <th scope="col" className="adm-td-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((mail) => (
                    <tr key={mail._id}>
                      <td style={{ fontWeight: 700 }}>{mail.to}</td>
                      <td style={{ fontWeight: 700 }}>{mail.subject}</td>
                      <td className="adm-td-dim">
                        {new Date(mail.sentAt).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td>
                        <span className="adm-chip" data-tone={mail.status === 'sent' ? 'ok' : 'danger'}>
                          {mail.status === 'sent' ? t('email_status_sent') : t('email_status_failed')}
                        </span>
                      </td>
                      <td className="adm-td-right">
                        <div className="adm-actions">
                          <button type="button" className="adm-ghost-btn" onClick={() => setEmailPreview(mail)}>
                            <Eye size={13} /> View
                          </button>
                          <button
                            type="button"
                            className="adm-ghost-btn"
                            onClick={() => handleResendEmail(mail._id)}
                            disabled={resendingId === mail._id}
                          >
                            <RefreshCw size={13} className={resendingId === mail._id ? 'adm-spin' : undefined} />
                            {resendingId === mail._id ? 'Resending' : 'Resend'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="adm-cards adm-cards--single adm-mob">
            {emails.map((mail) => (
              <div key={mail._id} className="adm-card">
                <div className="adm-card__head">
                  <span className="adm-ident__mail">To: {mail.to}</span>
                  <span className="adm-chip" data-tone={mail.status === 'sent' ? 'ok' : 'danger'}>
                    {mail.status === 'sent' ? 'Sent' : 'Failed'}
                  </span>
                </div>
                <div>
                  <h4 className="adm-card__title">{mail.subject}</h4>
                  <span className="adm-card__stamp">{new Date(mail.sentAt).toLocaleString()}</span>
                </div>
                <div className="adm-card__foot">
                  <button type="button" className="adm-ghost-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEmailPreview(mail)}>
                    <Eye size={13} /> View
                  </button>
                  <button
                    type="button"
                    className="adm-ghost-btn"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => handleResendEmail(mail._id)}
                    disabled={resendingId === mail._id}
                  >
                    <RefreshCw size={13} className={resendingId === mail._id ? 'adm-spin' : undefined} />
                    {resendingId === mail._id ? 'Resending' : 'Resend'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Pager
            page={emailsPage}
            totalPages={emailsTotalPages}
            onChange={setEmailsPage}
            label={{ previous: t('previous'), next: t('next'), of: t('page_of')(emailsPage, emailsTotalPages) }}
          />
        </>
      )}

      {/* Email preview drawer */}
      {emailPreview && (
        <div className="adm-drawer-backdrop" onClick={() => setEmailPreview(null)}>
          <div
            className="adm-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Email preview"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="adm-drawer__head">
              <h3 className="adm-drawer__title"><Mail size={19} /> Email preview</h3>
              <button
                type="button"
                className="adm-icon-btn"
                data-tone="muted"
                onClick={() => setEmailPreview(null)}
                aria-label="Close preview"
                autoFocus
              >
                <X size={15} />
              </button>
            </div>

            <div className="adm-drawer__meta">
              <div className="adm-drawer__row">
                <span className="adm-drawer__key">To</span>
                <span className="adm-drawer__val">{emailPreview.to}</span>
              </div>
              <div className="adm-drawer__row">
                <span className="adm-drawer__key">Subject</span>
                <span className="adm-drawer__val">{emailPreview.subject}</span>
              </div>
              <div className="adm-drawer__row">
                <span className="adm-drawer__key">Sent</span>
                <span className="adm-drawer__val">{new Date(emailPreview.sentAt).toLocaleString()}</span>
              </div>
              <div className="adm-drawer__row">
                <span className="adm-drawer__key">Status</span>
                <span className="adm-chip" data-tone={emailPreview.status === 'sent' ? 'ok' : 'danger'}>
                  {emailPreview.status === 'sent' ? 'Delivered' : 'Delivery failed'}
                </span>
              </div>
              {emailPreview.error && (
                <div className="adm-drawer__err"><strong>Error:</strong> {emailPreview.error}</div>
              )}
            </div>

            <div className="adm-drawer__body">
              <span className="adm-drawer__key">Body</span>
              <iframe
                className="adm-drawer__frame"
                srcDoc={emailPreview.html}
                title="Email body preview"
                sandbox=""
              />
            </div>

            <div className="adm-drawer__foot">
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => { handleResendEmail(emailPreview._id); setEmailPreview(null); }}
              >
                <RefreshCw size={15} /> Resend email
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setEmailPreview(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EmailsTab;