/**
 * Subscriptions integration tests — Plan §4.8, §4.7, §17.
 *
 * Tests plan-limit enforcement, SMS credit deduction (atomic DB update),
 * dunning (markPastDue), and cross-tenant isolation using a real Postgres connection.
 *
 * Run: pnpm --filter @roomfinder/backend test:integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SubscriptionsService } from '../src/modules/subscriptions/subscriptions.service';
import { SubscriptionPlan } from '../src/modules/subscriptions/subscription-plan.entity';
import { TenantSubscription } from '../src/modules/subscriptions/tenant-subscription.entity';
import { SubscriptionStatus } from '../src/common/enums/subscription-status.enum';

const TEST_DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://roomfinder:roomfinder_dev@localhost:5432/roomfinder';

const TENANT_A = '10000000-0000-0000-0000-000000000001';
const TENANT_B = '10000000-0000-0000-0000-000000000002';
const NO_SUB_TENANT = '10000000-0000-0000-0000-000000000099';

describe('SubscriptionsService (integration)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let service: SubscriptionsService;
  let subRepo: Repository<TenantSubscription>;
  let planId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: TEST_DB_URL,
          synchronize: true,
          dropSchema: true,
          entities: [SubscriptionPlan, TenantSubscription],
          logging: false,
        }),
        TypeOrmModule.forFeature([SubscriptionPlan, TenantSubscription]),
      ],
      providers: [SubscriptionsService],
    }).compile();

    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    service = moduleRef.get<SubscriptionsService>(SubscriptionsService);
    subRepo = dataSource.getRepository(TenantSubscription);

    const planRepo = dataSource.getRepository(SubscriptionPlan);
    const plan = await planRepo.save(planRepo.create({
      name: 'basic',
      maxListings: 2,
      maxStaffUsers: 3,
      smsCreditsIncluded: 5,
      priceMonthly: '29.00',
      priceCurrency: 'NPR',
      features: {},
    }));
    planId = plan.id;
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM tenant_subscriptions');
  });

  // ---------------------------------------------------------------------------
  describe('subscribe / getCurrentSubscription', () => {
    it('creates subscription with full credits and ACTIVE status', async () => {
      await service.subscribe(TENANT_A, planId);
      const sub = await service.getCurrentSubscription(TENANT_A);
      expect(sub).not.toBeNull();
      expect(sub!.status).toBe(SubscriptionStatus.ACTIVE);
      expect(sub!.smsCreditsRemaining).toBe(5);
      expect(sub!.planId).toBe(planId);
    });

    it('upserts on second subscribe — no duplicate row', async () => {
      await service.subscribe(TENANT_A, planId);
      await service.subscribe(TENANT_A, planId);
      const subs = await subRepo.find({ where: { tenantId: TENANT_A } });
      expect(subs).toHaveLength(1);
    });

    it('throws NotFoundException for unknown plan', async () => {
      await expect(
        service.subscribe(TENANT_A, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('assertListingLimit — plan limit enforcement (Plan §4.7)', () => {
    it('allows creation when count below limit', async () => {
      await service.subscribe(TENANT_A, planId); // maxListings: 2
      await expect(service.assertListingLimit(TENANT_A, 1)).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when limit reached', async () => {
      await service.subscribe(TENANT_A, planId); // maxListings: 2
      await expect(service.assertListingLimit(TENANT_A, 2)).rejects.toThrow(ForbiddenException);
    });

    it('allows unlimited creation when no subscription exists', async () => {
      await expect(service.assertListingLimit(NO_SUB_TENANT, 9999)).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  describe('deductSmsCredit — atomic DB decrement (Plan §4.7)', () => {
    it('decrements credits by 1 and returns true when credits remain', async () => {
      await service.subscribe(TENANT_A, planId); // 5 credits
      const ok = await service.deductSmsCredit(TENANT_A);
      expect(ok).toBe(true);
      const sub = await service.getCurrentSubscription(TENANT_A);
      expect(sub!.smsCreditsRemaining).toBe(4);
    });

    it('exhausts credits to zero without going negative', async () => {
      await service.subscribe(TENANT_A, planId); // 5 credits
      for (let i = 0; i < 5; i++) {
        await service.deductSmsCredit(TENANT_A);
      }
      const sub = await service.getCurrentSubscription(TENANT_A);
      expect(sub!.smsCreditsRemaining).toBe(0);
    });

    it('returns false and makes no change when credits are exhausted', async () => {
      await service.subscribe(TENANT_A, planId); // 5 credits
      for (let i = 0; i < 5; i++) await service.deductSmsCredit(TENANT_A);

      const ok = await service.deductSmsCredit(TENANT_A);
      expect(ok).toBe(false);

      const sub = await service.getCurrentSubscription(TENANT_A);
      expect(sub!.smsCreditsRemaining).toBe(0); // not -1
    });

    it('returns false for tenant with no subscription', async () => {
      const ok = await service.deductSmsCredit(NO_SUB_TENANT);
      expect(ok).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  describe('cancel', () => {
    it('sets status to CANCELLED', async () => {
      await service.subscribe(TENANT_A, planId);
      const sub = await service.cancel(TENANT_A);
      expect(sub.status).toBe(SubscriptionStatus.CANCELLED);
    });

    it('throws NotFoundException when no subscription', async () => {
      await expect(service.cancel(NO_SUB_TENANT)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('markPastDue — dunning (Plan §4.8)', () => {
    it('transitions ACTIVE to PAST_DUE', async () => {
      await service.subscribe(TENANT_A, planId);
      const sub = await service.markPastDue(TENANT_A);
      expect(sub.status).toBe(SubscriptionStatus.PAST_DUE);

      const persisted = await service.getCurrentSubscription(TENANT_A);
      expect(persisted!.status).toBe(SubscriptionStatus.PAST_DUE);
    });

    it('throws NotFoundException when no active subscription', async () => {
      await expect(service.markPastDue(NO_SUB_TENANT)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('cross-tenant isolation (Plan §17)', () => {
    it('tenant A subscription not visible to tenant B', async () => {
      await service.subscribe(TENANT_A, planId);
      const subForB = await service.getCurrentSubscription(TENANT_B);
      expect(subForB).toBeNull();
    });

    it('deductSmsCredit for tenant B does not affect tenant A credits', async () => {
      await service.subscribe(TENANT_A, planId); // 5 credits

      const ok = await service.deductSmsCredit(TENANT_B); // tenant-b has no subscription
      expect(ok).toBe(false);

      const subA = await service.getCurrentSubscription(TENANT_A);
      expect(subA!.smsCreditsRemaining).toBe(5); // unchanged
    });

    it('assertListingLimit for tenant B does not read tenant A limits', async () => {
      await service.subscribe(TENANT_A, planId); // maxListings: 2
      // tenant-b has no subscription — should be uncapped
      await expect(service.assertListingLimit(TENANT_B, 9999)).resolves.toBeUndefined();
    });
  });
});
