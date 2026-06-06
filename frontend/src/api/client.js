import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.response.use(
  r => r,
  err => {
    const publicPaths = ['/login', '/change-password'];
    const onPublicPage = publicPaths.some(p => window.location.pathname.startsWith(p));
    if (err.response?.status === 401 && !onPublicPage) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
