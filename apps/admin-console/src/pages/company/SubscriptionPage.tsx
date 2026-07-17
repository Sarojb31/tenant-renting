import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { StatusBadge } from '../../components/StatusBadge';
import {
  fetchPlans,
  fetchCurrentSubscription,
  subscribeToPlan,
  cancelSubscription,
  createSubscriptionIntent,
  type SubscriptionPlan,
  type PaymentGateway,
} from '../../api/subscriptions';

const PLAN_LABELS: Record<string, string> = {
  free_trial: 'Free Trial',
  basic: 'Basic',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const GATEWAYS: { value: PaymentGateway; label: string }[] = [
  { value: 'esewa', label: 'eSewa' },
  { value: 'khalti', label: 'Khalti' },
  { value: 'stripe', label: 'Card (Stripe)' },
];

function isFree(plan: SubscriptionPlan) {
  return parseFloat(plan.priceMonthly) === 0;
}

export function SubscriptionPage() {
  const qc = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [gateway, setGateway] = useState<PaymentGateway>('esewa');
  const [error, setError] = useState('');

  const { data: current, isLoading: subLoading } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: () => fetchCurrentSubscription().then((r) => r.data),
  });

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: () => fetchPlans().then((r) => r.data),
  });

  // Free-plan switch: applies immediately
  const freeSwitchMutation = useMutation({
    mutationFn: (planId: string) => subscribeToPlan(planId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscription'] });
      setSelectedPlan(null);
      setError('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Switch failed.';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    },
  });

  // Paid plan switch: downgrade (schedules via pendingPlanId) or upgrade via payment intent
  const paidSwitchMutation = useMutation({
    mutationFn: ({ planId, gw }: { planId: string; gw: PaymentGateway }) =>
      createSubscriptionIntent(planId, gw),
    onSuccess: (res) => {
      const { redirectUrl } = res.data;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        setError('Payment gateway did not return a redirect URL. Contact support.');
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Payment initiation failed.';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    },
  });

  // Paid downgrade: call subscribe() which sets pendingPlanId (doesn't require payment)
  const downgradeMutation = useMutation({
    mutationFn: (planId: string) => subscribeToPlan(planId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscription'] });
      setSelectedPlan(null);
      setError('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Downgrade failed.';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    },
  });

  const cancel = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['subscription'] }),
  });

  function handleSwitchConfirm() {
    if (!selectedPlan) return;
    setError('');

    if (isFree(selectedPlan)) {
      freeSwitchMutation.mutate(selectedPlan.id);
      return;
    }

    const currentPrice = parseFloat(current?.plan?.priceMonthly ?? '0');
    const newPrice = parseFloat(selectedPlan.priceMonthly);

    if (newPrice < currentPrice) {
      // Downgrade: backend schedules via pendingPlanId, no payment needed
      downgradeMutation.mutate(selectedPlan.id);
    } else {
      // Upgrade / new paid plan: go through payment gateway
      paidSwitchMutation.mutate({ planId: selectedPlan.id, gw: gateway });
    }
  }

  const isPending =
    freeSwitchMutation.isPending || paidSwitchMutation.isPending || downgradeMutation.isPending;

  const currentPrice = parseFloat(current?.plan?.priceMonthly ?? '0');
  const selectedPrice = parseFloat(selectedPlan?.priceMonthly ?? '0');
  const isDowngrade = selectedPlan && !isFree(selectedPlan) && selectedPrice < currentPrice;
  const isUpgrade = selectedPlan && !isFree(selectedPlan) && selectedPrice >= currentPrice;

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
                {current.pendingPlanId && (
                  <p className="text-amber-600 text-xs mt-1">
                    Downgrade scheduled — applies at next billing cycle.
                  </p>
                )}
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
              const isSelected = selectedPlan?.id === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`border rounded-xl p-4 transition-colors ${
                    isCurrent
                      ? 'border-brand-500 bg-brand-50'
                      : isSelected
                        ? 'border-brand-300 bg-brand-50/50'
                        : 'border-gray-100 hover:border-gray-200'
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
                    <button
                      onClick={() => { setSelectedPlan(plan); setError(''); }}
                      className={`mt-4 w-full text-xs border rounded-lg py-1.5 font-medium transition-colors ${
                        isSelected
                          ? 'border-brand-500 bg-brand-600 text-white'
                          : 'border-brand-200 text-brand-600 hover:bg-brand-50'
                      }`}
                    >
                      {isSelected ? '✓ Selected' : 'Select plan'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Checkout panel — shown when a plan is selected */}
        {selectedPlan && (
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">
              Switch to {PLAN_LABELS[selectedPlan.name] ?? selectedPlan.name}
            </h2>

            {isFree(selectedPlan) && (
              <p className="text-sm text-gray-600">
                Switching to the free plan takes effect immediately. No payment needed.
              </p>
            )}

            {isDowngrade && (
              <p className="text-sm text-gray-600">
                Downgrading to a lower paid plan is scheduled for your next billing cycle —
                your current plan limits stay active until then.
              </p>
            )}

            {isUpgrade && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Choose a payment method to complete the upgrade.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {GATEWAYS.map((gw) => (
                    <button
                      key={gw.value}
                      onClick={() => setGateway(gw.value)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        gateway === gw.value
                          ? 'border-brand-500 bg-brand-600 text-white'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {gw.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSwitchConfirm}
                disabled={isPending}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {isPending
                  ? 'Processing…'
                  : isUpgrade
                    ? `Pay with ${GATEWAYS.find((g) => g.value === gateway)?.label}`
                    : 'Confirm switch'}
              </button>
              <button
                onClick={() => { setSelectedPlan(null); setError(''); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
