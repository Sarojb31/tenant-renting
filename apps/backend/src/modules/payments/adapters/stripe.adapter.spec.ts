import { ConfigService } from '@nestjs/config';

const mockCreate = jest.fn();
const mockConstructEvent = jest.fn();
jest.mock('stripe', () => {
  return jest.fn(() => ({
    paymentIntents: { create: mockCreate },
    webhooks: { constructEvent: mockConstructEvent },
  }));
});

import { StripeAdapter } from './stripe.adapter';

function makeAdapter(): StripeAdapter {
  const config = {
    get: (key: string) =>
      ({
        'payments.stripe.secretKey': 'sk_test_xxx',
        'payments.stripe.webhookSecret': 'whsec_test',
      }[key]),
  } as unknown as ConfigService;
  return new StripeAdapter(config);
}

describe('StripeAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('createPaymentIntent returns clientSecret and providerRef', async () => {
    mockCreate.mockResolvedValue({ id: 'pi_test123', client_secret: 'pi_test123_secret' });
    const adapter = makeAdapter();
    const result = await adapter.createPaymentIntent(5000, 'NPR', { bookingId: 'booking-uuid' });
    expect(result.clientSecret).toBe('pi_test123_secret');
    expect(result.providerRef).toBe('pi_test123');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500000, currency: 'npr' }),
    );
  });

  it('createPaymentIntent converts amount to cents (×100)', async () => {
    mockCreate.mockResolvedValue({ id: 'pi_x', client_secret: 'cs' });
    const adapter = makeAdapter();
    await adapter.createPaymentIntent(12.5, 'USD', {});
    expect(mockCreate.mock.calls[0][0].amount).toBe(1250);
  });

  it('createPaymentIntent throws when Stripe SDK throws', async () => {
    mockCreate.mockRejectedValue(new Error('Card declined'));
    const adapter = makeAdapter();
    await expect(adapter.createPaymentIntent(1000, 'NPR', {})).rejects.toThrow('Card declined');
  });

  it('verifyWebhookSignature delegates to stripe.webhooks.constructEvent', () => {
    mockConstructEvent.mockReturnValue({ type: 'payment_intent.succeeded' });
    const adapter = makeAdapter();
    const result = adapter.verifyWebhookSignature(Buffer.from('{}'), 't=123,v1=abc');
    expect(result).toBe(true);
    expect(mockConstructEvent).toHaveBeenCalledTimes(1);
  });

  it('verifyWebhookSignature throws when signature invalid', () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });
    const adapter = makeAdapter();
    expect(() => adapter.verifyWebhookSignature(Buffer.from('{}'), 'bad-sig')).toThrow(
      'No signatures found',
    );
  });

  it('handleWebhook returns success for payment_intent.succeeded', async () => {
    const adapter = makeAdapter();
    const event = {
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_abc' } },
    };
    const result = await adapter.handleWebhook(event);
    expect(result.status).toBe('success');
    expect(result.providerRef).toBe('pi_abc');
  });

  it('handleWebhook returns failed for payment_intent.payment_failed', async () => {
    const adapter = makeAdapter();
    const event = {
      type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_fail' } },
    };
    const result = await adapter.handleWebhook(event);
    expect(result.status).toBe('failed');
    expect(result.providerRef).toBe('pi_fail');
  });
});
