import api from '../api';

export const listAffirmations = (params) =>
  api.get('/affirmations', { params }).then(r => r.data);

export const getAffirmation = (id) =>
  api.get(`/affirmations/${id}`).then(r => r.data);

export const sendAffirmation = (data) =>
  api.post('/affirmations', data).then(r => r.data);

export const replyToAffirmation = (id, data) =>
  api.post(`/affirmations/${id}/reply`, data).then(r => r.data);

export const markAffirmationReceived = (id) =>
  api.put(`/affirmations/${id}/receive`).then(r => r.data);
