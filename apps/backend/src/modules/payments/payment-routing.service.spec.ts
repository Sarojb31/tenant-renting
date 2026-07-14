import { ConfigService } from '@nestjs/config';
import { PaymentRoutingService } from './payment-routing.service';
import { StripeAdapter } from './adapters/stripe.adapter';
import { EsewaAdapter } from './adapters/esewa.adapter';
import { KhaltiAdapter } from './adapters/khalti.adapter';
import { PaymentGateway } from '../../common/enums/payment-gateway.enum';

jest.mock('stripe', () => jest.fn(() => ({
  paymentIntents: { create: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
})));
jest.mock('axios');

function makeConfig(): ConfigService {
  return { get: () => undefined } as unknown as ConfigService;
}

function makeRouter(): PaymentRoutingService {
  const config = makeConfig();
  return new PaymentRoutingService(
    new StripeAdapter(config),
    new EsewaAdapter(config),
    new KhaltiAdapter(config),
  );
}

describe('PaymentRoutingService.resolveAdapter', () => {
  it('routes stripe → StripeAdapter', () => {
    expect(makeRouter().resolveAdapter(PaymentGateway.STRIPE)).toBeInstanceOf(StripeAdapter);
  });

  it('routes esewa → EsewaAdapter', () => {
    expect(makeRouter().resolveAdapter(PaymentGateway.ESEWA)).toBeInstanceOf(EsewaAdapter);
  });

  it('routes khalti → KhaltiAdapter', () => {
    expect(makeRouter().resolveAdapter(PaymentGateway.KHALTI)).toBeInstanceOf(KhaltiAdapter);
  });

  it('falls back to StripeAdapter for unknown gateway', () => {
    const router = makeRouter();
    expect(router.resolveAdapter('fonepay' as PaymentGateway)).toBeInstanceOf(StripeAdapter);
  });
});
