import { api } from './client';

export interface Payment {
  id: string;
  tenantId?: string;
  payableType: string;
  payableId: string;
  gateway: string;
  gatewayTransactionId?: string;
  amount: string;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  createdAt: string;
}

export interface PaymentsRes { data: Payment[]; total: number }

export const fetchPayments = (params?: Record<string, string | number>) =>
  api.get<PaymentsRes>('/payments', { params });
