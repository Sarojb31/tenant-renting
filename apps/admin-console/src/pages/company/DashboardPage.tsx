import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { fetchListings } from '../../api/listings';
import { fetchCustomers } from '../../api/customers';
import { fetchPayments } from '../../api/payments';

export function DashboardPage() {
  const { data: listingsData } = useQuery({
    queryKey: ['listings', 'summary'],
    queryFn: () => fetchListings({ limit: 5, status: 'published' }).then((r) => r.data),
  });
  const { data: customersData } = useQuery({
    queryKey: ['customers', 'summary'],
    queryFn: () => fetchCustomers({ limit: 1 }).then((r) => r.data),
  });
  const { data: paymentsData } = useQuery({
    queryKey: ['payments', 'summary'],
    queryFn: () => fetchPayments({ limit: 5 }).then((r) => r.data),
  });

  const totalRevenue = (paymentsData?.data ?? [])
    .filter((p) => p.status === 'success')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <Layout title="Dashboard">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Listings"
            value={listingsData?.total ?? '—'}
            sub="Published & live"
            live
            accent="blue"
          />
          <StatCard
            label="Customers"
            value={customersData?.total ?? '—'}
            sub="Registered via OTP"
            accent="green"
          />
          <StatCard
            label="Total Revenue"
            value={totalRevenue ? `₹${totalRevenue.toLocaleString()}` : '—'}
            sub="Confirmed payments"
            accent="green"
          />
          <StatCard
            label="Pending Payments"
            value={(paymentsData?.data ?? []).filter((p) => p.status === 'pending').length}
            sub="Awaiting confirmation"
            accent="amber"
          />
        </div>

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
