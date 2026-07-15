import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPlan } from './subscription-plan.entity';
import { TenantSubscription } from './tenant-subscription.entity';
import { SubscriptionStatus } from '@common/enums/subscription-status.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';

function makeRepo<T extends ObjectLiteral>(overrides: Partial<Repository<T>> = {}): Repository<T> {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((e) => Promise.resolve({ id: 'uuid-1', ...e })),
    createQueryBuilder: jest.fn(),
    ...overrides,
  } as unknown as Repository<T>;
}

function makePlan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    id: 'plan-1',
    name: 'basic',
    maxListings: 150,
    maxStaffUsers: 3,
    smsCreditsIncluded: 200,
    priceMonthly: '29.00',
    priceCurrency: 'USD',
    features: {},
    createdAt: new Date(),
    ...overrides,
  };
}

function makeSub(overrides: Partial<TenantSubscription> = {}): TenantSubscription {
  const plan = makePlan();
  return {
    id: 'sub-1',
    tenantId: 'tenant-1',
    planId: 'plan-1',
    plan,
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    smsCreditsRemaining: 200,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(planRepo: Repository<SubscriptionPlan>, subRepo: Repository<TenantSubscription>) {
  return new SubscriptionsService(planRepo, subRepo);
}

describe('SubscriptionsService.listPlans', () => {
  it('calls find with price sort', async () => {
    const planRepo = makeRepo<SubscriptionPlan>();
    const svc = buildService(planRepo, makeRepo<TenantSubscription>());
    await svc.listPlans();
    expect(planRepo.find).toHaveBeenCalledWith({ order: { priceMonthly: 'ASC' } });
  });
});

describe('SubscriptionsService.subscribe', () => {
  it('throws NotFoundException when plan not found', async () => {
    const planRepo = makeRepo<SubscriptionPlan>({ findOne: jest.fn().mockResolvedValue(null) });
    const svc = buildService(planRepo, makeRepo<TenantSubscription>());
    await expect(svc.subscribe('tenant-1', 'bad-plan')).rejects.toThrow(NotFoundException);
  });

  it('creates new subscription when none exists', async () => {
    const plan = makePlan();
    const planRepo = makeRepo<SubscriptionPlan>({ findOne: jest.fn().mockResolvedValue(plan) });
    const subRepo = makeRepo<TenantSubscription>({ findOne: jest.fn().mockResolvedValue(null) });
    const svc = buildService(planRepo, subRepo);
    await svc.subscribe('tenant-1', 'plan-1');
    expect(subRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', smsCreditsRemaining: 200 }),
    );
  });

  it('upgrades existing subscription in place', async () => {
    const plan = makePlan({ name: 'pro', smsCreditsIncluded: 1000 });
    const planRepo = makeRepo<SubscriptionPlan>({ findOne: jest.fn().mockResolvedValue(plan) });
    const existing = makeSub();
    const subRepo = makeRepo<TenantSubscription>({ findOne: jest.fn().mockResolvedValue(existing) });
    const svc = buildService(planRepo, subRepo);
    await svc.subscribe('tenant-1', 'plan-pro');
    expect(subRepo.save).toHaveBeenCalledWith(expect.objectContaining({ smsCreditsRemaining: 1000 }));
  });
});

describe('SubscriptionsService.assertListingLimit', () => {
  it('allows create when current count below limit', async () => {
    const sub = makeSub(); // maxListings = 150
    const subRepo = makeRepo<TenantSubscription>({ findOne: jest.fn().mockResolvedValue(sub) });
    const svc = buildService(makeRepo<SubscriptionPlan>(), subRepo);
    await expect(svc.assertListingLimit('tenant-1', 100)).resolves.toBeUndefined();
  });

  it('throws ForbiddenException when limit reached', async () => {
    const sub = makeSub(); // maxListings = 150
    const subRepo = makeRepo<TenantSubscription>({ findOne: jest.fn().mockResolvedValue(sub) });
    const svc = buildService(makeRepo<SubscriptionPlan>(), subRepo);
    await expect(svc.assertListingLimit('tenant-1', 150)).rejects.toThrow(ForbiddenException);
  });

  it('allows unlimited when maxListings is null', async () => {
    const sub = makeSub({ plan: makePlan({ maxListings: null }) });
    const subRepo = makeRepo<TenantSubscription>({ findOne: jest.fn().mockResolvedValue(sub) });
    const svc = buildService(makeRepo<SubscriptionPlan>(), subRepo);
    await expect(svc.assertListingLimit('tenant-1', 99999)).resolves.toBeUndefined();
  });

  it('allows create when no subscription found', async () => {
    const subRepo = makeRepo<TenantSubscription>({ findOne: jest.fn().mockResolvedValue(null) });
    const svc = buildService(makeRepo<SubscriptionPlan>(), subRepo);
    await expect(svc.assertListingLimit('tenant-1', 1000)).resolves.toBeUndefined();
  });
});

describe('SubscriptionsService.deductSmsCredit', () => {
  it('returns true and executes update when credits remain', async () => {
    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const subRepo = makeRepo<TenantSubscription>({
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    });
    const svc = buildService(makeRepo<SubscriptionPlan>(), subRepo);
    const result = await svc.deductSmsCredit('tenant-1');
    expect(result).toBe(true);
  });

  it('returns false when no rows updated (credits exhausted)', async () => {
    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const subRepo = makeRepo<TenantSubscription>({
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    });
    const svc = buildService(makeRepo<SubscriptionPlan>(), subRepo);
    const result = await svc.deductSmsCredit('tenant-1');
    expect(result).toBe(false);
  });
});

describe('SubscriptionsService.cancel', () => {
  it('sets status to cancelled', async () => {
    const sub = makeSub();
    const subRepo = makeRepo<TenantSubscription>({ findOne: jest.fn().mockResolvedValue(sub) });
    const svc = buildService(makeRepo<SubscriptionPlan>(), subRepo);
    await svc.cancel('tenant-1');
    expect(subRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: SubscriptionStatus.CANCELLED }),
    );
  });

  it('throws NotFoundException when no subscription', async () => {
    const subRepo = makeRepo<TenantSubscription>({ findOne: jest.fn().mockResolvedValue(null) });
    const svc = buildService(makeRepo<SubscriptionPlan>(), subRepo);
    await expect(svc.cancel('tenant-1')).rejects.toThrow(NotFoundException);
  });
});
