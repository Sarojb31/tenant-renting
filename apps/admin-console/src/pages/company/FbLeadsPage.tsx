import { useQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Layout } from '../../components/Layout';
import { DataTable } from '../../components/DataTable';
import { fetchFbLeads, type FbPageLead } from '../../api/facebook';

const col = createColumnHelper<FbPageLead>();

const columns = [
  col.accessor('createdAt', {
    header: 'Received',
    cell: (i) => (
      <span className="text-xs text-gray-500 font-mono">
        {new Date(i.getValue()).toLocaleString()}
      </span>
    ),
  }),
  col.accessor('fbPageId', {
    header: 'Page ID',
    cell: (i) => <span className="font-mono text-xs text-gray-600">{i.getValue()}</span>,
  }),
  col.accessor('fbSenderPsid', {
    header: 'Sender PSID',
    cell: (i) => (
      <span className="font-mono text-xs text-gray-600">
        {i.getValue().slice(0, 8)}…
      </span>
    ),
  }),
  col.accessor('messageText', {
    header: 'Message',
    cell: (i) => (
      <span className="text-sm text-gray-800 line-clamp-2 max-w-xs block">
        {i.getValue()}
      </span>
    ),
  }),
  col.accessor('matchedCustomerId', {
    header: 'Matched Customer',
    cell: (i) =>
      i.getValue() ? (
        <span className="text-xs font-mono text-brand-600">{i.getValue()}</span>
      ) : (
        <span className="text-xs text-gray-400 italic">Unmatched</span>
      ),
  }),
];

export function FbLeadsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['fb-leads'],
    queryFn: () => fetchFbLeads().then((r) => r.data),
  });

  const leads = data ?? [];

  return (
    <Layout title="Facebook Page Leads">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Messages received from your Facebook Page inbox via the Messenger webhook.
          </p>
          <span className="text-sm text-gray-500">
            {leads.length} lead{leads.length !== 1 ? 's' : ''}
          </span>
        </div>

        {leads.length === 0 && !isLoading && (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center space-y-2">
            <p className="text-gray-500 text-sm font-medium">No leads yet</p>
            <p className="text-gray-400 text-xs max-w-sm mx-auto">
              Connect your Facebook Page webhook to start capturing messages from potential customers.
              Set <code className="bg-gray-100 px-1 rounded">FB_WEBHOOK_VERIFY_TOKEN</code> and{' '}
              <code className="bg-gray-100 px-1 rounded">FB_APP_SECRET</code> in your backend environment,
              then configure the webhook URL in your Meta App Dashboard.
            </p>
          </div>
        )}

        {(leads.length > 0 || isLoading) && (
          <DataTable
            data={leads}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No Facebook leads yet."
          />
        )}
      </div>
    </Layout>
  );
}
