import {
  Entity,
  Column,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantScopedEntity } from '@database/base/tenant-scoped.entity';

// phone unique per tenant (Plan §12)
@Unique(['tenantId', 'phone'])
@Entity('customers')
export class Customer extends TenantScopedEntity {
  @Column({ type: 'varchar', nullable: true })
  name!: string | null;

  @Column()
  phone!: string;

  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ name: 'phone_verified', default: false })
  phoneVerified!: boolean;

  @Column({ name: 'sms_opt_in', default: true })
  smsOptIn!: boolean;

  @Column({ name: 'preferred_language', type: 'varchar', nullable: true })
  preferredLanguage!: string | null;

  @Column({ name: 'refresh_token_hash', type: 'varchar', nullable: true })
  refreshTokenHash!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
