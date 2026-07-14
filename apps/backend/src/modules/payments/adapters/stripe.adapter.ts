import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentProvider } from '../payment.provider.interface';

@Injectable()
export class StripeAdapter implements PaymentProvider {
  private readonly client: Stripe;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    this.client = new Stripe(config.get<string>('payments.stripe.secretKey') ?? '', {
      apiVersion: '2026-06-24.dahlia',
    });
    this.webhookSecret = config.get<string>('payments.stripe.webhookSecret') ?? '';
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, unknown>,
  ): Promise<{ redirectUrl?: string; clientSecret?: string; providerRef: string }> {
    const pi = await this.client.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      metadata: { bookingId: String(metadata.bookingId ?? '') },
    });
    return { clientSecret: pi.client_secret ?? undefined, providerRef: pi.id };
  }

  verifyWebhookSignature(payload: unknown, signature: string): boolean {
    this.client.webhooks.constructEvent(
      payload as Buffer,
      signature,
      this.webhookSecret,
    );
    return true;
  }

  async handleWebhook(
    payload: unknown,
  ): Promise<{ status: 'success' | 'failed'; providerRef: string }> {
    const event = payload as Stripe.Event;
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      return { status: 'success', providerRef: pi.id };
    }
    if (
      event.type === 'payment_intent.payment_failed' ||
      event.type === 'payment_intent.canceled'
    ) {
      const pi = event.data.object as Stripe.PaymentIntent;
      return { status: 'failed', providerRef: pi.id };
    }
    return { status: 'failed', providerRef: '' };
  }
}
