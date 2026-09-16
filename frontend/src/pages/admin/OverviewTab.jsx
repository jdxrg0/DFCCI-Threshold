/* ── Admin — Overview ────────────────────────────────────────────────────
   The control centre's first stop. Holds the KPI rail (moved out of the
   page chrome so the other seven tabs render without it) and an attention
   list drawn from the same queues the badges count — tapping any row jumps
   straight to the tab that resolves it. */

import {
  CheckCircle,
  ChevronRight,
  Mail,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  RotateCcw,
} from 'lucide-react';
import { memberCount } from './utils';

const OverviewTab = ({
  userStats, deletionRequests, restoreRequests, signups, ticketsList,
  emailsLoggedAll, ready, onJump, onOpenVerifiedMembers,
}) => {
  const pendingApprovals = deletionRequests.length + restoreRequests.length;
  const openTickets = ticketsList.filter((tk) => tk.status === 'open' || tk.status === 'in-progress').length;
  // Expired rows are already dead weight, so the count only shows the signups
  // an admin can still rescue with a resend.
  const liveSignups = signups.filter((s) => !s.expired).length;

  const stats = [
    { id: 'members', icon: Users, value: userStats.total, label: 'Members', tone: 'var(--primary)', jump: () => onJump('users') },
    { id: 'verified', icon: ShieldCheck, value: userStats.verified, label: 'Verified', tone: 'var(--success)', jump: onOpenVerifiedMembers },
    { id: 'approvals', icon: ShieldAlert, value: pendingApprovals, label: 'Pending Approvals', tone: 'var(--warning)', jump: () => onJump('privacy') },
    { id: 'requests', icon: MessageSquare, value: openTickets, label: 'Open Requests', tone: 'var(--tone-violet)', jump: () => onJump('tickets') },
    { id: 'emails', icon: Mail, value: emailsLoggedAll, label: 'Emails Logged', tone: 'var(--info)', jump: () => onJump('emails') },
  ];

  const attention = [];
  if (liveSignups > 0) attention.push({
    key: 'signups', icon: UserPlus, tone: 'warn',
    text: `${memberCount(liveSignups)} still waiting for their signup code`,
    jump: () => onJump('signups'),
  });
  if (deletionRequests.length > 0) attention.push({
    key: 'deletion', icon: Trash2, tone: 'danger',
    text: `${memberCount(deletionRequests.length)} mirror deletion${deletionRequests.length === 1 ? '' : 's'} awaiting approval`,
    jump: () => onJump('privacy'),
  });
  if (restoreRequests.length > 0) attention.push({
    key: 'restore', icon: RotateCcw, tone: 'warn',
    text: `${memberCount(restoreRequests.length)} thread restore${restoreRequests.length === 1 ? '' : 's'} to verify`,
    jump: () => onJump('privacy'),
  });
  if (openTickets > 0) attention.push({
    key: 'tickets', icon: MessageSquare, tone: 'violet',
    text: `${openTickets} open system request${openTickets === 1 ? '' : 's'}`,
    jump: () => onJump('tickets'),
  });

  return (
    <div className="adm-overview">
      <div className="adm-toolbar">
        <span className="adm-toolbar__meta">
          Everything the control centre manages, counted live.
        </span>
        <span className="adm-toolbar__spacer" />
        <span className="adm-card__stamp">Tap a tile to open its section</span>
      </div>

      <div className="adm-stats">
        {stats.map(({ id, icon: Icon, value, label, tone, jump }) => (
          <button
            key={id}
            type="button"
            className="adm-stat"
            style={{ '--tone': tone }}
            onClick={jump}
          >
            <span className="adm-stat__icon"><Icon size={19} aria-hidden="true" /></span>
            <span className="adm-stat__text">
              <span className="adm-stat__value">{ready ? value : '—'}</span>
              <span className="adm-stat__label">{label}</span>
            </span>
          </button>
        ))}
      </div>

      <h4 className="adm-overview__title">Needs attention</h4>

      {attention.length === 0 ? (
        <div className="adm-overview__calm">
          <CheckCircle size={30} aria-hidden="true" />
          <span>Nothing needs you right now — every queue is clear.</span>
        </div>
      ) : (
        <div className="adm-cards adm-overview__rows">
          {attention.map(({ key, icon: Icon, tone, text, jump }) => (
            <button
              key={key}
              type="button"
              className="adm-overview-row"
              data-tone={tone}
              onClick={jump}
            >
              <span className="adm-overview-row__icon"><Icon size={16} aria-hidden="true" /></span>
              <span className="adm-overview-row__text">{text}</span>
              <span className="adm-overview-row__count" data-tone={tone}>
                {tone === 'danger' || tone === 'warn' || tone === 'violet' ? 'Action' : ''}
              </span>
              <ChevronRight size={16} className="adm-overview-row__arrow" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default OverviewTab;