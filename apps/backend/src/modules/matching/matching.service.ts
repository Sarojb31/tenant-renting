import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SMS_PROVIDER, SmsProvider } from '@modules/sms/sms.provider.interface';
import { Listing } from '@modules/listings/listing.entity';
import { Customer } from '@modules/customers/customer.entity';
import { CustomerPreference } from '@modules/customers/customer-preference.entity';
import { SmsLog } from './sms-log.entity';
import { SmsStatus } from '@common/enums/sms-status.enum';
import { ListingStatus } from '@common/enums/listing-status.enum';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CustomerPreference)
    private readonly prefRepo: Repository<CustomerPreference>,
    @InjectRepository(SmsLog)
    private readonly smsLogRepo: Repository<SmsLog>,
    @Inject(SMS_PROVIDER)
    private readonly smsProvider: SmsProvider,
  ) {}

  // Runs as background job — tenantId passed explicitly (no ALS context in worker).
  async triggerMatchForListing(listingId: string, tenantId: string): Promise<void> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId, tenantId, status: ListingStatus.PUBLISHED },
    });
    if (!listing) {
      this.logger.warn(`Matching skipped: listing ${listingId} not found or not published`);
      return;
    }

    const preferences = await this.findMatchingPreferences(listing);
    if (!preferences.length) return;

    const customerIds = preferences.map((p) => p.customerId);
    const customers = await this.customerRepo
      .createQueryBuilder('c')
      .where('c.id IN (:...ids)', { ids: customerIds })
      .andWhere('c.smsOptIn = true')
      .getMany();

    for (const customer of customers) {
      await this.sendMatchSms(customer, listing);
    }
  }

  private async findMatchingPreferences(listing: Listing): Promise<CustomerPreference[]> {
    const rentAmount = parseFloat(listing.rentAmount);

    const qb = this.prefRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId: listing.tenantId })
      .andWhere('p.active = true')
      // roomType: match if preference has no roomType set, or it equals listing's
      .andWhere('(p.roomType IS NULL OR p.roomType = :roomType)', { roomType: listing.roomType })
      // budget: each bound only applied when it's set
      .andWhere('(p.budgetMin IS NULL OR CAST(p.budgetMin AS numeric) <= :rent)', { rent: rentAmount })
      .andWhere('(p.budgetMax IS NULL OR CAST(p.budgetMax AS numeric) >= :rent)', { rent: rentAmount });

    return qb.getMany();
  }

  private async sendMatchSms(customer: Customer, listing: Listing): Promise<void> {
    // Idempotency: skip if already sent for this (customer, listing) pair — Plan §4.6 retry safety
    const alreadySent = await this.smsLogRepo.findOne({
      where: { customerId: customer.id, listingId: listing.id, status: SmsStatus.SENT },
    });
    if (alreadySent) {
      this.logger.debug(`Skipping duplicate SMS for customer ${customer.id} listing ${listing.id}`);
      return;
    }

    const message = `New room available: "${listing.title}" for ${listing.rentAmount} in ${listing.city ?? 'your area'}. Reply STOP to opt out.`;
    const log = await this.smsLogRepo.save({
      tenantId: listing.tenantId,
      customerId: customer.id,
      listingId: listing.id,
      messageBody: message,
      status: SmsStatus.QUEUED,
    });

    try {
      const result = await this.smsProvider.send(customer.phone, message);
      await this.smsLogRepo.update(log.id, {
        status: SmsStatus.SENT,
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
      });
    } catch (err) {
      this.logger.error(`SMS failed for customer ${customer.id}: ${String(err)}`);
      await this.smsLogRepo.update(log.id, { status: SmsStatus.FAILED });
    }
  }
}
