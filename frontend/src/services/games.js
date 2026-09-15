import api from '../api';

export const listQuizzes = (params) =>
  api.get('/games/quizzes', { params }).then(r => r.data);

export const getQuiz = (id, admin = false) =>
  api.get(`/games/quizzes/${id}`, { params: admin ? { admin: 'true' } : {} }).then(r => r.data);

export const createQuiz = (data) =>
  api.post('/games/quizzes', data).then(r => r.data);

export const updateQuiz = (id, data) =>
  api.put(`/games/quizzes/${id}`, data).then(r => r.data);

export const deleteQuiz = (id) =>
  api.delete(`/games/quizzes/${id}`).then(r => r.data);

export const submitQuiz = (id, data) =>
  api.post(`/games/quizzes/${id}/submit`, data).then(r => r.data);

export const getLeaderboard = (params) =>
  api.get('/games/leaderboard', { params }).then(r => r.data);

export const getMyGameStats = () =>
  api.get('/games/my-stats').then(r => r.data);