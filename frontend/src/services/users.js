import api from '../api';

// --- Member directory ---

export const listMembers = (params) =>
  api.get('/members', { params }).then(r => r.data);

export const createMember = (data) =>
  api.post('/members', data).then(r => r.data);

export const updateMember = (id, data) =>
  api.put(`/members/${id}`, data).then(r => r.data);

export const deleteMember = (id) =>
  api.delete(`/members/${id}`).then(r => r.data);

// --- User list (for pickers) ---

export const getVerifiedMembers = () =>
  api.get('/users/members').then(r => r.data);

export const searchUsers = (q) =>
  api.get('/users/search', { params: { q } }).then(r => r.data);

// --- Dashboard ---

export const getDashboardStats = () =>
  api.get('/users/me/dashboard-stats').then(r => r.data);

// --- Admin user management ---

export const listUsers = (params) =>
  api.get('/users', { params }).then(r => r.data);

export const getPendingSignups = () =>
  api.get('/users/admin/pending-signups').then(r => r.data);

export const resendSignupOtp = (id) =>
  api.post(`/users/admin/pending-signups/${id}/resend`).then(r => r.data);

export const deletePendingSignup = (id) =>
  api.delete(`/users/admin/pending-signups/${id}`).then(r => r.data);

export const getAuditLog = (params) =>
  api.get('/users/admin/audit', { params }).then(r => r.data);

export const getPlatformLimits = () =>
  api.get('/users/admin/platform-limits').then(r => r.data);

export const getPlatformHistory = (params) =>
  api.get('/users/admin/platform-history', { params }).then(r => r.data);

export const setUserRole = (id, role) =>
  api.put(`/users/${id}/role`, { role }).then(r => r.data);

export const toggleReminders = (id) =>
  api.put(`/users/${id}/toggle-reminders`).then(r => r.data);

export const requestNameChange = (id) =>
  api.put(`/users/${id}/request-name-change`).then(r => r.data);

export const setCustomDatePower = (id, data) =>
  api.put(`/users/${id}/custom-date-power`, data).then(r => r.data);

export const verifyUser = (id, data) =>
  api.put(`/users/${id}/verify`, data).then(r => r.data);

export const resendUserOtp = (id) =>
  api.post(`/users/${id}/resend-otp`).then(r => r.data);

export const deleteUser = (id) =>
  api.delete(`/users/${id}`).then(r => r.data);

// --- Bulk operations ---

export const bulkRoleChange = (ids, role) =>
  api.patch('/users/bulk/role', { ids, role }).then(r => r.data);

export const bulkToggleReminders = (ids, subscribed) =>
  api.patch('/users/bulk/reminders', { ids, subscribed }).then(r => r.data);

export const bulkVerify = (ids, isVerified) =>
  api.patch('/users/bulk/verify', { ids, isVerified }).then(r => r.data);

export const bulkDelete = (ids) =>
  api.post('/users/bulk/delete', { ids }).then(r => r.data);
