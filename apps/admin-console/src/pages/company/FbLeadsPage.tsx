import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { DataTable } from '../../components/DataTable';
import {
  fetchFbLeads,
  getFbStatus,
  connectByoApp,
  disconnectFacebook,
  getFbOAuthUrl,
  type FbPageLead,
  type ByoConnectDto,
} from '../../api/facebook';

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

// ─── BYO-app form ─────────────────────────────────────────────────────────────

const EMPTY_BYO: ByoConnectDto = {
  pageId: '',
  pageName: '',
  pageAccessToken: '',
  appId: '',
  appSecret: '',
};

function ByoForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState<ByoConnectDto>(EMPTY_BYO);
  const [formError, setFormError] = useState('');

  const mutation = useMutation({
    mutationFn: connectByoApp,
    onSuccess: () => { setForm(EMPTY_BYO); onSuccess(); },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Connection failed.';
      setFormError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    },
  });

  const field = (label: string, key: keyof ByoConnectDto, type = 'text', placeholder = '') => (
    <div key={key}>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setFormError('');
        mutation.mutate(form);
      }}
      className="mt-4 space-y-3"
    >
      {formError && (
        <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded px-3 py-2">{formError}</p>
      )}
      {field('Facebook Page ID', 'pageId', 'text', '123456789012345')}
      {field('Page Name', 'pageName', 'text', 'My Property Page')}
      {field('Page Access Token', 'pageAccessToken', 'password', 'EAABxxxx…')}
      {field('App ID', 'appId', 'text', 'Your Meta App ID')}
      {field('App Secret', 'appSecret', 'password', 'Your Meta App Secret')}
      <p className="text-xs text-gray-500 leading-relaxed">
        Get these from{' '}
        <span className="font-medium text-gray-700">Meta for Developers → Your App → Settings → Basic</span>
        {' '}and{' '}
        <span className="font-medium text-gray-700">Messenger → Settings → Page Access Token</span>.
        Your App Secret is encrypted at rest and never exposed via this API.
      </p>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {mutation.isPending ? 'Connecting…' : 'Connect BYO App'}
      </button>
    </form>
  );
}

// ─── Connected state ──────────────────────────────────────────────────────────

function ConnectedPanel({
  pageName,
  pageId,
  method,
  onDisconnect,
}: {
  pageName: string;
  pageId: string;
  method: 'oauth_shared_app' | 'byo_app';
  onDisconnect: () => void;
}) {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <p className="text-sm font-semibold text-green-900">Facebook Page Connected</p>
          <p className="text-sm text-green-700 font-medium">{pageName}</p>
          <p className="text-xs text-green-600 font-mono mt-0.5">{pageId}</p>
          <span className={`inline-flex mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            method === 'oauth_shared_app'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {method === 'oauth_shared_app' ? 'OAuth (shared app)' : 'BYO App'}
          </span>
        </div>
      </div>
      <button
        onClick={onDisconnect}
        className="text-xs text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg shrink-0"
      >
        Disconnect
      </button>
    </div>
  );
}

// ─── Disconnected / connect flow ──────────────────────────────────────────────

function ConnectPanel({ onConnected }: { onConnected: () => void }) {
  const [showByo, setShowByo] = useState(false);
  const oauthUrl = getFbOAuthUrl();

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xl">📘</span>
        <div>
          <p className="text-sm font-semibold text-blue-900">Connect Your Facebook Page</p>
          <p className="text-xs text-blue-600">
            Receive Messenger leads from your Page inbox directly in this dashboard.
          </p>
        </div>
      </div>

      {/* OAuth option (primary) */}
      <div className="bg-white rounded-lg border border-blue-200 p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-800">Connect with Facebook Login</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Authorize via your Facebook account. Recommended — no credentials to manage.
          </p>
        </div>
        <a
          href={oauthUrl}
          className="inline-flex items-center gap-2 bg-[#1877F2] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#166FE5] transition-colors"
        >
          <span>f</span>
          Continue with Facebook
        </a>
      </div>

      {/* BYO-app option (secondary) */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
        <button
          onClick={() => setShowByo((b) => !b)}
          className="flex items-center justify-between w-full text-left"
        >
          <div>
            <p className="text-sm font-medium text-gray-700">Use your own Meta App</p>
            <p className="text-xs text-gray-400 mt-0.5">
              For companies that manage their own Meta App and prefer not to authorize a shared connector.
            </p>
          </div>
          <span className="text-xs text-gray-500 ml-4 shrink-0">{showByo ? '▲ Hide' : '▼ Show'}</span>
        </button>
        {showByo && <ByoForm onSuccess={onConnected} />}
      </div>

      {/* Webhook info for BYO-app setup */}
      {showByo && (
        <details className="rounded-lg border border-gray-200 bg-white">
          <summary className="px-4 py-3 text-xs font-medium text-gray-600 cursor-pointer hover:text-gray-800">
            Webhook configuration for your Meta App
          </summary>
          <div className="px-4 pb-4 space-y-2 text-xs text-gray-600">
            <p>In <span className="font-medium">Meta for Developers → Your App → Messenger → Settings → Webhooks</span>:</p>
            <div className="bg-gray-900 text-green-400 font-mono rounded p-3 space-y-1">
              <p>Callback URL: {(import.meta.env.VITE_API_URL ?? '/api').replace(/\/api$/, '')}/facebook/webhook</p>
              <p>Verify Token: <span className="text-gray-400">(your FB_WEBHOOK_VERIFY_TOKEN env var)</span></p>
              <p>Fields: messages, messaging_postbacks</p>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function FbLeadsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const [oauthMsg, setOauthMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Handle OAuth callback query params
  useEffect(() => {
    const connected = searchParams.get('connected');
    const pageName = searchParams.get('pageName');
    const error = searchParams.get('error');
    if (connected === 'true') {
      setOauthMsg({ type: 'success', text: `Facebook Page "${pageName ?? ''}" connected successfully.` });
      qc.invalidateQueries({ queryKey: ['fb-status'] });
      setSearchParams({}, { replace: true });
    } else if (error) {
      setOauthMsg({ type: 'error', text: `Facebook connection failed: ${error}` });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, qc, setSearchParams]);

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['fb-status'],
    queryFn: () => getFbStatus().then((r) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['fb-leads'],
    queryFn: () => fetchFbLeads().then((r) => r.data),
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectFacebook,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fb-status'] }),
  });

  const leads = data ?? [];
  const conn = statusData?.connection;

  return (
    <Layout title="Facebook Page Leads">
      <div className="space-y-4">

        {/* OAuth callback flash message */}
        {oauthMsg && (
          <div className={`rounded-lg border px-4 py-3 text-sm flex items-start justify-between gap-3 ${
            oauthMsg.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <span>{oauthMsg.text}</span>
            <button onClick={() => setOauthMsg(null)} className="text-xs opacity-60 hover:opacity-100 shrink-0">✕</button>
          </div>
        )}

        {/* Connection panel */}
        {statusLoading ? (
          <div className="rounded-xl border border-gray-100 bg-white px-5 py-4 text-sm text-gray-400">
            Checking Facebook connection…
          </div>
        ) : statusData?.connected && conn ? (
          <ConnectedPanel
            pageName={conn.fbPageName}
            pageId={conn.fbPageId}
            method={conn.connectionMethod}
            onDisconnect={() => disconnectMutation.mutate()}
          />
        ) : (
          <ConnectPanel onConnected={() => qc.invalidateQueries({ queryKey: ['fb-status'] })} />
        )}

        {/* Leads table */}
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
              Connect your Facebook Page above. Once connected, Messenger messages appear here automatically.
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
