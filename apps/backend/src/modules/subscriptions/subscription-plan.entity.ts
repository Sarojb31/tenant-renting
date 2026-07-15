import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ name: 'max_listings', type: 'int', nullable: true })
  maxListings!: number | null;

  @Column({ name: 'max_staff_users', type: 'int', nullable: true })
  maxStaffUsers!: number | null;

  @Column({ name: 'sms_credits_included', type: 'int', default: 0 })
  smsCreditsIncluded!: number;

  @Column({ name: 'price_monthly', type: 'decimal', precision: 10, scale: 2, default: 0 })
  priceMonthly!: string;

  @Column({ name: 'price_currency', default: 'USD' })
  priceCurrency!: string;

  @Column({ type: 'jsonb', default: {} })
  features!: Record<string, boolean>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
