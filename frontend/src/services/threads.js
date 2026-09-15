import api from '../api';

// --- Thread list ---

export const listThreads = (type) =>
  api.get('/threads', { params: { type } }).then(r => r.data);

export const listArchivedThreads = () =>
  api.get('/threads/archive').then(r => r.data);

export const listRecentlyDeletedThreads = () =>
  api.get('/threads/recently-deleted').then(r => r.data);

// --- Single thread ---

export const getThread = (id) =>
  api.get(`/threads/${id}`).then(r => r.data);

export const createThread = (data) =>
  api.post('/threads', data).then(r => r.data);

// --- Thread actions ---

export const replyToThread = (id, content) =>
  api.post(`/threads/${id}/reply`, { content }).then(r => r.data);

export const resolveThread = (id) =>
  api.put(`/threads/${id}/resolve`).then(r => r.data);

export const acceptThread = (id) =>
  api.put(`/threads/${id}/accept`).then(r => r.data);

export const escalateThread = (id) =>
  api.post(`/threads/${id}/escalate`).then(r => r.data);

export const consentEscalation = (id, consent) =>
  api.put(`/threads/${id}/consent-escalation`, { consent }).then(r => r.data);

export const consentCounselor = (id, consent) =>
  api.put(`/threads/${id}/counselor-consent`, { consent }).then(r => r.data);

export const requestDeletion = (id) =>
  api.post(`/threads/${id}/request-deletion`).then(r => r.data);

export const requestRestore = (id) =>
  api.post(`/threads/${id}/request-restore`).then(r => r.data);

// --- Counselor access ---

export const getCounselorThreads = () =>
  api.get('/counselor/threads').then(r => r.data);

export const getCounselorThread = (id) =>
  api.get(`/counselor/threads/${id}`).then(r => r.data);

export const requestCounselorAccess = (threadId) =>
  api.post(`/counselor/threads/${threadId}/request-access`).then(r => r.data);

// --- Admin thread moderation ---

export const approveDeletion = (id) =>
  api.put(`/threads/admin/${id}/approve-deletion`).then(r => r.data);

export const rejectDeletion = (id) =>
  api.put(`/threads/admin/${id}/reject-deletion`).then(r => r.data);

export const approveRestore = (id) =>
  api.put(`/threads/admin/${id}/approve-restore`).then(r => r.data);

export const rejectRestore = (id) =>
  api.put(`/threads/admin/${id}/reject-restore`).then(r => r.data);
