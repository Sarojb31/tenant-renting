import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { fetchListings } from '../../api/listings';
import { fetchPayments } from '../../api/payments';
import { fetchTenantAnalytics } from '../../api/analytics';
import { fetchCurrentSubscription } from '../../api/subscriptions';

export function DashboardPage() {
  const { data: analytics } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => fetchTenantAnalytics().then((r) => r.data),
  });
  const { data: listingsData } = useQuery({
    queryKey: ['listings', 'recent'],
    queryFn: () => fetchListings({ limit: 5 }).then((r) => r.data),
  });
  const { data: paymentsData } = useQuery({
    queryKey: ['payments', 'recent'],
    queryFn: () => fetchPayments({ limit: 5 }).then((r) => r.data),
  });
  const { data: sub } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: () => fetchCurrentSubscription().then((r) => r.data),
  });

  return (
    <Layout title="Dashboard">
      <div className="space-y-6">
        {/* Stats from analytics endpoint */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Listings"
            value={analytics?.listings.published ?? '—'}
            sub="Published & live"
            live
            accent="blue"
          />
          <StatCard
            label="Customers"
            value={analytics?.customers.total ?? '—'}
            sub="Registered"
            accent="green"
          />
          <StatCard
            label="Total Revenue"
            value={analytics ? `₹${Number(analytics.revenue.total).toLocaleString()}` : '—'}
            sub="Confirmed payments"
            accent="green"
          />
          <StatCard
            label="Pending Bookings"
            value={analytics?.bookings.pending ?? '—'}
            sub="Awaiting confirmation"
            accent="amber"
          />
        </div>

        {/* Subscription strip */}
        {sub && (
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Plan</p>
                <p className="font-semibold text-gray-800 capitalize">{sub.plan.name.replace('_', ' ')}</p>
              </div>
              <StatusBadge status={sub.status} />
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-lg font-bold tabular-nums text-brand-600">{sub.smsCreditsRemaining}</p>
                <p className="text-xs text-gray-500">SMS credits left</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold tabular-nums text-gray-700">{analytics?.listings.total ?? '—'}</p>
                <p className="text-xs text-gray-500">
                  / {sub.plan.maxListings ?? '∞'} listings
                </p>
              </div>
              <a href="/company/subscription" className="text-xs text-brand-600 font-medium hover:underline">
                Manage plan →
              </a>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent listings */}
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">Recent Listings</h2>
              <a href="/company/listings" className="text-brand-600 text-xs font-medium hover:underline">View all →</a>
            </div>
            <ul className="divide-y divide-gray-50">
              {(listingsData?.data ?? []).slice(0, 5).map((l) => (
                <li key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{l.title}</p>
                    <p className="text-xs text-gray-500">{l.city}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-gray-700 font-mono">
                      ₹{Number(l.rentAmount).toLocaleString()}
                    </span>
                    <StatusBadge status={l.status} />
                  </div>
                </li>
              ))}
              {!listingsData && (
                <li className="px-5 py-8 text-center text-gray-400 text-sm">Loading…</li>
              )}
            </ul>
          </div>

          {/* Recent payments */}
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">Recent Payments</h2>
              <a href="/company/payments" className="text-brand-600 text-xs font-medium hover:underline">View all →</a>
            </div>
            <ul className="divide-y divide-gray-50">
              {(paymentsData?.data ?? []).slice(0, 5).map((p) => (
                <li key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-gray-500 truncate">{p.id.slice(0, 16)}…</p>
                    <p className="text-xs text-gray-400 capitalize">{p.gateway}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-gray-700 font-mono">
                      ₹{Number(p.amount).toLocaleString()}
                    </span>
                    <StatusBadge status={p.status} />
                  </div>
                </li>
              ))}
              {!paymentsData && (
                <li className="px-5 py-8 text-center text-gray-400 text-sm">Loading…</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
