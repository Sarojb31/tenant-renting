// Matches PaymentProvider interface in backend (Plan Section 16)
export interface PaymentProvider {
  createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, unknown>,
  ): Promise<{ redirectUrl?: string; clientSecret?: string; providerRef: string }>;
  verifyWebhookSignature(payload: unknown, signature: string): boolean;
  handleWebhook(payload: unknown): Promise<{ status: 'success' | 'failed'; providerRef: string }>;
}
