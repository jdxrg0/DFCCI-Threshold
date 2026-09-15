import api from '../api';

// --- Transactions ---

export const listTransactions = (params) =>
  api.get('/funds', { params }).then(r => r.data);

export const createTransaction = (data, config) =>
  api.post('/funds', data, config).then(r => r.data);

export const updateTransaction = (id, data, config) =>
  api.put(`/funds/${id}`, data, config).then(r => r.data);

export const deleteTransaction = (id) =>
  api.delete(`/funds/${id}`).then(r => r.data);

// --- Overview & export ---

export const getFundSummary = () =>
  api.get('/funds/summary').then(r => r.data);

export const getCategories = (params) =>
  api.get('/funds/categories', { params }).then(r => r.data);

export const renameCategory = (oldName, newName) =>
  api.patch('/funds/categories/rename', { oldName, newName }).then(r => r.data);

export const exportTransactions = (params) =>
  api.get('/funds/export', { params }).then(r => r.data);

export const getAnalytics = (params) =>
  api.get('/funds/analytics', { params }).then(r => r.data);

export const getFundAudit = (params) =>
  api.get('/funds/audit', { params }).then(r => r.data);

// --- Designated funds ---

export const listDesignatedFunds = () =>
  api.get('/funds/designated').then(r => r.data);

export const createDesignatedFund = (data) =>
  api.post('/funds/designated', data).then(r => r.data);

export const updateDesignatedFund = (id, data) =>
  api.put(`/funds/designated/${id}`, data).then(r => r.data);

export const deleteDesignatedFund = (id) =>
  api.delete(`/funds/designated/${id}`).then(r => r.data);

// --- Dues ---

export const getDuesLedger = () =>
  api.get('/funds/dues/ledger').then(r => r.data);

export const recordDuesPayment = (data) =>
  api.post('/funds/dues/ledger', data).then(r => r.data);

export const addDuesMember = (data) =>
  api.post('/funds/dues/members', data).then(r => r.data);

export const removeDuesMember = (id) =>
  api.delete(`/funds/dues/members/${id}`).then(r => r.data);

export const linkDuesMember = (id, userId) =>
  api.put(`/funds/dues/members/${id}/link-user`, { userId }).then(r => r.data);

export const previewDuesReminders = () =>
  api.get('/funds/dues/reminder-preview').then(r => r.data);

export const sendBatchReminders = (timing = 'Manual') =>
  api.post('/funds/dues/send-batch-reminders', { timing }).then(r => r.data);

export const sendDuesEmail = (id) =>
  api.post(`/funds/dues/members/${id}/send-dues-email`).then(r => r.data);