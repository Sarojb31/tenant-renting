import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../common/tenant-context.service';
import { PaymentGateway } from '../../common/enums/payment-gateway.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { PayableType } from '../../common/enums/payable-type.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { Booking } from './booking.entity';
import { Payment } from './payment.entity';
import { TenantSubscription } from '../subscriptions/tenant-subscription.entity';
import { SubscriptionPlan } from '../subscriptions/subscription-plan.entity';
import { PaymentRoutingService } from './payment-routing.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateSubscriptionIntentDto } from './dto/create-subscription-intent.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(TenantSubscription)
    private readonly subRepo: Repository<TenantSubscription>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
    private readonly router: PaymentRoutingService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async findAll(
    page: number,
    limit: number,
    tenantId?: string | null,
  ): Promise<{ data: Payment[]; total: number; page: number; limit: number }> {
    const where = tenantId ? { tenantId } : {};
    const [data, total] = await this.paymentRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async createIntent(
    customerId: string,
    dto: CreatePaymentIntentDto,
  ): Promise<{ paymentId: string; redirectUrl?: string; clientSecret?: string; providerRef: string }> {
    const tenantId = this.tenantCtx.getRequiredTenantId();

    const booking = await this.bookingRepo.findOne({
      where: { id: dto.bookingId, tenantId, customerId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const adapter = this.router.resolveAdapter(dto.gateway);
    const result = await adapter.createPaymentIntent(
      parseFloat(booking.amountDue),
      'NPR',
      { bookingId: booking.id, orderName: 'Room Booking' },
    );

    const payment = await this.paymentRepo.save(this.paymentRepo.create({
      tenantId,
      payableType: PayableType.BOOKING,
      payableId: booking.id,
      gateway: dto.gateway,
      gatewayTransactionId: result.providerRef,
      amount: booking.amountDue,
      currency: 'NPR',
      status: PaymentStatus.PENDING,
      rawResponse: null,
    }));

    return { paymentId: payment.id, ...result };
  }

  // Subscription payment intent — company admin initiates plan payment (Plan §4.8)
  async createSubscriptionIntent(
    tenantId: string,
    dto: CreateSubscriptionIntentDto,
  ): Promise<{ paymentId: string; redirectUrl?: string; clientSecret?: string; providerRef: string }> {
    const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    // Upsert the subscription record (pending payment)
    let sub = await this.subRepo.findOne({ where: { tenantId } });
    const now = new Date();
    if (sub) {
      sub.planId = plan.id;
      sub.plan = plan;
      sub.status = SubscriptionStatus.PAST_DUE;
      sub = await this.subRepo.save(sub);
    } else {
      sub = await this.subRepo.save({
        tenantId,
        planId: plan.id,
        plan,
        status: SubscriptionStatus.PAST_DUE,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        smsCreditsRemaining: 0,
      } as TenantSubscription);
    }

    const adapter = this.router.resolveAdapter(dto.gateway);
    const amount = parseFloat(plan.priceMonthly as unknown as string);
    const result = await adapter.createPaymentIntent(
      amount,
      plan.priceCurrency,
      { subscriptionId: sub.id, orderName: `${plan.name} Plan` },
    );

    const payment = await this.paymentRepo.save(this.paymentRepo.create({
      tenantId,
      payableType: PayableType.SUBSCRIPTION,
      payableId: sub.id,
      gateway: dto.gateway,
      gatewayTransactionId: result.providerRef,
      amount: String(amount),
      currency: plan.priceCurrency,
      status: PaymentStatus.PENDING,
      rawResponse: null,
    }));

    return { paymentId: payment.id, ...result };
  }

  async handleWebhookEvent(
    gateway: PaymentGateway,
    payload: unknown,
    rawBody: Buffer,
    signature: string,
  ): Promise<void> {
    const adapter = this.router.resolveAdapter(gateway);

    let verified: boolean;
    try {
      verified = adapter.verifyWebhookSignature(rawBody, signature);
    } catch {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    if (!verified) throw new UnauthorizedException('Invalid webhook signature');

    const { status, providerRef } = await adapter.handleWebhook(payload);

    const payment = await this.paymentRepo.findOne({
      where: { gatewayTransactionId: providerRef, gateway },
    });
    if (!payment) return;

    payment.status = status === 'success' ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;
    payment.rawResponse = payload as Record<string, unknown>;
    await this.paymentRepo.save(payment);

    if (status === 'success') {
      if (payment.payableType === PayableType.BOOKING) {
        await this.bookingRepo.update(
          { id: payment.payableId },
          { status: BookingStatus.CONFIRMED, amountPaid: payment.amount },
        );
      } else if (payment.payableType === PayableType.SUBSCRIPTION) {
        const sub = await this.subRepo.findOne({ where: { id: payment.payableId } });
        if (sub) {
          const plan = await this.planRepo.findOne({ where: { id: sub.planId } });
          const now = new Date();
          sub.status = SubscriptionStatus.ACTIVE;
          sub.currentPeriodStart = now;
          sub.currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          if (plan) sub.smsCreditsRemaining = plan.smsCreditsIncluded;
          await this.subRepo.save(sub);
        }
      }
    }
  }
}
