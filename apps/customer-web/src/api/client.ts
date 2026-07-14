import axios from 'axios';

const tenantId = import.meta.env.VITE_TENANT_ID as string | undefined;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: {
    'Content-Type': 'application/json',
    ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
  },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(err);
  },
);
