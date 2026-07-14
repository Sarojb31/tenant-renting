import { api } from './client';

export interface OtpRequestRes { message: string }
export interface OtpVerifyRes {
  accessToken: string;
  customer: { id: string; phone: string; name?: string };
}
export interface CustomerEmailLoginRes {
  accessToken: string;
  customer: { id: string; email: string; name?: string };
}

export const requestOtp = (phone: string) =>
  api.post<OtpRequestRes>('/auth/otp/request', { phone });

export const verifyOtp = (phone: string, code: string) =>
  api.post<OtpVerifyRes>('/auth/otp/verify', { phone, code });

export const customerEmailLogin = (email: string, password: string) =>
  api.post<CustomerEmailLoginRes>('/auth/customer/email-login', { email, password });
