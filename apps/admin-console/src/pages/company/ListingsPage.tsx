import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Layout } from '../../components/Layout';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { fetchListings, updateListing, deleteListing, type Listing } from '../../api/listings';

const col = createColumnHelper<Listing>();

export function ListingsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['listings', { statusFilter, search }],
    queryFn: () => fetchListings({
      ...(statusFilter && { status: statusFilter }),
      ...(search && { city: search }),
    }).then((r) => r.data),
  });

  const archive = useMutation({
    mutationFn: (id: string) => updateListing(id, { status: 'archived' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listings'] }),
  });

  const publish = useMutation({
    mutationFn: (id: string) => updateListing(id, { status: 'published' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listings'] }),
  });

  const columns = [
    col.accessor('title', {
      header: 'Title',
      cell: (i) => <span className="font-medium text-gray-900">{i.getValue()}</span>,
    }),
    col.accessor('city', { header: 'City' }),
    col.accessor('roomType', {
      header: 'Type',
      cell: (i) => <span className="capitalize">{i.getValue()}</span>,
    }),
    col.accessor('rentAmount', {
      header: 'Rent / mo',
      cell: (i) => <span className="font-mono font-semibold">₹{Number(i.getValue()).toLocaleString()}</span>,
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (i) => <StatusBadge status={i.getValue()} />,
    }),
    col.display({
      id: 'actions',
      header: 'Actions',
      cell: (i) => {
        const row = i.row.original;
        return (
          <div className="flex items-center gap-2">
            {row.status !== 'published' && (
              <button
                onClick={() => publish.mutate(row.id)}
                className="text-xs text-brand-600 hover:underline"
              >
                Publish
              </button>
            )}
            {row.status !== 'archived' && (
              <button
                onClick={() => archive.mutate(row.id)}
                className="text-xs text-red-500 hover:underline"
              >
                Archive
              </button>
            )}
          </div>
        );
      },
    }),
  ];

  return (
    <Layout title="Listings">
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by city…"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white w-48"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          {data && (
            <span className="text-sm text-gray-500 ml-auto">
              {data.total} listing{data.total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <DataTable
          data={data?.data ?? []}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No listings found. Create listings via the API."
        />
      </div>
    </Layout>
  );
}
