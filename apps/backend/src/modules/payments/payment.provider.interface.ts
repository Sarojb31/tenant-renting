// Plan Section 16 — PaymentProvider adapter interface
// Never call payment gateway SDKs directly from business logic; always go through this interface.
export interface PaymentProvider {
  createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, unknown>,
  ): Promise<{
    redirectUrl?: string;
    clientSecret?: string;
    providerRef: string;
  }>;

  verifyWebhookSignature(payload: unknown, signature: string): boolean;

  handleWebhook(
    payload: unknown,
  ): Promise<{ status: 'success' | 'failed'; providerRef: string }>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
