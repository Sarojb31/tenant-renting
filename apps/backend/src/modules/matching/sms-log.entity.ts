import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { SmsStatus } from '@common/enums/sms-status.enum';

// Plan §12 sms_logs table — one row per SMS send attempt from the matching engine.
@Entity('sms_logs')
export class SmsLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({ name: 'listing_id', type: 'uuid', nullable: true })
  listingId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  provider!: string | null;

  @Column({ name: 'message_body', type: 'text' })
  messageBody!: string;

  @Column({ type: 'varchar', default: SmsStatus.QUEUED })
  status!: string;

  @Column({ name: 'provider_message_id', type: 'varchar', nullable: true })
  providerMessageId!: string | null;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId!: string | null;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
