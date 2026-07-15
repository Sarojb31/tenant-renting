import { api } from './client';

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
