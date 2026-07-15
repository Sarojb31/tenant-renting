import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fb_page_leads')
export class FbPageLead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'fb_page_id' })
  fbPageId!: string;

  @Column({ name: 'fb_sender_psid' })
  fbSenderPsid!: string;

  @Column({ name: 'message_text', type: 'text' })
  messageText!: string;

  @Column({ name: 'matched_customer_id', type: 'uuid', nullable: true })
  matchedCustomerId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
