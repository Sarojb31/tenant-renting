import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Layout } from '../../components/Layout';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { fetchTenants, updateTenant, type Tenant } from '../../api/tenants';

const col = createColumnHelper<Tenant>();

export function TenantsPage() {
  const qc = useQueryClient();
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

  const columns = [
    col.accessor('name', {
      header: 'Company',
      cell: (i) => <span className="font-medium text-gray-900">{i.getValue()}</span>,
    }),
    col.accessor('subdomain', {
      header: 'Subdomain',
      cell: (i) => <span className="font-mono text-sm text-gray-600">{i.getValue()}.roomfinder.app</span>,
    }),
    col.accessor('country', {
      header: 'Country',
      cell: (i) => <span className="uppercase text-xs font-semibold text-gray-500">{i.getValue()}</span>,
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
              <button onClick={() => activate.mutate(row.id)} className="text-xs text-brand-600 hover:underline">
                Activate
              </button>
            ) : (
              <button onClick={() => suspend.mutate(row.id)} className="text-xs text-red-500 hover:underline">
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
        {data && (
          <p className="text-sm text-gray-500">{data.total} tenant{data.total !== 1 ? 's' : ''}</p>
        )}
        <DataTable
          data={data?.data ?? []}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No tenants. Create one via POST /tenants with a super admin token."
        />
      </div>
    </Layout>
  );
}
