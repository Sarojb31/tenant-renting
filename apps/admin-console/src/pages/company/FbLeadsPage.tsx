import { useState } from 'react';
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

const BACKEND_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
const WEBHOOK_URL = `${BACKEND_URL.replace(/\/api$/, '')}/facebook/webhook`;

function IntegrationSetup() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">📘</span>
          <div>
            <p className="text-sm font-semibold text-blue-900">Facebook Page Integration</p>
            <p className="text-xs text-blue-600">Connect your Facebook Page to capture Messenger leads</p>
          </div>
        </div>
        <span className="text-blue-500 text-sm">{open ? '▲ Hide' : '▼ Setup guide'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-blue-100">
          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Step 1 — Backend environment</p>
            <p className="text-xs text-gray-600">Set these variables in your backend <code className="bg-white border border-gray-200 px-1 py-0.5 rounded text-xs">.env</code>:</p>
            <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400 space-y-1">
              <p>FB_PAGE_ACCESS_TOKEN=<span className="text-gray-400">your_page_token</span></p>
              <p>FB_APP_SECRET=<span className="text-gray-400">your_app_secret</span></p>
              <p>FB_WEBHOOK_VERIFY_TOKEN=<span className="text-gray-400">any_random_secret</span></p>
            </div>

            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mt-4">Step 2 — Meta App Dashboard</p>
            <p className="text-xs text-gray-600">
              In your{' '}
              <span className="font-medium text-gray-700">Meta for Developers → Your App → Messenger → Webhooks</span>,
              add a new webhook subscription:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-xs text-gray-700">
                <span className="text-blue-500 shrink-0">•</span>
                <div>
                  <span className="font-medium">Callback URL: </span>
                  <code className="bg-white border border-gray-200 px-1.5 py-0.5 rounded text-blue-700 break-all">{WEBHOOK_URL}</code>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs text-gray-700">
                <span className="text-blue-500 shrink-0">•</span>
                <span><span className="font-medium">Verify Token:</span> value of <code className="bg-white border border-gray-200 px-1 py-0.5 rounded">FB_WEBHOOK_VERIFY_TOKEN</code></span>
              </div>
              <div className="flex items-start gap-2 text-xs text-gray-700">
                <span className="text-blue-500 shrink-0">•</span>
                <span><span className="font-medium">Subscription fields:</span> <code className="bg-white border border-gray-200 px-1 py-0.5 rounded">messages</code>, <code className="bg-white border border-gray-200 px-1 py-0.5 rounded">messaging_postbacks</code></span>
              </div>
            </div>

            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mt-4">Step 3 — Subscribe your Page</p>
            <p className="text-xs text-gray-600">
              In Messenger settings, subscribe the webhook to your Facebook Page. Incoming messages will appear in the leads table below within seconds.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function FbLeadsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['fb-leads'],
    queryFn: () => fetchFbLeads().then((r) => r.data),
  });

  const leads = data ?? [];

  return (
    <Layout title="Facebook Page Leads">
      <div className="space-y-4">
        <IntegrationSetup />

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
              Follow the setup guide above to connect your Facebook Page webhook and start capturing messages.
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
