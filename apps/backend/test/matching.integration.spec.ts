/**
 * Matching Engine integration tests — Plan Section 4.5, 14, 17.
 *
 * Tests rule-based preference matching + SMS dispatch + sms_logs audit trail.
 * Calls MatchingService.triggerMatchForListing() directly — no Redis/BullMQ needed.
 * SMS_PROVIDER is mocked.
 *
 * Run: pnpm --filter @roomfinder/backend test:integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Tenant } from '../src/modules/tenants/tenant.entity';
import { User } from '../src/modules/users/user.entity';
import { Customer } from '../src/modules/customers/customer.entity';
import { CustomerPreference } from '../src/modules/customers/customer-preference.entity';
import { PhoneOtpCode } from '../src/modules/auth/entities/phone-otp-code.entity';
import { Listing } from '../src/modules/listings/listing.entity';
import { ListingImage } from '../src/modules/listings/listing-image.entity';
import { SmsLog } from '../src/modules/matching/sms-log.entity';
import { MatchingService } from '../src/modules/matching/matching.service';
import { SMS_PROVIDER } from '../src/modules/sms/sms.provider.interface';
import { TenantStatus } from '../src/common/enums/tenant-status.enum';
import { ListingStatus } from '../src/common/enums/listing-status.enum';
import { RoomType } from '../src/common/enums/room-type.enum';
import { SmsStatus } from '../src/common/enums/sms-status.enum';

const TEST_DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://roomfinder:roomfinder_dev@localhost:5432/roomfinder';

describe('Matching Engine (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let matchingService: MatchingService;
  let smsSendMock: jest.Mock;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    smsSendMock = jest.fn().mockResolvedValue({ providerMessageId: 'mock-sms-id', status: 'sent' });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: TEST_DB_URL,
          synchronize: true,
          dropSchema: true,
          entities: [Tenant, User, Customer, CustomerPreference, PhoneOtpCode, Listing, ListingImage, SmsLog],
          logging: false,
        }),
        TypeOrmModule.forFeature([Tenant, Customer, CustomerPreference, Listing, SmsLog]),
      ],
      providers: [
        MatchingService,
        { provide: SMS_PROVIDER, useValue: { send: smsSendMock } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    matchingService = moduleRef.get<MatchingService>(MatchingService);

    const tenantRepo = dataSource.getRepository(Tenant);
    const tenantA = await tenantRepo.save({
      name: 'Match Co A', subdomain: 'matchtest-a',
      status: TenantStatus.TRIAL, country: 'NP', defaultCurrency: 'NPR',
    });
    const tenantB = await tenantRepo.save({
      name: 'Match Co B', subdomain: 'matchtest-b',
      status: TenantStatus.TRIAL, country: 'NP', defaultCurrency: 'NPR',
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    smsSendMock.mockClear();
    await dataSource.query(`DELETE FROM "sms_logs"`);
    await dataSource.query(`DELETE FROM "customer_preferences"`);
    await dataSource.query(`DELETE FROM "customers" WHERE tenant_id IN ($1,$2)`, [tenantAId, tenantBId]);
    await dataSource.query(`DELETE FROM "listings" WHERE tenant_id IN ($1,$2)`, [tenantAId, tenantBId]);
  });

  async function seedListing(tenantId: string, overrides: Partial<{
    roomType: RoomType; rentAmount: number; status: ListingStatus; city: string;
  }> = {}): Promise<Listing> {
    return dataSource.getRepository(Listing).save({
      title: 'Test Room',
      roomType: overrides.roomType ?? RoomType.SINGLE,
      rentAmount: String(overrides.rentAmount ?? 8000) as any,
      city: overrides.city ?? 'Kathmandu',
      status: overrides.status ?? ListingStatus.PUBLISHED,
      tenantId,
      createdBy: null,
    });
  }

  async function seedCustomerWithPref(tenantId: string, opts: {
    phone: string;
    smsOptIn?: boolean;
    roomType?: RoomType | null;
    budgetMin?: number | null;
    budgetMax?: number | null;
    active?: boolean;
  }): Promise<{ customer: Customer; pref: CustomerPreference }> {
    const customer = await dataSource.getRepository(Customer).save({
      phone: opts.phone,
      tenantId,
      phoneVerified: true,
      smsOptIn: opts.smsOptIn ?? true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pref = await dataSource.getRepository(CustomerPreference).save({
      customerId: customer.id,
      tenantId,
      roomType: opts.roomType ?? null,
      budgetMin: opts.budgetMin ?? null,
      budgetMax: opts.budgetMax ?? null,
      active: opts.active ?? true,
    } as any) as CustomerPreference;

    return { customer, pref };
  }

  // ---------------------------------------------------------------------------
  describe('triggerMatchForListing', () => {
    it('sends SMS to customers whose preferences match and logs to sms_logs', async () => {
      const listing = await seedListing(tenantAId, { rentAmount: 8000, roomType: RoomType.SINGLE });
      await seedCustomerWithPref(tenantAId, {
        phone: '+9779800010001',
        roomType: RoomType.SINGLE,
        budgetMin: 5000,
        budgetMax: 10000,
      });

      await matchingService.triggerMatchForListing(listing.id, tenantAId);

      expect(smsSendMock).toHaveBeenCalledTimes(1);
      expect(smsSendMock.mock.calls[0][0]).toBe('+9779800010001');

      const logs = await dataSource.getRepository(SmsLog).find({
        where: { listingId: listing.id },
      });
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe(SmsStatus.SENT);
      expect(logs[0].providerMessageId).toBe('mock-sms-id');
    });

    it('does not send SMS when listing is not PUBLISHED', async () => {
      const listing = await seedListing(tenantAId, { status: ListingStatus.DRAFT });
      await seedCustomerWithPref(tenantAId, { phone: '+9779800010002', budgetMax: 15000 });

      await matchingService.triggerMatchForListing(listing.id, tenantAId);

      expect(smsSendMock).not.toHaveBeenCalled();
    });

    it('does not send SMS when customer has smsOptIn = false', async () => {
      const listing = await seedListing(tenantAId);
      await seedCustomerWithPref(tenantAId, {
        phone: '+9779800010003',
        smsOptIn: false,
        budgetMax: 15000,
      });

      await matchingService.triggerMatchForListing(listing.id, tenantAId);

      expect(smsSendMock).not.toHaveBeenCalled();
    });

    it('does not send SMS when preference is inactive', async () => {
      const listing = await seedListing(tenantAId);
      await seedCustomerWithPref(tenantAId, {
        phone: '+9779800010004',
        budgetMax: 15000,
        active: false,
      });

      await matchingService.triggerMatchForListing(listing.id, tenantAId);

      expect(smsSendMock).not.toHaveBeenCalled();
    });

    it('skips customer when rent exceeds budgetMax', async () => {
      const listing = await seedListing(tenantAId, { rentAmount: 12000 });
      await seedCustomerWithPref(tenantAId, {
        phone: '+9779800010005',
        budgetMin: 5000,
        budgetMax: 10000,
      });

      await matchingService.triggerMatchForListing(listing.id, tenantAId);

      expect(smsSendMock).not.toHaveBeenCalled();
    });

    it('skips customer when rent is below budgetMin', async () => {
      const listing = await seedListing(tenantAId, { rentAmount: 3000 });
      await seedCustomerWithPref(tenantAId, {
        phone: '+9779800010006',
        budgetMin: 5000,
        budgetMax: 10000,
      });

      await matchingService.triggerMatchForListing(listing.id, tenantAId);

      expect(smsSendMock).not.toHaveBeenCalled();
    });

    it('skips customer when roomType does not match', async () => {
      const listing = await seedListing(tenantAId, { roomType: RoomType.SHARED });
      await seedCustomerWithPref(tenantAId, {
        phone: '+9779800010007',
        roomType: RoomType.SINGLE,
        budgetMax: 15000,
      });

      await matchingService.triggerMatchForListing(listing.id, tenantAId);

      expect(smsSendMock).not.toHaveBeenCalled();
    });

    it('matches customer when preference has no roomType filter (null matches any)', async () => {
      const listing = await seedListing(tenantAId, { roomType: RoomType.PG });
      await seedCustomerWithPref(tenantAId, {
        phone: '+9779800010008',
        roomType: null,
        budgetMax: 15000,
      });

      await matchingService.triggerMatchForListing(listing.id, tenantAId);

      expect(smsSendMock).toHaveBeenCalledTimes(1);
    });

    it('matches customer when preference has no budget filter (null matches any rent)', async () => {
      const listing = await seedListing(tenantAId, { rentAmount: 50000 });
      await seedCustomerWithPref(tenantAId, {
        phone: '+9779800010009',
        budgetMin: null,
        budgetMax: null,
      });

      await matchingService.triggerMatchForListing(listing.id, tenantAId);

      expect(smsSendMock).toHaveBeenCalledTimes(1);
    });

    it('sends to multiple matching customers, skips non-matching', async () => {
      const listing = await seedListing(tenantAId, { rentAmount: 8000, roomType: RoomType.SINGLE });

      // matches
      await seedCustomerWithPref(tenantAId, { phone: '+9779800010010', budgetMax: 10000 });
      await seedCustomerWithPref(tenantAId, { phone: '+9779800010011', budgetMin: 5000, budgetMax: 9000 });

      // does not match
      await seedCustomerWithPref(tenantAId, { phone: '+9779800010012', budgetMax: 5000 }); // rent too high
      await seedCustomerWithPref(tenantAId, { phone: '+9779800010013', smsOptIn: false, budgetMax: 10000 });

      await matchingService.triggerMatchForListing(listing.id, tenantAId);

      expect(smsSendMock).toHaveBeenCalledTimes(2);
      const calledPhones = smsSendMock.mock.calls.map((c: [string]) => c[0]);
      expect(calledPhones).toContain('+9779800010010');
      expect(calledPhones).toContain('+9779800010011');
    });

    it('is idempotent — second trigger for same (customer, listing) skips SMS', async () => {
      const listing = await seedListing(tenantAId);
      await seedCustomerWithPref(tenantAId, { phone: '+9779800010015', budgetMax: 15000 });

      await matchingService.triggerMatchForListing(listing.id, tenantAId);
      await matchingService.triggerMatchForListing(listing.id, tenantAId);

      // SMS sent exactly once despite two trigger calls
      expect(smsSendMock).toHaveBeenCalledTimes(1);
      const logs = await dataSource.getRepository(SmsLog).find({ where: { listingId: listing.id } });
      expect(logs.length).toBe(1);
    });

    it('logs FAILED status when SMS provider throws', async () => {
      smsSendMock.mockRejectedValueOnce(new Error('Provider down'));
      const listing = await seedListing(tenantAId);
      await seedCustomerWithPref(tenantAId, { phone: '+9779800010014', budgetMax: 15000 });

      await matchingService.triggerMatchForListing(listing.id, tenantAId);

      const logs = await dataSource.getRepository(SmsLog).find({ where: { listingId: listing.id } });
      expect(logs[0].status).toBe(SmsStatus.FAILED);
      expect(logs[0].providerMessageId).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  describe('Cross-tenant isolation (Plan §17)', () => {
    it('only notifies customers in the same tenant as the listing', async () => {
      const listing = await seedListing(tenantAId);

      // Customer in tenant A — should match
      await seedCustomerWithPref(tenantAId, { phone: '+9779800020001', budgetMax: 15000 });

      // Customer in tenant B — must NOT be notified (different tenant)
      await seedCustomerWithPref(tenantBId, { phone: '+9779800020002', budgetMax: 15000 });

      await matchingService.triggerMatchForListing(listing.id, tenantAId);

      expect(smsSendMock).toHaveBeenCalledTimes(1);
      expect(smsSendMock.mock.calls[0][0]).toBe('+9779800020001');

      // Tenant B customer has no log
      const tenantBCustomer = await dataSource.getRepository(Customer).findOne({
        where: { phone: '+9779800020002', tenantId: tenantBId },
      });
      const tenantBLogs = await dataSource.getRepository(SmsLog).find({
        where: { customerId: tenantBCustomer!.id },
      });
      expect(tenantBLogs.length).toBe(0);
    });

    it('does not trigger match for listing belonging to a different tenant', async () => {
      const listingA = await seedListing(tenantAId);
      await seedCustomerWithPref(tenantBId, { phone: '+9779800020003', budgetMax: 15000 });

      // Wrong tenantId passed (tenant B tries to trigger match on tenant A's listing)
      await matchingService.triggerMatchForListing(listingA.id, tenantBId);

      expect(smsSendMock).not.toHaveBeenCalled();
    });
  });
});
