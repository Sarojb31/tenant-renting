import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Listing } from '@modules/listings/listing.entity';
import { Customer } from '@modules/customers/customer.entity';
import { Booking } from '@modules/payments/booking.entity';
import { Payment } from '@modules/payments/payment.entity';
import { SmsLog } from '@modules/matching/sms-log.entity';
import { TenantSubscription } from '@modules/subscriptions/tenant-subscription.entity';
import { ListingStatus } from '@common/enums/listing-status.enum';
import { SmsStatus } from '@common/enums/sms-status.enum';
import { SubscriptionStatus } from '@common/enums/subscription-status.enum';

export interface TenantAnalytics {
  listings: { total: number; published: number; draft: number; archived: number };
  customers: { total: number };
  bookings: { total: number; pending: number; confirmed: number };
  revenue: { total: string; currency: string };
  sms: { sent: number; failed: number; creditsRemaining: number };
}

export interface PlatformAnalytics {
  tenants: { total: number; active: number };
  listings: { total: number; published: number };
  customers: { total: number };
  sms: { totalSent: number };
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(SmsLog)
    private readonly smsLogRepo: Repository<SmsLog>,
    @InjectRepository(TenantSubscription)
    private readonly subRepo: Repository<TenantSubscription>,
  ) {}

  async getTenantAnalytics(tenantId: string): Promise<TenantAnalytics> {
    const [
      totalListings,
      publishedListings,
      draftListings,
      archivedListings,
      totalCustomers,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      smsSent,
      smsFailed,
    ] = await Promise.all([
      this.listingRepo.count({ where: { tenantId } }),
      this.listingRepo.count({ where: { tenantId, status: ListingStatus.PUBLISHED } }),
      this.listingRepo.count({ where: { tenantId, status: ListingStatus.DRAFT } }),
      this.listingRepo.count({ where: { tenantId, status: ListingStatus.ARCHIVED } }),
      this.customerRepo.count({ where: { tenantId } }),
      this.bookingRepo.count({ where: { tenantId } }),
      this.bookingRepo.count({ where: { tenantId, status: 'pending' as never } }),
      this.bookingRepo.count({ where: { tenantId, status: 'confirmed' as never } }),
      this.smsLogRepo.count({ where: { tenantId, status: SmsStatus.SENT } }),
      this.smsLogRepo.count({ where: { tenantId, status: SmsStatus.FAILED } }),
    ]);

    const revenueResult = await this.paymentRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(CAST(p.amount AS numeric)), 0)', 'total')
      .addSelect('p.currency', 'currency')
      .where('p.tenant_id = :tenantId AND p.status = :status', { tenantId, status: 'success' })
      .groupBy('p.currency')
      .getRawOne<{ total: string; currency: string }>();

    const sub = await this.subRepo.findOne({ where: { tenantId, status: SubscriptionStatus.ACTIVE } });

    return {
      listings: { total: totalListings, published: publishedListings, draft: draftListings, archived: archivedListings },
      customers: { total: totalCustomers },
      bookings: { total: totalBookings, pending: pendingBookings, confirmed: confirmedBookings },
      revenue: { total: revenueResult?.total ?? '0', currency: revenueResult?.currency ?? 'NPR' },
      sms: { sent: smsSent, failed: smsFailed, creditsRemaining: sub?.smsCreditsRemaining ?? 0 },
    };
  }

  async getPlatformAnalytics(): Promise<PlatformAnalytics> {
    const [totalListings, publishedListings, totalCustomers, totalSent] = await Promise.all([
      this.listingRepo.createQueryBuilder('l').select('COUNT(*)').getRawOne<{ count: string }>(),
      this.listingRepo.createQueryBuilder('l').select('COUNT(*)').where('l.status = :s', { s: ListingStatus.PUBLISHED }).getRawOne<{ count: string }>(),
      this.customerRepo.createQueryBuilder('c').select('COUNT(*)').getRawOne<{ count: string }>(),
      this.smsLogRepo.count({ where: { status: SmsStatus.SENT } }),
    ]);

    const [totalTenants, activeTenants] = await Promise.all([
      this.subRepo.createQueryBuilder('s').select('COUNT(DISTINCT s.tenant_id)').getRawOne<{ count: string }>(),
      this.subRepo.createQueryBuilder('s').select('COUNT(DISTINCT s.tenant_id)').where('s.status = :s', { s: SubscriptionStatus.ACTIVE }).getRawOne<{ count: string }>(),
    ]);

    return {
      tenants: {
        total: parseInt(totalTenants?.count ?? '0', 10),
        active: parseInt(activeTenants?.count ?? '0', 10),
      },
      listings: {
        total: parseInt(totalListings?.count ?? '0', 10),
        published: parseInt(publishedListings?.count ?? '0', 10),
      },
      customers: { total: parseInt(totalCustomers?.count ?? '0', 10) },
      sms: { totalSent: totalSent },
    };
  }
}
