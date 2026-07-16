import { api } from './client';

// ─── Leads ────────────────────────────────────────────────────────────────────

export interface FbPageLead {
  id: string;
  tenantId: string;
  fbPageId: string;
  fbSenderPsid: string;
  messageText: string;
  matchedCustomerId: string | null;
  createdAt: string;
}

export const fetchFbLeads = () => api.get<FbPageLead[]>('/facebook/leads');

// ─── Connection ───────────────────────────────────────────────────────────────

export interface FbConnectionInfo {
  fbPageId: string;
  fbPageName: string;
  connectionMethod: 'oauth_shared_app' | 'byo_app';
  connectedAt: string;
}

export interface FbConnectionStatus {
  connected: boolean;
  connection?: FbConnectionInfo;
}

export const getFbStatus = () => api.get<FbConnectionStatus>('/facebook/status');

export interface ByoConnectDto {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  appId: string;
  appSecret: string;
}

export const connectByoApp = (body: ByoConnectDto) =>
  api.post<FbConnectionStatus>('/facebook/connect/byo-app', body);

export const disconnectFacebook = () => api.delete('/facebook/connect');

/** Returns the URL to initiate Facebook OAuth (browser navigates there) */
export const getFbOAuthUrl = (): string => {
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
  return `${base}/facebook/connect`;
};
