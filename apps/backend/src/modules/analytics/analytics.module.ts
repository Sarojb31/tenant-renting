import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '@modules/listings/listing.entity';
import { Customer } from '@modules/customers/customer.entity';
import { Booking } from '@modules/payments/booking.entity';
import { Payment } from '@modules/payments/payment.entity';
import { SmsLog } from '@modules/matching/sms-log.entity';
import { TenantSubscription } from '@modules/subscriptions/tenant-subscription.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { CommonModule } from '@common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, Customer, Booking, Payment, SmsLog, TenantSubscription]),
    CommonModule,
  ],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
