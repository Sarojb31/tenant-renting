import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

interface TenantBranding {
  name: string;
  logoUrl: string | null;
  themeColor: string | null;
  defaultCurrency: string;
}

function fetchBranding() {
  return api.get<TenantBranding>('/tenant-settings/branding');
}

function hexToRgb(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
    : null;
}

export function useTenantBranding() {
  const { data } = useQuery({
    queryKey: ['tenant-branding'],
    queryFn: () => fetchBranding().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!data?.themeColor) return;
    const rgb = hexToRgb(data.themeColor);
    if (!rgb) return;
    document.documentElement.style.setProperty('--color-brand', rgb);
  }, [data?.themeColor]);

  return data ?? null;
}
