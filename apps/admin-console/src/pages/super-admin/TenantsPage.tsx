import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Layout } from '../../components/Layout';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import {
  fetchTenants,
  updateTenant,
  onboardTenant,
  type Tenant,
  type OnboardTenantDto,
} from '../../api/tenants';

const col = createColumnHelper<Tenant>();

const EMPTY: OnboardTenantDto = {
  name: '',
  subdomain: '',
  country: 'NP',
  defaultCurrency: 'NPR',
  adminEmail: '',
  adminName: '',
  adminPassword: '',
};

interface CreatedBanner {
  tenantName: string;
  subdomain: string;
  adminEmail: string;
}

export function TenantsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<OnboardTenantDto>(EMPTY);
  const [createError, setCreateError] = useState('');
  const [created, setCreated] = useState<CreatedBanner | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => fetchTenants().then((r) => r.data),
  });

  const suspend = useMutation({
    mutationFn: (id: string) => updateTenant(id, { status: 'suspended' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  });

  const activate = useMutation({
    mutationFn: (id: string) => updateTenant(id, { status: 'active' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  });

  const create = useMutation({
    mutationFn: () => onboardTenant(form),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['tenants'] });
      setCreated({
        tenantName: res.data.tenant.name,
        subdomain: res.data.tenant.subdomain,
        adminEmail: res.data.adminUser.email,
      });
      setShowCreate(false);
      setForm(EMPTY);
      setCreateError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      setCreateError(Array.isArray(msg) ? msg.join(', ') : typeof msg === 'string' ? msg : 'Failed to create tenant.');
    },
  });

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';

  function field(label: string, child: React.ReactNode) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        {child}
      </div>
    );
  }

  function set(patch: Partial<OnboardTenantDto>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  const columns = [
    col.accessor('name', {
      header: 'Company',
      cell: (i) => <span className="font-medium text-gray-900">{i.getValue()}</span>,
    }),
    col.accessor('subdomain', {
      header: 'Subdomain',
      cell: (i) => (
        <span className="font-mono text-sm text-gray-600">
          {i.getValue()}<span className="text-gray-400">.roomfinder.app</span>
        </span>
      ),
    }),
    col.accessor('country', {
      header: 'Country',
      cell: (i) => <span className="uppercase text-xs font-semibold text-gray-500">{i.getValue()}</span>,
    }),
    col.accessor('defaultCurrency', {
      header: 'Currency',
      cell: (i) => <span className="text-xs text-gray-500">{i.getValue()}</span>,
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (i) => <StatusBadge status={i.getValue()} />,
    }),
    col.accessor('createdAt', {
      header: 'Created',
      cell: (i) => <span className="text-xs text-gray-500">{new Date(i.getValue()).toLocaleDateString()}</span>,
    }),
    col.display({
      id: 'actions',
      header: 'Actions',
      cell: (i) => {
        const row = i.row.original;
        return (
          <div className="flex items-center gap-2">
            {row.status === 'suspended' ? (
              <button
                onClick={() => activate.mutate(row.id)}
                disabled={activate.isPending}
                className="text-xs text-brand-600 hover:underline disabled:opacity-50"
              >
                Activate
              </button>
            ) : (
              <button
                onClick={() => suspend.mutate(row.id)}
                disabled={suspend.isPending}
                className="text-xs text-red-500 hover:underline disabled:opacity-50"
              >
                Suspend
              </button>
            )}
          </div>
        );
      },
    }),
  ];

  return (
    <Layout title="Tenants">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {data && (
            <p className="text-sm text-gray-500">{data.total} tenant{data.total !== 1 ? 's' : ''}</p>
          )}
          <button
            onClick={() => { setShowCreate((v) => !v); setCreateError(''); setCreated(null); }}
            className="ml-auto bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700"
          >
            + Onboard Tenant
          </button>
        </div>

        {/* Success banner */}
        {created && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-green-800">
                Tenant <strong>{created.tenantName}</strong> onboarded
              </p>
              <button onClick={() => setCreated(null)} className="text-green-400 hover:text-green-600 text-xs">✕</button>
            </div>
            <p className="text-xs text-green-700">
              Subdomain: <span className="font-mono font-medium">{created.subdomain}.roomfinder.app</span>
              {' · '}Admin login: <span className="font-mono">{created.adminEmail}</span>
            </p>
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Onboard New Tenant</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('Company Name *',
                <input value={form.name} onChange={(e) => set({ name: e.target.value })}
                  placeholder="Acme Rentals" className={inp} />
              )}
              {field('Subdomain *',
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-brand-500">
                  <input
                    value={form.subdomain}
                    onChange={(e) => set({ subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="acme"
                    className="flex-1 px-3 py-2 text-sm focus:outline-none"
                  />
                  <span className="px-2 py-2 text-xs text-gray-400 bg-gray-50 border-l border-gray-200 whitespace-nowrap">
                    .roomfinder.app
                  </span>
                </div>
              )}
              {field('Country *',
                <input value={form.country} onChange={(e) => set({ country: e.target.value.toUpperCase().slice(0, 2) })}
                  placeholder="NP" maxLength={2} className={inp} />
              )}
              {field('Currency *',
                <input value={form.defaultCurrency} onChange={(e) => set({ defaultCurrency: e.target.value.toUpperCase().slice(0, 3) })}
                  placeholder="NPR" maxLength={3} className={inp} />
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Admin Account</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('Admin Name *',
                  <input value={form.adminName} onChange={(e) => set({ adminName: e.target.value })}
                    placeholder="John Doe" className={inp} />
                )}
                {field('Admin Email *',
                  <input type="email" value={form.adminEmail} onChange={(e) => set({ adminEmail: e.target.value })}
                    placeholder="admin@acme.com" className={inp} />
                )}
                {field('Admin Password *',
                  <input type="password" value={form.adminPassword} onChange={(e) => set({ adminPassword: e.target.value })}
                    placeholder="Min 8 characters" className={inp} />
                )}
              </div>
            </div>

            {createError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{createError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => create.mutate()}
                disabled={
                  create.isPending ||
                  !form.name.trim() ||
                  !form.subdomain.trim() ||
                  !form.adminEmail.trim() ||
                  !form.adminName.trim() ||
                  form.adminPassword.length < 8
                }
                className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {create.isPending ? 'Creating…' : 'Create Tenant'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setCreateError(''); }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <DataTable
          data={data?.data ?? []}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No tenants yet. Use the button above to onboard the first one."
        />
      </div>
    </Layout>
  );
}
