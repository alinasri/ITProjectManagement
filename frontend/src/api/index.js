import api from './client';

export const auth = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

export const sections = {
  list: () => api.get('/sections'),
  create: (data) => api.post('/sections', data),
  update: (id, data) => api.put(`/sections/${id}`, data),
  remove: (id) => api.delete(`/sections/${id}`),
};

export const users = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  remove: (id) => api.delete(`/users/${id}`),
};

export const personnel = {
  list: (section_id) => api.get('/personnel', { params: { section_id } }),
  create: (data) => api.post('/personnel', data),
  remove: (id) => api.delete(`/personnel/${id}`),
};

export const projects = {
  list: (section_id) => api.get('/projects', { params: { section_id } }),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  remove: (id) => api.delete(`/projects/${id}`),
};

export const customColumns = {
  list: (section_id) => api.get('/custom-columns', { params: { section_id } }),
  create: (data) => api.post('/custom-columns', data),
  remove: (id) => api.delete(`/custom-columns/${id}`),
};
