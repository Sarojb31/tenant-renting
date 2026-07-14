import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EsewaAdapter } from './esewa.adapter';

function makeAdapter(overrides: Record<string, string> = {}): EsewaAdapter {
  const config = {
    get: (key: string) =>
      ({
        'payments.esewa.merchantId': 'EPAYTEST',
        'payments.esewa.secret': 'test-secret',
        ...overrides,
      }[key]),
  } as unknown as ConfigService;
  return new EsewaAdapter(config);
}

function makeSignature(fields: Record<string, string>, secret: string): string {
  const signed = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  return crypto.createHmac('sha256', secret).update(signed).digest('base64');
}

describe('EsewaAdapter', () => {
  it('createPaymentIntent returns redirectUrl with signed params', async () => {
    const adapter = makeAdapter();
    const result = await adapter.createPaymentIntent(5000, 'NPR', { bookingId: 'uuid-123' });
    expect(result.redirectUrl).toContain('rc-epay.esewa.com.np');
    expect(result.redirectUrl).toContain('EPAYTEST');
    expect(result.providerRef).toBe('uuid-123');
  });

  it('createPaymentIntent uses bookingId as transaction_uuid', async () => {
    const adapter = makeAdapter();
    const result = await adapter.createPaymentIntent(1000, 'NPR', { bookingId: 'my-booking' });
    expect(result.providerRef).toBe('my-booking');
    expect(result.redirectUrl).toContain('transaction_uuid=my-booking');
  });

  it('verifyWebhookSignature returns true for valid HMAC', () => {
    const adapter = makeAdapter();
    const payload = {
      transaction_code: 'TX-123',
      status: 'COMPLETE',
      total_amount: '5000.00',
      transaction_uuid: 'uuid-123',
      product_code: 'EPAYTEST',
      signed_field_names: 'transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names',
      signature: '',
    };
    payload.signature = makeSignature(
      {
        transaction_code: payload.transaction_code,
        status: payload.status,
        total_amount: payload.total_amount,
        transaction_uuid: payload.transaction_uuid,
        product_code: payload.product_code,
        signed_field_names: payload.signed_field_names,
      },
      'test-secret',
    );
    expect(adapter.verifyWebhookSignature(payload, '')).toBe(true);
  });

  it('verifyWebhookSignature returns false for tampered payload', () => {
    const adapter = makeAdapter();
    const payload = {
      transaction_code: 'TX-999',
      status: 'COMPLETE',
      total_amount: '9999.00',
      transaction_uuid: 'uuid-tampered',
      product_code: 'EPAYTEST',
      signed_field_names: 'transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names',
      signature: 'invalid-sig',
    };
    expect(adapter.verifyWebhookSignature(payload, '')).toBe(false);
  });

  it('handleWebhook returns success for COMPLETE status with valid HMAC', async () => {
    const adapter = makeAdapter();
    const payload = {
      transaction_code: 'TX-123',
      status: 'COMPLETE',
      total_amount: '5000.00',
      transaction_uuid: 'uuid-ok',
      product_code: 'EPAYTEST',
      signed_field_names: 'transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names',
      signature: '',
    };
    payload.signature = makeSignature(
      {
        transaction_code: payload.transaction_code,
        status: payload.status,
        total_amount: payload.total_amount,
        transaction_uuid: payload.transaction_uuid,
        product_code: payload.product_code,
        signed_field_names: payload.signed_field_names,
      },
      'test-secret',
    );
    const result = await adapter.handleWebhook(payload);
    expect(result.status).toBe('success');
    expect(result.providerRef).toBe('uuid-ok');
  });

  it('handleWebhook returns failed for invalid HMAC', async () => {
    const adapter = makeAdapter();
    const payload = {
      transaction_code: 'TX-bad',
      status: 'COMPLETE',
      total_amount: '1000.00',
      transaction_uuid: 'uuid-bad',
      product_code: 'EPAYTEST',
      signed_field_names: 'transaction_code,status',
      signature: 'wrong-sig',
    };
    const result = await adapter.handleWebhook(payload);
    expect(result.status).toBe('failed');
  });
});
