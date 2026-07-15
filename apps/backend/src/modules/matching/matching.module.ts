import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Listing } from '@modules/listings/listing.entity';
import { Customer } from '@modules/customers/customer.entity';
import { CustomerPreference } from '@modules/customers/customer-preference.entity';
import { SmsLog } from './sms-log.entity';
import { SmsTemplate } from '@modules/sms/sms-template.entity';
import { MatchingService } from './matching.service';
import { MatchingProcessor, MATCHING_QUEUE } from './matching.processor';
import { SmsModule } from '@modules/sms/sms.module';
import { SubscriptionsModule } from '@modules/subscriptions/subscriptions.module';

// Implements: Plan Section 4.5 (Matching Engine) and §4.6 SMS log
@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, Customer, CustomerPreference, SmsLog, SmsTemplate]),
    BullModule.registerQueue({ name: MATCHING_QUEUE }),
    SmsModule,
    SubscriptionsModule,
  ],
  providers: [MatchingService, MatchingProcessor],
  exports: [MatchingService, BullModule],
})
export class MatchingModule {}
