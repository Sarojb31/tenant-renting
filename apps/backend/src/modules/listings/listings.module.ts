import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Listing } from './listing.entity';
import { ListingImage } from './listing-image.entity';
import { Booking } from '@modules/payments/booking.entity';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { CommonModule } from '@common/common.module';
import { StorageModule } from '@modules/storage/storage.module';
import { MATCHING_QUEUE } from '@modules/matching/matching.processor';
import { AmenitiesModule } from '@modules/amenities/amenities.module';
import { SubscriptionsModule } from '@modules/subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, ListingImage, Booking]),
    BullModule.registerQueue({ name: MATCHING_QUEUE }),
    CommonModule,
    StorageModule,
    AmenitiesModule,
    SubscriptionsModule,
  ],
  providers: [ListingsService],
  controllers: [ListingsController],
  exports: [ListingsService, TypeOrmModule],
})
export class ListingsModule {}
