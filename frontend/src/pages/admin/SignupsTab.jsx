/* ── Admin — Signups ─────────────────────────────────────────────────────
   The pending-registration queue: rows appear while someone sits between the
   registration form and the code emailed to them, and self-destruct after 15
   minutes. Mutations (resend / delete) refetch the shared list through the
   hook's fetcher so the badge count stays honest. */

import { useState } from 'react';
import * as users from '../../services/users';
import { EmptyState, Skeletons } from './shared';
import { makeMutate, minutesUntil, sinceLabel, stamp } from './utils';
import { AlertTriangle, Clock, RefreshCw, Trash2, UserPlus } from 'lucide-react';

const SignupsTab = ({ signups, signupsLoading, ready, fetchSignups, alert, confirm }) => {
  const [signupBusyId, setSignupBusyId] = useState(null);
  const mutate = makeMutate(alert);

  // Expired rows are already dead weight, so the meta area only counts the
  // signups an admin can still rescue with a resend.
  const liveSignups = signups.filter((s) => !s.expired).length;

  const handleResendSignup = async (signup) => {
    setSignupBusyId(signup._id);
    try {
      const data = await users.resendSignupOtp(signup._id);
      await fetchSignups();
      alert('Code sent', data.message);
    } catch (err) {
      alert('Error', err.response?.data?.message || 'Failed to resend the signup code');
    } finally {
      setSignupBusyId(null);
    }
  };

  const handleDeleteSignup = (signup) =>
    confirm(
      'Delete signup',
      `Drop the unfinished signup for ${signup.email}? They would have to start registration again.`,
      () => mutate(
        () => users.deletePendingSignup(signup._id),
        fetchSignups,
        'Failed to delete the signup',
      ),
    );

  // Before the parallel boot finishes there is no shape of the queue to draw,
  // so hold the skeleton rather than flashing the empty state.
  if (!ready) return <Skeletons count={3} />;

  if (!signups.length) {
    return (
      <EmptyState
        icon={UserPlus}
        title="Nobody is mid-signup"
        text="A row appears here only while someone sits between the registration form and the code emailed to them. Unfinished signups self-destruct 15 minutes after they start, so an empty list is the normal state."
      />
    );
  }

  return (
    <>
      <div className="adm-toolbar">
        <span className="adm-toolbar__meta">
          {liveSignups} awaiting a code · {signups.length} in the queue
        </span>
        <span className="adm-toolbar__spacer" />
        <button type="button" className="adm-ghost-btn" onClick={fetchSignups} disabled={signupsLoading}>
          <RefreshCw size={13} className={signupsLoading ? 'adm-spin' : undefined} /> Refresh
        </button>
      </div>

      <div className={signupsLoading ? 'adm-cards adm-stale' : 'adm-cards'}>
        {signups.map((signup) => {
          const minutes = minutesUntil(signup.otpExpires);
          const tone = signup.expired ? 'danger' : 'warn';
          return (
            <div key={signup._id} className="adm-card" data-tone={tone}>
              <div className="adm-card__head">
                <div className="adm-ident__text">
                  <span className="adm-ident__name">{signup.displayName || 'Unnamed'}</span>
                  <span className="adm-ident__mail">{signup.email}</span>
                </div>
                <span className="adm-chip" data-tone={tone}>
                  {signup.expired ? <AlertTriangle size={11} /> : <Clock size={11} />}
                  {signup.expired ? 'Code expired' : `${minutes} min left`}
                </span>
              </div>

              <div className="adm-rule" />

              <div className="adm-card__head">
                <span className="adm-card__stamp">Started {sinceLabel(signup.createdAt)}</span>
                <span className="adm-card__stamp">{stamp(signup.createdAt)}</span>
              </div>

              <div className="adm-card__foot">
                <button
                  type="button"
                  className="adm-ghost-btn"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => handleResendSignup(signup)}
                  disabled={signupBusyId === signup._id}
                >
                  <RefreshCw size={13} className={signupBusyId === signup._id ? 'adm-spin' : undefined} />
                  {signupBusyId === signup._id ? 'Sending' : 'Resend code'}
                </button>
                <button
                  type="button"
                  className="adm-icon-btn"
                  data-tone="danger"
                  onClick={() => handleDeleteSignup(signup)}
                  aria-label={`Delete the signup for ${signup.email}`}
                  title={`Delete the signup for ${signup.email}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default SignupsTab;