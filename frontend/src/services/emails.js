import api from '../api';

export const listEmails = (params) =>
  api.get('/emails', { params }).then(r => r.data);

export const resendEmail = (id) =>
  api.post(`/emails/${id}/resend`).then(r => r.data);