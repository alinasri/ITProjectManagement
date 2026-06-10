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
  toggleActive: (id) => api.patch(`/users/${id}/toggle-active`),
};

export const personnel = {
  list: (section_id) => api.get('/personnel', { params: { section_id } }),
  create: (data) => api.post('/personnel', data),
  remove: (id) => api.delete(`/personnel/${id}`),
};

export const ongoingTasks = {
  list: (params) => api.get('/ongoing-tasks', { params }),
  create: (data) => api.post('/ongoing-tasks', data),
  update: (id, data) => api.put(`/ongoing-tasks/${id}`, data),
  remove: (id) => api.delete(`/ongoing-tasks/${id}`),
  getHistory: (id) => api.get(`/ongoing-tasks/${id}/history`),
  archive: (id, archive) => api.patch(`/ongoing-tasks/${id}/archive`, { archive }),
};

export const projects = {
  list: (params) => api.get('/projects', { params }),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  remove: (id) => api.delete(`/projects/${id}`),
  getHistory: (id) => api.get(`/projects/${id}/history`),
  archive: (id, archive) => api.patch(`/projects/${id}/archive`, { archive }),
};

export const customColumns = {
  list: (section_id) => api.get('/custom-columns', { params: { section_id } }),
  create: (data) => api.post('/custom-columns', data),
  remove: (id) => api.delete(`/custom-columns/${id}`),
};

export const purchases = {
  list: (params) => api.get('/purchases', { params }),
  create: (data) => api.post('/purchases', data),
  update: (id, data) => api.put(`/purchases/${id}`, data),
  remove: (id) => api.delete(`/purchases/${id}`),
  getHistory: (id) => api.get(`/purchases/${id}/history`),
  archive: (id, archive) => api.patch(`/purchases/${id}/archive`, { archive }),
};

export const tenders = {
  list: (params) => api.get('/tenders', { params }),
  create: (data) => api.post('/tenders', data),
  update: (id, data) => api.put(`/tenders/${id}`, data),
  remove: (id) => api.delete(`/tenders/${id}`),
  getHistory: (id) => api.get(`/tenders/${id}/history`),
  archive: (id, archive) => api.patch(`/tenders/${id}/archive`, { archive }),
};

export const report = {
  getToken:       ()      => api.get('/report/token'),
  regenerate:     ()      => api.post('/report/regenerate'),
  getPublic:      (token) => api.get(`/report/public/${token}`),
};

export const contracts = {
  list: (params) => api.get('/contracts', { params }),
  create: (data) => api.post('/contracts', data),
  update: (id, data) => api.put(`/contracts/${id}`, data),
  remove: (id) => api.delete(`/contracts/${id}`),
  getHistory: (id) => api.get(`/contracts/${id}/history`),
  archive: (id, archive) => api.patch(`/contracts/${id}/archive`, { archive }),
};
