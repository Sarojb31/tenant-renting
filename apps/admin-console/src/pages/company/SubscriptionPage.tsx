import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { StatusBadge } from '../../components/StatusBadge';
import { fetchPlans, fetchCurrentSubscription, subscribeToPlan, cancelSubscription } from '../../api/subscriptions';

export function SubscriptionPage() {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);

  const { data: current, isLoading: subLoading } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: () => fetchCurrentSubscription().then((r) => r.data),
  });

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: () => fetchPlans().then((r) => r.data),
  });

  const subscribe = useMutation({
    mutationFn: (planId: string) => subscribeToPlan(planId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscription'] });
      setConfirming(null);
    },
  });

  const cancel = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['subscription'] }),
  });

  const PLAN_LABELS: Record<string, string> = {
    free_trial: 'Free Trial',
    basic: 'Basic',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };

  return (
    <Layout title="Subscription">
      <div className="space-y-6 max-w-3xl">
        {/* Current plan */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Current Plan</h2>
          {subLoading && <p className="text-gray-400 text-sm">Loading…</p>}
          {current && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {PLAN_LABELS[current.plan.name] ?? current.plan.name}
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  ${current.plan.priceMonthly} / month · {current.plan.priceCurrency}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <span className="text-gray-600">
                    <strong>{current.smsCreditsRemaining}</strong>
                    <span className="text-gray-400"> / {current.plan.smsCreditsIncluded} SMS credits</span>
                  </span>
                  <span className="text-gray-600">
                    <strong>{current.plan.maxListings ?? '∞'}</strong>
                    <span className="text-gray-400"> max listings</span>
                  </span>
                  <span className="text-gray-600">
                    <strong>{current.plan.maxStaffUsers ?? '∞'}</strong>
                    <span className="text-gray-400"> staff accounts</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={current.status} />
                {current.status === 'active' && (
                  <button
                    onClick={() => cancel.mutate()}
                    disabled={cancel.isPending}
                    className="text-xs text-red-500 hover:underline disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Plan picker */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Available Plans</h2>
          {plansLoading && <p className="text-gray-400 text-sm">Loading…</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(plans ?? []).map((plan) => {
              const isCurrent = current?.planId === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`border rounded-xl p-4 transition-colors ${
                    isCurrent ? 'border-brand-500 bg-brand-50' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-gray-900">{PLAN_LABELS[plan.name] ?? plan.name}</p>
                    {isCurrent && (
                      <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">Current</span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    ${plan.priceMonthly}
                    <span className="text-sm font-normal text-gray-400">/mo</span>
                  </p>
                  <ul className="mt-3 text-xs text-gray-600 space-y-1">
                    <li>{plan.maxListings ?? 'Unlimited'} listings</li>
                    <li>{plan.maxStaffUsers ?? 'Unlimited'} staff</li>
                    <li>{plan.smsCreditsIncluded} SMS credits/mo</li>
                    {plan.features?.analytics && <li>Analytics dashboard</li>}
                    {plan.features?.customBranding && <li>Custom branding</li>}
                    {plan.features?.apiAccess && <li>API access</li>}
                  </ul>
                  {!isCurrent && (
                    <div className="mt-4">
                      {confirming === plan.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => subscribe.mutate(plan.id)}
                            disabled={subscribe.isPending}
                            className="flex-1 text-xs bg-brand-600 text-white rounded-lg py-1.5 font-medium hover:bg-brand-700 disabled:opacity-50"
                          >
                            {subscribe.isPending ? 'Switching…' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setConfirming(null)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirming(plan.id)}
                          className="w-full text-xs border border-brand-200 text-brand-600 rounded-lg py-1.5 font-medium hover:bg-brand-50"
                        >
                          Switch to this plan
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
