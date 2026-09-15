import api from '../api';

export const listResources = () =>
  api.get('/resources').then(r => r.data);

export const getResource = (id) =>
  api.get(`/resources/${id}`).then(r => r.data);

export const createResource = (formData) =>
  api.post('/resources', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);

export const updateResource = (id, formData) =>
  api.put(`/resources/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);

export const deleteResource = (id) =>
  api.delete(`/resources/${id}`).then(r => r.data);