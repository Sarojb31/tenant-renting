import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PaymentProvider } from '../payment.provider.interface';

interface EsewaCallbackData {
  transaction_code: string;
  status: string;
  total_amount: string;
  transaction_uuid: string;
  product_code: string;
  signed_field_names: string;
  signature: string;
}

@Injectable()
export class EsewaAdapter implements PaymentProvider {
  private readonly merchantId: string;
  private readonly secret: string;

  constructor(private readonly config: ConfigService) {
    this.merchantId = config.get<string>('payments.esewa.merchantId') ?? '';
    this.secret = config.get<string>('payments.esewa.secret') ?? '';
  }

  async createPaymentIntent(
    amount: number,
    _currency: string,
    metadata: Record<string, unknown>,
  ): Promise<{ redirectUrl?: string; clientSecret?: string; providerRef: string }> {
    const transactionUuid = String(metadata.bookingId ?? crypto.randomUUID());
    const totalAmount = amount.toFixed(2);

    const signatureBase = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${this.merchantId}`;
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(signatureBase)
      .digest('base64');

    const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
    const params = new URLSearchParams({
      amount: totalAmount,
      tax_amount: '0',
      total_amount: totalAmount,
      transaction_uuid: transactionUuid,
      product_code: this.merchantId,
      product_service_charge: '0',
      product_delivery_charge: '0',
      success_url: `${appBaseUrl}/payments/callback/esewa`,
      failure_url: `${appBaseUrl}/payments/callback/esewa`,
      signed_field_names: 'total_amount,transaction_uuid,product_code',
      signature,
    });

    const baseUrl =
      process.env.NODE_ENV === 'production'
        ? 'https://epay.esewa.com.np/api/epay/main/v2/form'
        : 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';

    return {
      redirectUrl: `${baseUrl}?${params.toString()}`,
      providerRef: transactionUuid,
    };
  }

  verifyWebhookSignature(payload: unknown, _signature: string): boolean {
    const data = payload as EsewaCallbackData;
    const fields = (data.signed_field_names ?? '').split(',');
    const signatureBase = fields
      .map((f) => `${f}=${(data as unknown as Record<string, string>)[f] ?? ''}`)
      .join(',');
    const expected = crypto
      .createHmac('sha256', this.secret)
      .update(signatureBase)
      .digest('base64');
    return expected === data.signature;
  }

  async handleWebhook(
    payload: unknown,
  ): Promise<{ status: 'success' | 'failed'; providerRef: string }> {
    const data = payload as EsewaCallbackData;
    if (!this.verifyWebhookSignature(data, '')) {
      return { status: 'failed', providerRef: data.transaction_uuid ?? '' };
    }
    const status = data.status?.toUpperCase() === 'COMPLETE' ? 'success' : 'failed';
    return { status, providerRef: data.transaction_uuid ?? '' };
  }
}
