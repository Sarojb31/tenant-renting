import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';
import { TenantSubscription } from './tenant-subscription.entity';
import { SubscriptionStatus } from '@common/enums/subscription-status.enum';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(TenantSubscription)
    private readonly subRepo: Repository<TenantSubscription>,
  ) {}

  listPlans(): Promise<SubscriptionPlan[]> {
    return this.planRepo.find({ order: { priceMonthly: 'ASC' } });
  }

  findPlanByName(name: string): Promise<SubscriptionPlan | null> {
    return this.planRepo.findOne({ where: { name } });
  }

  getCurrentSubscription(tenantId: string): Promise<TenantSubscription | null> {
    return this.subRepo.findOne({ where: { tenantId } });
  }

  async subscribe(tenantId: string, planId: string): Promise<TenantSubscription> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const existing = await this.subRepo.findOne({ where: { tenantId } });
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (existing) {
      existing.planId = plan.id;
      existing.plan = plan;
      existing.status = SubscriptionStatus.ACTIVE;
      existing.currentPeriodStart = now;
      existing.currentPeriodEnd = periodEnd;
      existing.smsCreditsRemaining = plan.smsCreditsIncluded;
      return this.subRepo.save(existing);
    }

    return this.subRepo.save({
      tenantId,
      planId: plan.id,
      plan,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      smsCreditsRemaining: plan.smsCreditsIncluded,
    } as TenantSubscription);
  }

  async cancel(tenantId: string): Promise<TenantSubscription> {
    const sub = await this.subRepo.findOne({ where: { tenantId } });
    if (!sub) throw new NotFoundException('No active subscription');
    sub.status = SubscriptionStatus.CANCELLED;
    return this.subRepo.save(sub);
  }

  // Plan limit checks — called before creating listings/staff
  async assertListingLimit(tenantId: string, currentCount: number): Promise<void> {
    const sub = await this.getCurrentSubscription(tenantId);
    if (!sub || sub.status !== SubscriptionStatus.ACTIVE) return;
    const limit = sub.plan?.maxListings;
    if (limit !== null && limit !== undefined && currentCount >= limit) {
      throw new ForbiddenException(
        `Plan limit reached: your ${sub.plan.name} plan allows ${limit} listings. Upgrade to publish more.`,
      );
    }
  }

  async assertStaffLimit(tenantId: string, currentCount: number): Promise<void> {
    const sub = await this.getCurrentSubscription(tenantId);
    if (!sub || sub.status !== SubscriptionStatus.ACTIVE) return;
    const limit = sub.plan?.maxStaffUsers;
    if (limit !== null && limit !== undefined && currentCount >= limit) {
      throw new ForbiddenException(
        `Plan limit reached: your ${sub.plan.name} plan allows ${limit} staff accounts. Upgrade to add more.`,
      );
    }
  }

  // Dunning: transition subscription to past_due (called when payment fails or period expires)
  async markPastDue(tenantId: string): Promise<TenantSubscription> {
    const sub = await this.subRepo.findOne({ where: { tenantId, status: SubscriptionStatus.ACTIVE } });
    if (!sub) throw new NotFoundException('No active subscription found');
    sub.status = SubscriptionStatus.PAST_DUE;
    return this.subRepo.save(sub);
  }

  // Called by MatchingService — returns false if no credits remain
  async deductSmsCredit(tenantId: string): Promise<boolean> {
    const result = await this.subRepo
      .createQueryBuilder()
      .update(TenantSubscription)
      .set({ smsCreditsRemaining: () => 'sms_credits_remaining - 1' })
      .where('tenant_id = :tenantId AND sms_credits_remaining > 0 AND status = :status', {
        tenantId,
        status: SubscriptionStatus.ACTIVE,
      })
      .execute();
    return (result.affected ?? 0) > 0;
  }
}
