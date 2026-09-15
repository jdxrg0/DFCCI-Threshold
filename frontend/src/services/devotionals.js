import api from '../api';

// --- Devotionals ---

export const listDevotionals = (params) =>
  api.get('/devotionals', { params }).then(r => r.data);

export const getDevotional = (id) =>
  api.get(`/devotionals/${id}`).then(r => r.data);

export const submitDevotional = (data) =>
  api.post('/devotionals', data).then(r => r.data);

export const editDevotional = (id, data) =>
  api.put(`/devotionals/${id}`, data).then(r => r.data);

export const deleteDevotional = (id) =>
  api.delete(`/devotionals/${id}`).then(r => r.data);

export const acknowledgeDevotional = (id, data) =>
  api.put(`/devotionals/${id}/acknowledge`, data).then(r => r.data);

export const checkDevotionalGap = (date) =>
  api.get('/devotionals/check-gap', { params: { date } }).then(r => r.data);

export const markMissed = (data) =>
  api.post('/devotionals/missed', data).then(r => r.data);

// --- Calendar ---

export const getDevotionalCalendar = (params) =>
  api.get('/devotionals/calendar', { params }).then(r => r.data);

// --- Stats ---

export const getDevotionalStats = () =>
  api.get('/devotionals/stats').then(r => r.data);

export const getBibleProgress = (memberId) =>
  api.get('/devotionals/bible-progress/all', { params: { memberId } }).then(r => r.data);

// --- Leader views ---

export const getLeaderDevotionals = (params) =>
  api.get('/devotionals/leader/all', { params }).then(r => r.data);

export const getLeaderStats = () =>
  api.get('/devotionals/leader/stats').then(r => r.data);

export const getLeaderFolders = () =>
  api.get('/devotionals/leader/folders').then(r => r.data);
