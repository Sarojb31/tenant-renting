import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Layout } from '../../components/Layout';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import {
  fetchListings,
  fetchAvailability,
  updateListing,
  updateAvailability,
  deleteListing,
  type Listing,
} from '../../api/listings';

function buildShareText(listing: Listing): string {
  const rent = Number(listing.rentAmount).toLocaleString();
  const type = listing.roomType.replace('_', ' ');
  return [
    `🏠 ${listing.title} — ${listing.city}`,
    `💰 NPR ${rent}/month`,
    `🛏️ ${type.charAt(0).toUpperCase() + type.slice(1)} room`,
    '',
    'Interested? Message our Facebook Page to schedule a viewing!',
    '',
    `📋 Ref: ${listing.id.slice(0, 8)}`,
  ].join('\n');
}

function ShareModal({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = buildShareText(listing);

  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Share to Facebook</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        <p className="text-xs text-gray-500">
          Copy this text, then paste it when creating your Facebook post or Marketplace listing.
          Interested buyers will message your Facebook Page inbox.
        </p>
        <textarea
          readOnly
          value={text}
          rows={8}
          className="w-full border border-gray-200 rounded-lg p-3 text-sm font-mono text-gray-700 bg-gray-50 resize-none focus:outline-none"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={copy}
            className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            {copied ? 'Copied!' : 'Copy Text'}
          </button>
        </div>
      </div>
    </div>
  );
}

const col = createColumnHelper<Listing>();

function AvailabilityPanel({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const qc = useQueryClient();
  const [dateInput, setDateInput] = useState(listing.availableFrom ?? '');

  const { data: avail, isLoading } = useQuery({
    queryKey: ['availability', listing.id],
    queryFn: () => fetchAvailability(listing.id).then((r) => r.data),
  });

  const saveDate = useMutation({
    mutationFn: (availableFrom: string) =>
      updateAvailability(listing.id, { availableFrom: availableFrom || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['availability', listing.id] });
      void qc.invalidateQueries({ queryKey: ['listings'] });
    },
  });

  const markOccupied = useMutation({
    mutationFn: () => updateAvailability(listing.id, { status: 'occupied' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['availability', listing.id] });
      void qc.invalidateQueries({ queryKey: ['listings'] });
    },
  });

  const markVacant = useMutation({
    mutationFn: () => updateAvailability(listing.id, { status: 'published' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['availability', listing.id] });
      void qc.invalidateQueries({ queryKey: ['listings'] });
    },
  });

  const currentStatus = avail?.status ?? listing.status;

  return (
    <div className="border border-gray-100 rounded-xl bg-gray-50 p-4 mt-1 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Availability — {listing.title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">Close</button>
      </div>

      {isLoading && <p className="text-xs text-gray-400">Loading…</p>}

      {avail && (
        <>
          {/* Status toggle */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Status:</span>
            <StatusBadge status={currentStatus} />
            {currentStatus === 'published' && (
              <button
                onClick={() => markOccupied.mutate()}
                disabled={markOccupied.isPending}
                className="text-xs bg-orange-100 text-orange-700 rounded px-2 py-1 hover:bg-orange-200 disabled:opacity-50"
              >
                Mark Occupied
              </button>
            )}
            {currentStatus === 'occupied' && (
              <button
                onClick={() => markVacant.mutate()}
                disabled={markVacant.isPending}
                className="text-xs bg-green-100 text-green-700 rounded px-2 py-1 hover:bg-green-200 disabled:opacity-50"
              >
                Mark Vacant
              </button>
            )}
          </div>

          {/* Available from date */}
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Available From</label>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              />
            </div>
            <button
              onClick={() => saveDate.mutate(dateInput)}
              disabled={saveDate.isPending}
              className="text-xs bg-brand-600 text-white rounded-lg px-3 py-1.5 hover:bg-brand-700 disabled:opacity-50"
            >
              {saveDate.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>

          {/* Upcoming bookings */}
          {avail.bookings.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Bookings ({avail.bookings.length})</p>
              <div className="space-y-1">
                {avail.bookings.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 text-xs text-gray-600 bg-white border border-gray-100 rounded px-3 py-1.5">
                    <span className="font-mono">{b.moveInDate ?? '—'}</span>
                    <StatusBadge status={b.status} />
                    <span className="text-gray-400 truncate">{b.customerId}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">No bookings for this listing.</p>
          )}
        </>
      )}
    </div>
  );
}

export function ListingsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shareListingId, setShareListingId] = useState<string | null>(null);

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
      cell: (i) => (
        <button
          onClick={() => setExpandedId(expandedId === i.row.original.id ? null : i.row.original.id)}
          className="font-medium text-gray-900 hover:text-brand-600 text-left"
        >
          {i.getValue()}
        </button>
      ),
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
    col.accessor('availableFrom', {
      header: 'Available From',
      cell: (i) => <span className="text-xs text-gray-500">{i.getValue() ?? '—'}</span>,
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
            <button
              onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
              className="text-xs text-gray-500 hover:text-brand-600 hover:underline"
            >
              Availability
            </button>
            <button
              onClick={() => setShareListingId(row.id)}
              className="text-xs text-blue-500 hover:underline"
              title="Generate Facebook share text"
            >
              Share
            </button>
            {row.status !== 'published' && row.status !== 'occupied' && (
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

  const listings = data?.data ?? [];

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
            <option value="occupied">Occupied</option>
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
          data={listings}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No listings found. Create listings via the API."
        />

        {expandedId && (() => {
          const selectedListing = listings.find((l) => l.id === expandedId);
          return selectedListing ? (
            <AvailabilityPanel listing={selectedListing} onClose={() => setExpandedId(null)} />
          ) : null;
        })()}
      </div>

      {shareListingId && (() => {
        const shareListing = listings.find((l) => l.id === shareListingId);
        return shareListing ? (
          <ShareModal listing={shareListing} onClose={() => setShareListingId(null)} />
        ) : null;
      })()}
    </Layout>
  );
}
