import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Layout } from '../../components/Layout';
import { DataTable } from '../../components/DataTable';
import {
  fetchCustomers,
  createCustomer,
  fetchCustomerImages,
  uploadCustomerImages,
  type Customer,
  type CustomerImage,
} from '../../api/customers';

const col = createColumnHelper<Customer>();

// ─── Customer image panel ─────────────────────────────────────────────────────

function CustomerImagePanel({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgType, setImgType] = useState('other');
  const [uploadErr, setUploadErr] = useState('');

  const { data: images, isLoading } = useQuery({
    queryKey: ['customer-images', customerId],
    queryFn: () => fetchCustomerImages(customerId).then((r) => r.data),
  });

  const upload = useMutation({
    mutationFn: (files: File[]) => uploadCustomerImages(customerId, files, imgType),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customer-images', customerId] });
      setUploadErr('');
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Upload failed.';
      setUploadErr(Array.isArray(msg) ? msg.join(', ') : String(msg));
    },
  });

  const TYPE_OPTIONS = [
    { value: 'other', label: 'Other' },
    { value: 'profile_photo', label: 'Profile Photo' },
    { value: 'id_document', label: 'ID / KYC Document' },
  ];

  return (
    <div className="bg-gray-50 border-t border-gray-100 px-5 py-4 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer Images</p>

      {/* Existing images */}
      {isLoading && <p className="text-xs text-gray-400">Loading images…</p>}
      {!isLoading && images?.length === 0 && (
        <p className="text-xs text-gray-400 italic">No images uploaded yet.</p>
      )}
      {images && images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img: CustomerImage) => (
            <div key={img.id} className="relative group">
              <img
                src={img.url}
                alt={img.type}
                className="h-16 w-16 object-cover rounded-lg border border-gray-200"
                onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%2264%22 height%3D%2264%22%3E%3Crect fill%3D%22%23f3f4f6%22 width%3D%22100%25%22 height%3D%22100%25%22/%3E%3C/svg%3E'; }}
              />
              <span className="absolute bottom-0 inset-x-0 text-center text-[9px] bg-black/50 text-white rounded-b-lg py-0.5 truncate px-1">
                {img.type}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Upload form */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={imgType}
          onChange={(e) => setImgType(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) upload.mutate(files);
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:border-gray-300 disabled:opacity-50"
        >
          {upload.isPending ? 'Uploading…' : '+ Upload Images'}
        </button>
        {uploadErr && <p className="text-red-600 text-xs">{uploadErr}</p>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const EMPTY = { phone: '', name: '', email: '', smsOptIn: true };

export function CustomersPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: customers, isLoading } = useQuery({
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
    col.accessor('id', {
      header: '',
      cell: (i) => {
        const id = i.getValue();
        const open = expandedId === id;
        return (
          <button
            onClick={() => setExpandedId(open ? null : id)}
            className="text-xs text-brand-600 hover:underline whitespace-nowrap"
          >
            {open ? '▲ Hide' : '📷 Images'}
          </button>
        );
      },
    }),
  ];

  const customerList = customers ?? [];

  return (
    <Layout title="Customers">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {customers && (
            <p className="text-sm text-gray-500">{customers.length} customer{customers.length !== 1 ? 's' : ''} registered</p>
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
          data={customerList}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No customers yet. Create one above or they register via OTP on the customer PWA."
          expandedRow={expandedId}
          renderExpanded={(row) => <CustomerImagePanel customerId={row.id} />}
        />
      </div>
    </Layout>
  );
}
