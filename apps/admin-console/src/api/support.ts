import { api } from './client';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  tenantId: string | null;
  raisedByUserId: string;
  subject: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export const fetchTickets = () => api.get<SupportTicket[]>('/support/tickets');

export const createTicket = (body: { subject: string; description: string }) =>
  api.post<SupportTicket>('/support/tickets', body);

export const updateTicketStatus = (id: string, status: TicketStatus) =>
  api.patch<SupportTicket>(`/support/tickets/${id}/status`, { status });
