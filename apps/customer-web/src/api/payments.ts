import { api } from './client';

export type PaymentGateway = 'stripe' | 'esewa' | 'khalti';

export interface PaymentIntentRes {
  paymentId: string;
  providerRef: string;
  clientSecret?: string;
  redirectUrl?: string;
}

export const createPaymentIntent = (bookingId: string, gateway: PaymentGateway) =>
  api.post<PaymentIntentRes>('/payments/intent', { bookingId, gateway });
