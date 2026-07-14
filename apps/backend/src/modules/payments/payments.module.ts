import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../../common/common.module';
import { Listing } from '../listings/listing.entity';
import { Booking } from './booking.entity';
import { Payment } from './payment.entity';
import { StripeAdapter } from './adapters/stripe.adapter';
import { EsewaAdapter } from './adapters/esewa.adapter';
import { KhaltiAdapter } from './adapters/khalti.adapter';
import { PaymentRoutingService } from './payment-routing.service';
import { BookingsService } from './bookings.service';
import { PaymentsService } from './payments.service';
import { BookingsController } from './bookings.controller';
import { PaymentsController } from './payments.controller';
import { PAYMENT_PROVIDER } from './payment.provider.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Payment, Listing]),
    ConfigModule,
    CommonModule,
  ],
  providers: [
    StripeAdapter,
    EsewaAdapter,
    KhaltiAdapter,
    PaymentRoutingService,
    BookingsService,
    PaymentsService,
    { provide: PAYMENT_PROVIDER, useClass: PaymentRoutingService },
  ],
  controllers: [BookingsController, PaymentsController],
  exports: [BookingsService, PaymentsService],
})
export class PaymentsModule {}
