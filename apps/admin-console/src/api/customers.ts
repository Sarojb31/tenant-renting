import { api } from './client';

export interface Customer {
  id: string;
  tenantId: string;
  phone: string;
  name?: string;
  email?: string;
  smsOptIn: boolean;
  createdAt: string;
}

export interface CustomersRes { data: Customer[]; total: number }

export const fetchCustomers = (params?: Record<string, string | number>) =>
  api.get<CustomersRes>('/customers', { params });

export const fetchCustomer = (id: string) => api.get<Customer>(`/customers/${id}`);
