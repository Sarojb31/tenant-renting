import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../common/tenant-context.service';
import { PaymentGateway } from '../../common/enums/payment-gateway.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { PayableType } from '../../common/enums/payable-type.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Booking } from './booking.entity';
import { Payment } from './payment.entity';
import { PaymentRoutingService } from './payment-routing.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly router: PaymentRoutingService,
    private readonly tenantCtx: TenantContextService,
  ) {}

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

    const payment = await this.paymentRepo.save({
      tenantId,
      payableType: PayableType.BOOKING,
      payableId: booking.id,
      gateway: dto.gateway,
      gatewayTransactionId: result.providerRef,
      amount: booking.amountDue,
      currency: 'NPR',
      status: PaymentStatus.PENDING,
      rawResponse: null,
    } as any);

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
      await this.bookingRepo.update(
        { id: payment.payableId },
        { status: BookingStatus.CONFIRMED, amountPaid: payment.amount },
      );
    }
  }
}
