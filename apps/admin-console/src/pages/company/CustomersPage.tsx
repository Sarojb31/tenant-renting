import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Layout } from '../../components/Layout';
import { DataTable } from '../../components/DataTable';
import { fetchCustomers, createCustomer, type Customer } from '../../api/customers';

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

const EMPTY: { phone: string; name: string; email: string; smsOptIn: boolean } = {
  phone: '', name: '', email: '', smsOptIn: true,
};

export function CustomersPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => fetchCustomers().then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: () => createCustomer({
      phone: form.phone.trim(),
      ...(form.name.trim() && { name: form.name.trim() }),
      ...(form.email.trim() && { email: form.email.trim() }),
      smsOptIn: form.smsOptIn,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customers'] });
      setShowCreate(false);
      setForm(EMPTY);
      setError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to create customer.');
    },
  });

  function field(label: string, child: React.ReactNode) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        {child}
      </div>
    );
  }

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <Layout title="Customers">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {data && (
            <p className="text-sm text-gray-500">{data.total} customer{data.total !== 1 ? 's' : ''} registered</p>
          )}
          <button
            onClick={() => { setShowCreate(true); setError(''); }}
            className="ml-auto bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700"
          >
            + New Customer
          </button>
        </div>

        {showCreate && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Create Customer</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('Phone *',
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+9779800000001" className={inp} />
              )}
              {field('Name',
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Full name" className={inp} />
              )}
              {field('Email',
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="customer@example.com" className={inp} />
              )}
              <div className="flex items-center gap-2 pt-5">
                <input
                  id="sms-opt-in"
                  type="checkbox"
                  checked={form.smsOptIn}
                  onChange={(e) => setForm({ ...form, smsOptIn: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600"
                />
                <label htmlFor="sms-opt-in" className="text-sm text-gray-600">SMS opt-in</label>
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => create.mutate()}
                disabled={create.isPending || !form.phone.trim()}
                className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {create.isPending ? 'Creating…' : 'Create Customer'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setError(''); }}
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
          emptyMessage="No customers yet. Create one above or they register via OTP on the customer PWA."
        />
      </div>
    </Layout>
  );
}
