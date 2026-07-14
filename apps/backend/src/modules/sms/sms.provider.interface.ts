// Plan Section 16 — SmsProvider adapter interface
// Never call SMS gateway SDKs directly from business logic; always go through this interface.
export interface SmsProvider {
  send(
    to: string,
    message: string,
  ): Promise<{ providerMessageId: string; status: 'sent' | 'failed' }>;

  getDeliveryStatus?(
    providerMessageId: string,
  ): Promise<'delivered' | 'failed' | 'pending'>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
