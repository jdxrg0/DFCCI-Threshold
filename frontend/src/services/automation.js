import api from '../api';

// --- Schedules ---

export const listSchedules = () =>
  api.get('/automation/schedules').then(r => r.data);

export const getSchedule = (id) =>
  api.get(`/automation/schedule/${id}`).then(r => r.data);

export const createSchedule = (data) =>
  api.post('/automation/schedule', data).then(r => r.data);

export const updateSchedule = (id, data) =>
  api.put(`/automation/schedule/${id}`, data).then(r => r.data);

export const deleteSchedule = (id) =>
  api.delete(`/automation/schedule/${id}`).then(r => r.data);

export const toggleScheduleActive = (id, isActive) =>
  api.patch(`/automation/schedule/${id}/active`, { isActive }).then(r => r.data);

export const runSchedule = (id, dryRun = false, actionType = 'MAIN') =>
  api.post(`/automation/schedule/${id}/run`, { dryRun, actionType }).then(r => r.data);

export const duplicateSchedule = (id) =>
  api.post(`/automation/schedule/${id}/duplicate`).then(r => r.data);

// --- Schedule details ---

export const getScheduleRuns = (id, params) =>
  api.get(`/automation/schedule/${id}/runs`, { params }).then(r => r.data);

export const getScheduleConfirmations = (id, params) =>
  api.get(`/automation/schedule/${id}/confirmations`, { params }).then(r => r.data);

export const editQueueItem = (scheduleId, queueItem) =>
  api.patch(`/automation/schedule/${scheduleId}/queue`, queueItem).then(r => r.data);

export const editRoleReminders = (scheduleId, data) =>
  api.put(`/automation/schedule/${scheduleId}`, data).then(r => r.data);

// --- Health ---

export const getAutomationHealth = () =>
  api.get('/automation/health').then(r => r.data);