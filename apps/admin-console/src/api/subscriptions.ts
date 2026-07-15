import { api } from './client';

export interface SubscriptionPlan {
  id: string;
  name: string;
  maxListings: number | null;
  maxStaffUsers: number | null;
  smsCreditsIncluded: number;
  priceMonthly: string;
  priceCurrency: string;
  features: Record<string, boolean>;
}

export interface TenantSubscription {
  id: string;
  tenantId: string;
  planId: string;
  plan: SubscriptionPlan;
  status: 'active' | 'past_due' | 'cancelled';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  smsCreditsRemaining: number;
}

export const fetchPlans = () => api.get<SubscriptionPlan[]>('/subscriptions/plans');
export const fetchCurrentSubscription = () => api.get<TenantSubscription>('/subscriptions/current');
export const subscribeToPlan = (planId: string) => api.post<TenantSubscription>('/subscriptions/subscribe', { planId });
export const cancelSubscription = () => api.delete<TenantSubscription>('/subscriptions/cancel');
