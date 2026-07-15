import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PaymentsService } from './payments.service';
import { Booking } from './booking.entity';
import { Payment } from './payment.entity';
import { TenantSubscription } from '../subscriptions/tenant-subscription.entity';
import { SubscriptionPlan } from '../subscriptions/subscription-plan.entity';
import { PayableType } from '@common/enums/payable-type.enum';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { SubscriptionStatus } from '@common/enums/subscription-status.enum';
import { PaymentGateway } from '@common/enums/payment-gateway.enum';
import { PaymentRoutingService } from './payment-routing.service';

const mockAdapter = {
  createPaymentIntent: jest.fn().mockResolvedValue({ providerRef: 'ref-123', redirectUrl: 'http://pay.test' }),
  verifyWebhookSignature: jest.fn().mockReturnValue(true),
  handleWebhook: jest.fn().mockResolvedValue({ status: 'success', providerRef: 'ref-123' }),
};

const router = { resolveAdapter: jest.fn().mockReturnValue(mockAdapter) } as unknown as PaymentRoutingService;
const ctx = { getRequiredTenantId: () => 'tenant-1' };

function makePlan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    id: 'plan-1',
    name: 'basic',
    priceMonthly: 999,
    priceCurrency: 'NPR',
    smsCreditsIncluded: 100,
    maxListings: 50,
    maxStaffUsers: 3,
    features: {},
    ...overrides,
  } as unknown as SubscriptionPlan;
}

function makeSub(overrides: Partial<TenantSubscription> = {}): TenantSubscription {
  return {
    id: 'sub-1',
    tenantId: 'tenant-1',
    planId: 'plan-1',
    status: SubscriptionStatus.PAST_DUE,
    smsCreditsRemaining: 0,
    ...overrides,
  } as unknown as TenantSubscription;
}

function buildSvc(
  bookingRepo: Partial<Repository<Booking>>,
  paymentRepo: Partial<Repository<Payment>>,
  subRepo: Partial<Repository<TenantSubscription>>,
  planRepo: Partial<Repository<SubscriptionPlan>>,
): PaymentsService {
  return new PaymentsService(
    bookingRepo as unknown as Repository<Booking>,
    paymentRepo as unknown as Repository<Payment>,
    subRepo as unknown as Repository<TenantSubscription>,
    planRepo as unknown as Repository<SubscriptionPlan>,
    router,
    ctx as never,
  );
}

describe('PaymentsService.createSubscriptionIntent', () => {
  it('creates payment intent for existing subscription', async () => {
    const plan = makePlan();
    const sub = makeSub();
    const savedPayment = { id: 'payment-1' } as Payment;

    const svc = buildSvc(
      {},
      { save: jest.fn().mockResolvedValue(savedPayment), create: jest.fn().mockImplementation((x) => x) },
      { findOne: jest.fn().mockResolvedValue(sub), save: jest.fn().mockResolvedValue(sub) },
      { findOne: jest.fn().mockResolvedValue(plan) },
    );

    const result = await svc.createSubscriptionIntent('tenant-1', { planId: 'plan-1', gateway: PaymentGateway.STRIPE });
    expect(result.paymentId).toBe('payment-1');
    expect(result.providerRef).toBe('ref-123');
    expect(mockAdapter.createPaymentIntent).toHaveBeenCalledWith(999, 'NPR', expect.objectContaining({ orderName: 'basic Plan' }));
  });

  it('throws NotFoundException for unknown plan', async () => {
    const svc = buildSvc(
      {},
      {},
      { findOne: jest.fn().mockResolvedValue(null) },
      { findOne: jest.fn().mockResolvedValue(null) },
    );
    await expect(
      svc.createSubscriptionIntent('tenant-1', { planId: 'missing', gateway: PaymentGateway.STRIPE }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('PaymentsService.handleWebhookEvent — subscription payable', () => {
  it('activates subscription and resets SMS credits on success', async () => {
    const payment = {
      id: 'payment-1',
      payableType: PayableType.SUBSCRIPTION,
      payableId: 'sub-1',
      gateway: PaymentGateway.STRIPE,
      gatewayTransactionId: 'ref-123',
    } as Payment;
    const sub = makeSub({ status: SubscriptionStatus.PAST_DUE });
    const plan = makePlan({ smsCreditsIncluded: 100 });
    const saveSub = jest.fn().mockResolvedValue(sub);

    const svc = buildSvc(
      {},
      {
        findOne: jest.fn().mockResolvedValue(payment),
        save: jest.fn().mockResolvedValue(payment),
        create: jest.fn().mockImplementation((x) => x),
      },
      { findOne: jest.fn().mockResolvedValue(sub), save: saveSub },
      { findOne: jest.fn().mockResolvedValue(plan) },
    );

    await svc.handleWebhookEvent(
      PaymentGateway.STRIPE,
      {},
      Buffer.from('{}'),
      'sig',
    );

    const savedSub = saveSub.mock.calls[0][0] as TenantSubscription;
    expect(savedSub.status).toBe(SubscriptionStatus.ACTIVE);
    expect(savedSub.smsCreditsRemaining).toBe(100);
  });
});
