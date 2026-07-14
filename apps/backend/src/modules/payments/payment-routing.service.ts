import { Injectable } from '@nestjs/common';
import { PaymentGateway } from '../../common/enums/payment-gateway.enum';
import { PaymentProvider } from './payment.provider.interface';
import { StripeAdapter } from './adapters/stripe.adapter';
import { EsewaAdapter } from './adapters/esewa.adapter';
import { KhaltiAdapter } from './adapters/khalti.adapter';

@Injectable()
export class PaymentRoutingService {
  constructor(
    private readonly stripe: StripeAdapter,
    private readonly esewa: EsewaAdapter,
    private readonly khalti: KhaltiAdapter,
  ) {}

  resolveAdapter(gateway: PaymentGateway): PaymentProvider {
    switch (gateway) {
      case PaymentGateway.STRIPE:
        return this.stripe;
      case PaymentGateway.ESEWA:
        return this.esewa;
      case PaymentGateway.KHALTI:
        return this.khalti;
      default:
        return this.stripe;
    }
  }
}
