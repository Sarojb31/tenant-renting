import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Customer { id: string; phone?: string; email?: string; name?: string }

interface AuthState {
  token: string | null;
  customer: Customer | null;
  login: (token: string, customer: Customer) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      customer: null,
      login: (token, customer) => {
        localStorage.setItem('access_token', token);
        set({ token, customer });
      },
      logout: () => {
        localStorage.removeItem('access_token');
        set({ token: null, customer: null });
      },
    }),
    { name: 'auth' },
  ),
);
