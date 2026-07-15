import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SubscriptionStatus } from '@common/enums/subscription-status.enum';
import { SubscriptionPlan } from './subscription-plan.entity';

@Entity('tenant_subscriptions')
export class TenantSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @ManyToOne(() => SubscriptionPlan, { eager: true })
  @JoinColumn({ name: 'plan_id' })
  plan!: SubscriptionPlan;

  @Column({ type: 'varchar', default: SubscriptionStatus.ACTIVE })
  status!: SubscriptionStatus;

  @Column({ name: 'current_period_start', type: 'timestamp' })
  currentPeriodStart!: Date;

  @Column({ name: 'current_period_end', type: 'timestamp' })
  currentPeriodEnd!: Date;

  @Column({ name: 'sms_credits_remaining', type: 'int', default: 0 })
  smsCreditsRemaining!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
