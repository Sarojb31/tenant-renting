import { api } from './client';

export interface TenantAnalytics {
  listings: { total: number; published: number; draft: number; archived: number };
  customers: { total: number };
  bookings: { total: number; pending: number; confirmed: number };
  revenue: { total: string; currency: string };
  sms: { sent: number; failed: number; creditsRemaining: number };
}

export interface PlatformAnalytics {
  tenants: { total: number; active: number };
  listings: { total: number; published: number };
  customers: { total: number };
  sms: { totalSent: number };
}

export const fetchTenantAnalytics = () =>
  api.get<TenantAnalytics>('/analytics/overview');

export const fetchPlatformAnalytics = () =>
  api.get<PlatformAnalytics>('/analytics/platform');
