import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PaymentProvider } from '../payment.provider.interface';

interface KhaltiInitiateResponse {
  pidx: string;
  payment_url: string;
}

interface KhaltiWebhookPayload {
  pidx: string;
  status?: string;
}

interface KhaltiLookupResponse {
  pidx: string;
  status: string;
  transaction_id: string;
}

@Injectable()
export class KhaltiAdapter implements PaymentProvider {
  private readonly secretKey: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.secretKey = config.get<string>('payments.khalti.secretKey') ?? '';
    this.baseUrl =
      process.env.NODE_ENV === 'production'
        ? 'https://khalti.com'
        : 'https://a.khalti.com';
  }

  async createPaymentIntent(
    amount: number,
    _currency: string,
    metadata: Record<string, unknown>,
  ): Promise<{ redirectUrl?: string; clientSecret?: string; providerRef: string }> {
    const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
    const { data } = await axios.post<KhaltiInitiateResponse>(
      `${this.baseUrl}/api/v2/epayment/initiate/`,
      {
        return_url: `${appBaseUrl}/payments/callback/khalti`,
        website_url: appBaseUrl,
        amount: Math.round(amount * 100),
        purchase_order_id: String(metadata.bookingId ?? ''),
        purchase_order_name: String(metadata.orderName ?? 'RoomFinder Booking'),
      },
      { headers: { Authorization: `Key ${this.secretKey}` } },
    );
    return { redirectUrl: data.payment_url, providerRef: data.pidx };
  }

  verifyWebhookSignature(_payload: unknown, _signature: string): boolean {
    // Khalti webhooks have no HMAC signature — verified server-side via lookup API in handleWebhook.
    return true;
  }

  async handleWebhook(
    payload: unknown,
  ): Promise<{ status: 'success' | 'failed'; providerRef: string }> {
    const body = payload as KhaltiWebhookPayload;
    const { data } = await axios.post<KhaltiLookupResponse>(
      `${this.baseUrl}/api/v2/epayment/lookup/`,
      { pidx: body.pidx },
      { headers: { Authorization: `Key ${this.secretKey}` } },
    );
    const status = data.status === 'Completed' ? 'success' : 'failed';
    return { status, providerRef: data.pidx };
  }
}
