import { api } from './client';

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: 'super_admin' | 'company_admin';
  tenantId?: string;
}

export interface LoginRes {
  accessToken: string;
  user: AdminUser;
}

export const login = (email: string, password: string) =>
  api.post<LoginRes>('/auth/login', { email, password });

export const logout = () => api.post('/auth/logout');
