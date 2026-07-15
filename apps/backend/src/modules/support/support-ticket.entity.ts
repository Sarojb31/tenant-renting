import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { SupportTicketStatus } from '@common/enums/support-ticket-status.enum';

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Column({ name: 'raised_by_user_id', type: 'uuid' })
  raisedByUserId!: string;

  @Column()
  subject!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: SupportTicketStatus, default: SupportTicketStatus.OPEN })
  status!: SupportTicketStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
