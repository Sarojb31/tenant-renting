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

export interface CreateCustomerDto {
  phone: string;
  name?: string;
  email?: string;
  smsOptIn?: boolean;
}

export const createCustomer = (body: CreateCustomerDto) =>
  api.post<Customer>('/customers', body);

export interface CustomerImage {
  id: string;
  customerId: string;
  url: string;
  type: string;
  sortOrder: number;
  createdAt: string;
}

export const fetchCustomerImages = (customerId: string) =>
  api.get<CustomerImage[]>(`/customers/${customerId}/images`);

export const uploadCustomerImages = (customerId: string, files: File[], type = 'other') => {
  const form = new FormData();
  files.forEach((f) => form.append('images', f));
  return api.post<CustomerImage[]>(`/customers/${customerId}/images?type=${encodeURIComponent(type)}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
