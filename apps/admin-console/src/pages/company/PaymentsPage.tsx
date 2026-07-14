import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Layout } from '../../components/Layout';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { fetchPayments, type Payment } from '../../api/payments';

const col = createColumnHelper<Payment>();

export function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['payments', { statusFilter }],
    queryFn: () => fetchPayments(statusFilter ? { status: statusFilter } : {}).then((r) => r.data),
  });

  const columns = [
    col.accessor('id', {
      header: 'Payment ID',
      cell: (i) => <span className="font-mono text-xs text-gray-500">{i.getValue().slice(0, 14)}…</span>,
    }),
    col.accessor('gateway', {
      header: 'Gateway',
      cell: (i) => <span className="capitalize font-medium">{i.getValue()}</span>,
    }),
    col.accessor('amount', {
      header: 'Amount',
      cell: (i) => (
        <span className="font-mono font-semibold">
          ₹{Number(i.getValue()).toLocaleString()}
        </span>
      ),
    }),
    col.accessor('currency', {
      header: 'Currency',
      cell: (i) => <span className="uppercase text-xs text-gray-500">{i.getValue()}</span>,
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (i) => <StatusBadge status={i.getValue()} />,
    }),
    col.accessor('createdAt', {
      header: 'Date',
      cell: (i) => (
        <span className="text-xs text-gray-500">
          {new Date(i.getValue()).toLocaleString()}
        </span>
      ),
    }),
  ];

  const successTotal = (data?.data ?? [])
    .filter((p) => p.status === 'success')
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <Layout title="Payments">
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          {successTotal > 0 && (
            <span className="ml-auto text-sm font-semibold text-emerald-600">
              Confirmed revenue: ₹{successTotal.toLocaleString()}
            </span>
          )}
        </div>

        <DataTable
          data={data?.data ?? []}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No payments recorded yet."
        />
      </div>
    </Layout>
  );
}
