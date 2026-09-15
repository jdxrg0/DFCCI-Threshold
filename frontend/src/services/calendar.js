import api from '../api';

export const getCalendar = () =>
  api.get('/calendar').then(r => r.data);

export const saveDateRoles = (dateKey, data) =>
  api.put(`/calendar/${dateKey}`, data).then(r => r.data);

export const populateCalendar = (data) =>
  api.post('/calendar/populate', data).then(r => r.data);

export const clearCalendar = () =>
  api.delete('/calendar/clear').then(r => r.data);