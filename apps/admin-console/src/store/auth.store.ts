import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AdminUser } from '../api/auth';

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  login: (token: string, user: AdminUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: (token, user) => {
        localStorage.setItem('admin_access_token', token);
        set({ token, user });
      },
      logout: () => {
        localStorage.removeItem('admin_access_token');
        set({ token: null, user: null });
      },
    }),
    { name: 'admin-auth' },
  ),
);
