import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SMS_PROVIDER, SmsProvider } from '@modules/sms/sms.provider.interface';
import { SmsTemplate } from '@modules/sms/sms-template.entity';
import { SubscriptionsService } from '@modules/subscriptions/subscriptions.service';
import { Listing } from '@modules/listings/listing.entity';
import { Customer } from '@modules/customers/customer.entity';
import { CustomerPreference } from '@modules/customers/customer-preference.entity';
import { SmsLog } from './sms-log.entity';
import { SmsStatus } from '@common/enums/sms-status.enum';
import { SmsTemplateEvent } from '@common/enums/sms-template-event.enum';
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
    @InjectRepository(SmsTemplate)
    private readonly templateRepo: Repository<SmsTemplate>,
    private readonly subscriptions: SubscriptionsService,
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
      // bhkType: match if preference has no bhkType set, or it equals listing's
      .andWhere('(p.bhkType IS NULL OR p.bhkType = :bhkType)', { bhkType: listing.bhkType ?? null })
      // budget: each bound only applied when it's set
      .andWhere('(p.budgetMin IS NULL OR CAST(p.budgetMin AS numeric) <= :rent)', { rent: rentAmount })
      .andWhere('(p.budgetMax IS NULL OR CAST(p.budgetMax AS numeric) >= :rent)', { rent: rentAmount });

    return qb.getMany();
  }

  private renderTemplate(bodyText: string, listing: Listing): string {
    return bodyText
      .replace('{{title}}', listing.title)
      .replace('{{rentAmount}}', listing.rentAmount)
      .replace('{{city}}', listing.city ?? 'your area');
  }

  private async resolveTemplate(tenantId: string): Promise<{ id: string; body: string } | null> {
    const template =
      (await this.templateRepo.findOne({ where: { tenantId, eventTrigger: SmsTemplateEvent.NEW_MATCH } })) ??
      (await this.templateRepo.findOne({ where: { tenantId: undefined as never, eventTrigger: SmsTemplateEvent.NEW_MATCH } }));
    return template ? { id: template.id, body: template.bodyText } : null;
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

    // Deduct SMS credit before sending — skip if no credits remain
    const credited = await this.subscriptions.deductSmsCredit(listing.tenantId);
    if (!credited) {
      this.logger.warn(`SMS credit exhausted for tenant ${listing.tenantId} — skipping customer ${customer.id}`);
      return;
    }

    const tmpl = await this.resolveTemplate(listing.tenantId);
    const message = tmpl
      ? this.renderTemplate(tmpl.body, listing)
      : `New room available: "${listing.title}" for ${listing.rentAmount} in ${listing.city ?? 'your area'}. Reply STOP to opt out.`;

    const log = await this.smsLogRepo.save({
      tenantId: listing.tenantId,
      customerId: customer.id,
      listingId: listing.id,
      templateId: tmpl?.id ?? null,
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
      // Refund the credit since we consumed it but the send failed
      await this.smsLogRepo.manager
        .createQueryBuilder()
        .update('tenant_subscriptions')
        .set({ smsCreditsRemaining: () => 'sms_credits_remaining + 1' })
        .where('tenant_id = :tid', { tid: listing.tenantId })
        .execute();
    }
  }
}
