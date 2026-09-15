import api from '../api';

export const listVideos = () =>
  api.get('/bible-videos').then(r => r.data);

export const likeVideo = (id) =>
  api.post(`/bible-videos/${id}/like`).then(r => r.data);

export const deleteVideo = (id) =>
  api.delete(`/bible-videos/${id}`).then(r => r.data);

export const uploadVideo = (formData) =>
  api.post('/bible-videos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
