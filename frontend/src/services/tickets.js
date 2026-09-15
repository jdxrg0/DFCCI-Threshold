import api from '../api';

export const listMyTickets = () =>
  api.get('/tickets/my-tickets').then(r => r.data);

export const getTicket = (id) =>
  api.get(`/tickets/${id}`).then(r => r.data);

export const createTicket = (data) =>
  api.post('/tickets', data).then(r => r.data);

export const updateTicketStatus = (id, status) =>
  api.patch(`/tickets/${id}/admin`, { status }).then(r => r.data);

export const postTicketResponse = (id, adminResponse) =>
  api.patch(`/tickets/${id}/admin`, { adminResponse }).then(r => r.data);
