import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  /**
   * Apply a plan change.
   *
   * Free plans (price_monthly = 0): applied immediately, no payment required.
   * Paid upgrades / new paid subscriptions: caller must use POST /payments/subscription-intent.
   * Paid downgrades: recorded as pending_plan_id; applied at next billing cycle to prevent
   * gaming (upgrade → drain credits → downgrade).
   */
  async subscribe(tenantId: string, planId: string): Promise<TenantSubscription & { pendingDowngrade?: boolean }> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const isFree = parseFloat(plan.priceMonthly as unknown as string) === 0;
    const existing = await this.subRepo.findOne({ where: { tenantId } });
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Free tier: apply immediately
    if (isFree) {
      if (existing) {
        existing.planId = plan.id;
        existing.plan = plan;
        existing.status = SubscriptionStatus.ACTIVE;
        existing.currentPeriodStart = now;
        existing.currentPeriodEnd = periodEnd;
        existing.smsCreditsRemaining = plan.smsCreditsIncluded;
        existing.pendingPlanId = null;
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
        pendingPlanId: null,
      } as TenantSubscription);
    }

    // Paid plan: no existing subscription → must go through payment intent
    if (!existing) {
      throw new BadRequestException(
        'Use POST /payments/subscription-intent to subscribe to a paid plan.',
      );
    }

    const currentPrice = parseFloat(existing.plan?.priceMonthly as unknown as string ?? '0');
    const newPrice = parseFloat(plan.priceMonthly as unknown as string);

    // Upgrade: must go through payment intent
    if (newPrice >= currentPrice) {
      throw new BadRequestException(
        'Use POST /payments/subscription-intent to upgrade to a paid plan.',
      );
    }

    // Downgrade to a still-paid tier: schedule for next billing cycle
    existing.pendingPlanId = plan.id;
    const saved = await this.subRepo.save(existing);
    return { ...saved, pendingDowngrade: true };
  }

  /** Apply a pending downgrade recorded by subscribe(). Called at billing cycle renewal. */
  async applyPendingPlan(tenantId: string): Promise<void> {
    const sub = await this.subRepo.findOne({ where: { tenantId } });
    if (!sub?.pendingPlanId) return;
    const plan = await this.planRepo.findOne({ where: { id: sub.pendingPlanId } });
    if (!plan) return;
    const now = new Date();
    sub.planId = plan.id;
    sub.plan = plan;
    sub.pendingPlanId = null;
    sub.smsCreditsRemaining = plan.smsCreditsIncluded;
    sub.currentPeriodStart = now;
    sub.currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await this.subRepo.save(sub);
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
