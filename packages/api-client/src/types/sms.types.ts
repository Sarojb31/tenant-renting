// Matches SmsProvider interface in backend (Plan Section 16)
export interface SmsProvider {
  send(to: string, message: string): Promise<{ providerMessageId: string; status: 'sent' | 'failed' }>;
  getDeliveryStatus?(providerMessageId: string): Promise<'delivered' | 'failed' | 'pending'>;
}
