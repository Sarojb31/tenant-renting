import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Layout } from '../../components/Layout';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import {
  fetchTickets,
  createTicket,
  updateTicketStatus,
  type SupportTicket,
  type TicketStatus,
} from '../../api/support';

const col = createColumnHelper<SupportTicket>();

const STATUS_OPTIONS: { label: string; value: TicketStatus }[] = [
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

function TicketRow({
  ticket,
  onStatusChange,
}: {
  ticket: SupportTicket;
  onStatusChange: (id: string, status: TicketStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className="cursor-pointer hover:bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-start gap-3"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{ticket.subject}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(ticket.createdAt).toLocaleDateString()} · {ticket.raisedByUserId.slice(0, 8)}…
          </p>
        </div>
        <StatusBadge status={ticket.status} />
      </div>
      {open && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 space-y-3">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
          {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Update status:</span>
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onStatusChange(ticket.id, opt.value)}
                  className="text-xs bg-white border border-gray-200 rounded px-2 py-1 hover:bg-gray-100"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function SupportPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => fetchTickets().then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: () => createTicket({ subject, description }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['support-tickets'] });
      setShowCreate(false);
      setSubject('');
      setDescription('');
    },
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) =>
      updateTicketStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-tickets'] }),
  });

  const items = tickets ?? [];

  return (
    <Layout title="Support Tickets">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{items.length} ticket{items.length !== 1 ? 's' : ''}</p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700"
          >
            + New Ticket
          </button>
        </div>

        {showCreate && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">New Support Ticket</h3>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              maxLength={200}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail…"
              rows={4}
              maxLength={5000}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => create.mutate()}
                disabled={create.isPending || !subject.trim() || !description.trim()}
                className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {create.isPending ? 'Submitting…' : 'Submit'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isLoading && <p className="text-xs text-gray-400">Loading…</p>}

        {!isLoading && items.length === 0 && !showCreate && (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm font-medium">No support tickets yet</p>
            <p className="text-gray-400 text-xs mt-1">Submit a ticket if you need help from the platform team.</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {items.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                onStatusChange={(id, status) => changeStatus.mutate({ id, status })}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
