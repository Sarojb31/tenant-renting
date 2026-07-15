import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SmsTemplateEvent } from '@common/enums/sms-template-event.enum';

@Entity('sms_templates')
export class SmsTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Column()
  name!: string;

  @Column({ name: 'body_text', type: 'text' })
  bodyText!: string;

  @Column({ name: 'event_trigger', type: 'varchar', default: SmsTemplateEvent.CUSTOM })
  eventTrigger!: SmsTemplateEvent;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
