/* ── Admin — Requests ────────────────────────────────────────────────────
   The system-request feed (bugs, feature ideas, questions). Status and reply
   mutations refetch the shared list through the hook's fetcher, and the
   open/in-progress tally doubles as the nav badge. */

import { useEffect, useState } from 'react';
import * as tickets from '../../services/tickets';
import { EmptyState, Skeletons } from './shared';
import { TICKET_TONE, makeMutate } from './utils';
import { CheckCircle, MessageSquare } from 'lucide-react';

const RequestsTab = ({ ticketsList, ready, fetchTickets, alert, prompt }) => {
  const [ticketStatus, setTicketStatus] = useState('');
  const mutate = makeMutate(alert);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const openTickets = ticketsList.filter((tk) => tk.status === 'open' || tk.status === 'in-progress').length;
  const visibleTickets = ticketStatus
    ? ticketsList.filter((tk) => tk.status === ticketStatus)
    : ticketsList;

  const handleUpdateTicketStatus = (id, status) =>
    mutate(() => tickets.updateTicketStatus(id, status), fetchTickets, 'Failed to update ticket');

  const handleAdminResponse = (ticket) => {
    prompt('Admin response', `Reply to "${ticket.title}":`, async (response) => {
      if (!response || !response.trim()) return;
      await mutate(
        () => tickets.postTicketResponse(ticket._id, response.trim()),
        fetchTickets,
        'Failed to update response',
      );
    });
  };

  if (!ready) return <Skeletons count={4} />;

  return (
    <>
      <div className="adm-toolbar">
        <select
          className="adm-field adm-field--auto"
          value={ticketStatus}
          onChange={(e) => setTicketStatus(e.target.value)}
          aria-label="Filter requests by status"
        >
          <option value="">All requests</option>
          <option value="open">Open</option>
          <option value="in-progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <span className="adm-toolbar__spacer" />
        <span className="adm-toolbar__meta">
          {openTickets} open · {ticketsList.length} total
        </span>
      </div>

      {visibleTickets.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No requests here"
          text="Nothing matches this filter. Members raise bugs, feature ideas and questions from the System Requests module."
        />
      ) : (
        <div className="adm-cards">
          {visibleTickets.map((ticket) => (
            <div key={ticket._id} className="adm-card">
              <div className="adm-card__head">
                <span className="adm-chip" data-tone={TICKET_TONE[ticket.type] || 'muted'}>{ticket.type}</span>
                <span className="adm-card__stamp">by {ticket.createdBy?.displayName || 'Member'}</span>
              </div>

              <div>
                <h4 className="adm-card__title">{ticket.title}</h4>
                <p className="adm-card__body" style={{ marginTop: '0.2rem' }}>{ticket.description}</p>
              </div>

              {ticket.adminResponse && (
                <div className="adm-quote">
                  <span className="adm-quote__who"><CheckCircle size={11} /> Admin response</span>
                  <p className="adm-quote__text">{ticket.adminResponse}</p>
                </div>
              )}

              <div className="adm-card__foot">
                <select
                  className="adm-field"
                  value={ticket.status}
                  onChange={(e) => handleUpdateTicketStatus(ticket._id, e.target.value)}
                  aria-label={`Status for ${ticket.title}`}
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <button type="button" className="adm-ghost-btn" onClick={() => handleAdminResponse(ticket)}>
                  <MessageSquare size={13} /> {ticket.adminResponse ? 'Edit reply' : 'Reply'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default RequestsTab;