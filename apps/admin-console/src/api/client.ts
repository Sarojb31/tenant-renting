import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Token refresh with request queue ──────────────────────────────────────
let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function flushQueue(err: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => (token ? resolve(token) : reject(err)));
  pendingQueue = [];
}

function doLogout() {
  useAuthStore.getState().logout();
  window.location.replace('/login');
}

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const orig = err.config as typeof err.config & { _retry?: boolean };

    if (err.response?.status !== 401 || orig._retry) return Promise.reject(err);

    // Don't refresh on auth endpoints — they return 401 legitimately
    const url: string = orig.url ?? '';
    if (url.includes('/auth/refresh') || url.includes('/auth/login')) {
      doLogout();
      return Promise.reject(err);
    }

    // Queue requests while a refresh is already in flight
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        orig.headers.Authorization = `Bearer ${token}`;
        return api(orig);
      });
    }

    orig._retry = true;
    isRefreshing = true;

    try {
      const { data } = await api.post<{ accessToken: string }>('/auth/refresh');
      useAuthStore.getState().setToken(data.accessToken);
      flushQueue(null, data.accessToken);
      orig.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(orig);
    } catch (refreshErr) {
      flushQueue(refreshErr, null);
      doLogout();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);
