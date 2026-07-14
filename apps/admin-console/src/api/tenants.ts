import { api } from './client';

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  country: string;
  defaultCurrency: string;
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  createdAt: string;
}

export interface TenantsRes { data: Tenant[]; total: number }

export const fetchTenants = (params?: Record<string, string | number>) =>
  api.get<TenantsRes>('/tenants', { params });

export const fetchTenant = (id: string) => api.get<Tenant>(`/tenants/${id}`);

export const updateTenant = (id: string, body: Partial<Tenant>) =>
  api.patch<Tenant>(`/tenants/${id}`, body);
