import { api } from './client';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'staff' | 'agent';
  status: 'active' | 'invited' | 'disabled';
  createdAt: string;
  lastLoginAt: string | null;
}

export interface InviteUserBody {
  name: string;
  email: string;
  role: 'staff' | 'agent';
  password: string;
}

export const fetchUsers = () => api.get<StaffUser[]>('/users');

export const inviteUser = (body: InviteUserBody) => api.post<StaffUser>('/users/invite', body);

export const setUserStatus = (id: string, status: 'active' | 'disabled') =>
  api.patch<StaffUser>(`/users/${id}/status`, { status });
