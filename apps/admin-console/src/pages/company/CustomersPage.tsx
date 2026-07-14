import { useQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Layout } from '../../components/Layout';
import { DataTable } from '../../components/DataTable';
import { fetchCustomers, type Customer } from '../../api/customers';

const col = createColumnHelper<Customer>();

const columns = [
  col.accessor('name', {
    header: 'Name',
    cell: (i) => <span className="font-medium text-gray-900">{i.getValue() ?? '—'}</span>,
  }),
  col.accessor('phone', {
    header: 'Phone',
    cell: (i) => <span className="font-mono text-sm">{i.getValue()}</span>,
  }),
  col.accessor('email', {
    header: 'Email',
    cell: (i) => <span className="text-gray-500">{i.getValue() ?? '—'}</span>,
  }),
  col.accessor('smsOptIn', {
    header: 'SMS',
    cell: (i) => (
      <span className={`text-xs font-medium ${i.getValue() ? 'text-emerald-600' : 'text-gray-400'}`}>
        {i.getValue() ? 'Opted in' : 'Opted out'}
      </span>
    ),
  }),
  col.accessor('createdAt', {
    header: 'Registered',
    cell: (i) => <span className="text-gray-500 text-xs">{new Date(i.getValue()).toLocaleDateString()}</span>,
  }),
];

export function CustomersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => fetchCustomers().then((r) => r.data),
  });

  return (
    <Layout title="Customers">
      <div className="space-y-4">
        {data && (
          <p className="text-sm text-gray-500">{data.total} customer{data.total !== 1 ? 's' : ''} registered</p>
        )}
        <DataTable
          data={data?.data ?? []}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No customers yet. They register via OTP on the customer PWA."
        />
      </div>
    </Layout>
  );
}
