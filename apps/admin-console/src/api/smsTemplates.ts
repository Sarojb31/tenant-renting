import { api } from './client';

export interface SmsTemplate {
  id: string;
  tenantId: string | null;
  name: string;
  bodyText: string;
  eventTrigger: 'new_match' | 'booking_confirmed' | 'rent_reminder' | 'custom';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateBody {
  name: string;
  bodyText: string;
  eventTrigger: SmsTemplate['eventTrigger'];
}

export const fetchSmsTemplates = () => api.get<SmsTemplate[]>('/sms-templates');

export const createSmsTemplate = (body: CreateTemplateBody) =>
  api.post<SmsTemplate>('/sms-templates', body);

export const updateSmsTemplate = (id: string, body: { name?: string; bodyText?: string }) =>
  api.patch<SmsTemplate>(`/sms-templates/${id}`, body);

export const deleteSmsTemplate = (id: string) => api.delete(`/sms-templates/${id}`);
