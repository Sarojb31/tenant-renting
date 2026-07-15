import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth.store';

interface BrandingSettings {
  logoUrl?: string;
  themeColor?: string;
  name?: string;
}

function fetchTenantSettings(tenantId: string) {
  return api.get<BrandingSettings>(`/tenants/${tenantId}`);
}

function updateTenantSettings(tenantId: string, body: BrandingSettings) {
  return api.patch<BrandingSettings>(`/tenants/${tenantId}`, body);
}

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#06B6D4', '#6366F1',
];

export function BrandingPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const tenantId = user?.tenantId ?? '';

  const { data: settings, isLoading } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => fetchTenantSettings(tenantId).then((r) => r.data),
    enabled: !!tenantId,
  });

  const [logoUrl, setLogoUrl] = useState('');
  const [themeColor, setThemeColor] = useState('#3B82F6');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setLogoUrl(settings.logoUrl ?? '');
      setThemeColor(settings.themeColor ?? '#3B82F6');
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: () =>
      updateTenantSettings(tenantId, {
        logoUrl: logoUrl.trim() || undefined,
        themeColor: themeColor || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tenant', tenantId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (isLoading) {
    return <Layout title="Branding"><p className="text-gray-400 text-sm">Loading…</p></Layout>;
  }

  return (
    <Layout title="Branding">
      <div className="max-w-lg space-y-6">
        <p className="text-sm text-gray-500">
          Customize how your tenant portal looks to customers. Changes apply immediately on save.
        </p>

        {/* Logo URL */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Logo URL</label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://yourcompany.com/logo.png"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo preview"
              className="h-12 object-contain rounded border border-gray-100 bg-gray-50 p-1"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>

        {/* Theme color */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Theme Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              placeholder="#3B82F6"
              className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setThemeColor(c)}
                style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${themeColor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div
            className="h-2"
            style={{ backgroundColor: themeColor }}
          />
          <div className="p-4 bg-white space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Preview</p>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-8 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div
                  className="font-bold text-lg"
                  style={{ color: themeColor }}
                >
                  {settings?.name ?? 'RoomFinder'}
                </div>
              )}
            </div>
            <button
              style={{ backgroundColor: themeColor }}
              className="text-white text-xs px-3 py-1.5 rounded-lg font-medium"
            >
              Book This Room
            </button>
          </div>
        </div>

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="bg-brand-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
        >
          {save.isPending ? 'Saving…' : saved ? 'Saved!' : 'Save Branding'}
        </button>
      </div>
    </Layout>
  );
}
