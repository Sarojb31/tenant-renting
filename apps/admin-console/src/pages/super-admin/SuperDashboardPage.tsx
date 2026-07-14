import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { fetchTenants } from '../../api/tenants';

export function SuperDashboardPage() {
  const { data } = useQuery({
    queryKey: ['tenants', 'summary'],
    queryFn: () => fetchTenants({ limit: 10 }).then((r) => r.data),
  });

  const tenants = data?.data ?? [];
  const active = tenants.filter((t) => t.status === 'active').length;
  const trial = tenants.filter((t) => t.status === 'trial').length;

  return (
    <Layout title="Platform Overview">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Tenants"
            value={data?.total ?? '—'}
            sub="All plans"
            live
            accent="blue"
          />
          <StatCard
            label="Active"
            value={active}
            sub="Paid + onboarded"
            accent="green"
          />
          <StatCard
            label="Trial"
            value={trial}
            sub="Within trial window"
            accent="amber"
          />
          <StatCard
            label="Suspended"
            value={tenants.filter((t) => t.status === 'suspended').length}
            sub="Requires action"
            accent="red"
          />
        </div>

        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">Tenant Accounts</h2>
            <a href="/super/tenants" className="text-brand-600 text-xs font-medium hover:underline">Manage all →</a>
          </div>
          <ul className="divide-y divide-gray-50">
            {tenants.slice(0, 8).map((t) => (
              <li key={t.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{t.subdomain}.roomfinder.app</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-400 uppercase font-medium">{t.country}</span>
                  <StatusBadge status={t.status} />
                </div>
              </li>
            ))}
            {!data && (
              <li className="px-5 py-8 text-center text-gray-400 text-sm">Loading…</li>
            )}
            {data && tenants.length === 0 && (
              <li className="px-5 py-8 text-center text-gray-400 text-sm">No tenants yet.</li>
            )}
          </ul>
        </div>
      </div>
    </Layout>
  );
}
