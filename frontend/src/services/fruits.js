import api from '../api';

export const getGivenFruits = (userId) =>
  api.get(`/fruits/given/${userId}`, { params: { t: Date.now() } }).then(r => r.data);

export const endorseFruits = (data) =>
  api.post('/fruits/endorse', data).then(r => r.data);

export const getMyFruits = () =>
  api.get('/fruits/me', { params: { t: Date.now() } }).then(r => r.data);
