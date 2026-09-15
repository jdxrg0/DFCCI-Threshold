import api from '../api';

export const getWeeklyCode = () =>
  api.get('/settings/weekly-code').then(r => r.data);

export const saveWeeklyCode = (data) =>
  api.put('/settings/weekly-code', data).then(r => r.data);