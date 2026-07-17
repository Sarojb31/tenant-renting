import { AnalyticsService } from './analytics.service';
import { ListingStatus } from '@common/enums/listing-status.enum';
import { SmsStatus } from '@common/enums/sms-status.enum';
import { SubscriptionStatus } from '@common/enums/subscription-status.enum';
import { ObjectLiteral, Repository } from 'typeorm';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCountRepo<T extends ObjectLiteral>(countValue = 0): jest.Mocked<Pick<Repository<T>, 'count' | 'findOne' | 'createQueryBuilder'>> {
  const qb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(null),
  };
  return {
    count: jest.fn().mockResolvedValue(countValue),
    findOne: jest.fn().mockResolvedValue(null),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  } as any;
}

function buildService(overrides: {
  listing?: number;
  customer?: number;
  booking?: number;
  payment?: any;
  smsLog?: number;
  sub?: any;
} = {}) {
  const listingRepo = makeCountRepo(overrides.listing ?? 0);
  const customerRepo = makeCountRepo(overrides.customer ?? 0);
  const bookingRepo = makeCountRepo(overrides.booking ?? 0);
  const paymentRepo = makeCountRepo(0);
  const smsLogRepo = makeCountRepo(overrides.smsLog ?? 0);
  const subRepo = makeCountRepo(0);

  return new AnalyticsService(
    listingRepo as any,
    customerRepo as any,
    bookingRepo as any,
    paymentRepo as any,
    smsLogRepo as any,
    subRepo as any,
  );
}

// ─── Zero-state isolation tests ───────────────────────────────────────────────

describe('AnalyticsService.getTenantAnalytics — zero-state', () => {
  /**
   * Key assertion per Plan §1.6: a brand-new tenant with no data must
   * return all-zero counts. This test is the kind that would have caught
   * the cross-tenant isolation leak in the customer count query.
   */
  it('returns all-zero counts for a tenant with no data', async () => {
    const svc = buildService(); // all repos return 0 / null
    const result = await svc.getTenantAnalytics('new-tenant-uuid');

    expect(result.listings.total).toBe(0);
    expect(result.listings.published).toBe(0);
    expect(result.listings.draft).toBe(0);
    expect(result.listings.archived).toBe(0);
    expect(result.customers.total).toBe(0);
    expect(result.bookings.total).toBe(0);
    expect(result.bookings.pending).toBe(0);
    expect(result.bookings.confirmed).toBe(0);
    expect(result.sms.sent).toBe(0);
    expect(result.sms.failed).toBe(0);
    expect(result.sms.creditsRemaining).toBe(0);
    expect(result.revenue.total).toBe('0');
  });

  it('passes tenantId to every count query', async () => {
    const listingRepo = makeCountRepo(0);
    const customerRepo = makeCountRepo(0);
    const bookingRepo = makeCountRepo(0);
    const paymentRepo = makeCountRepo(0);
    const smsLogRepo = makeCountRepo(0);
    const subRepo = makeCountRepo(0);

    const svc = new AnalyticsService(
      listingRepo as any,
      customerRepo as any,
      bookingRepo as any,
      paymentRepo as any,
      smsLogRepo as any,
      subRepo as any,
    );

    const tenantId = 'isolated-tenant-id';
    await svc.getTenantAnalytics(tenantId);

    // Every repo that scopes by tenant must have received tenantId in its where clause
    expect(listingRepo.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId }) }));
    expect(customerRepo.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId }) }));
    expect(bookingRepo.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId }) }));
    expect(smsLogRepo.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId, status: SmsStatus.SENT }) }),
    );
    expect(subRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId, status: SubscriptionStatus.ACTIVE }) }),
    );
  });

  it('returns populated counts when data exists', async () => {
    const listingRepo = makeCountRepo(5);
    const customerRepo = makeCountRepo(3);
    const bookingRepo = makeCountRepo(2);
    const paymentRepo = makeCountRepo(0);
    const smsLogRepo = makeCountRepo(10);
    const subRepo = makeCountRepo(0);

    // Stub count per status
    let listingCall = 0;
    (listingRepo.count as jest.Mock).mockImplementation(() => {
      listingCall++;
      if (listingCall === 1) return 5; // total
      if (listingCall === 2) return 3; // published
      if (listingCall === 3) return 1; // draft
      return 1; // archived
    });

    const svc = new AnalyticsService(
      listingRepo as any,
      customerRepo as any,
      bookingRepo as any,
      paymentRepo as any,
      smsLogRepo as any,
      subRepo as any,
    );

    const result = await svc.getTenantAnalytics('tenant-with-data');
    expect(result.listings.total).toBe(5);
    expect(result.customers.total).toBe(3);
  });
});
