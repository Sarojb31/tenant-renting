import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantStatus } from '@common/enums/tenant-status.enum';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  subdomain!: string;

  @Column({ name: 'custom_domain', type: 'varchar', nullable: true })
  customDomain!: string | null;

  @Column({ name: 'logo_url', type: 'varchar', nullable: true })
  logoUrl!: string | null;

  @Column({ name: 'theme_color', type: 'varchar', nullable: true })
  themeColor!: string | null;

  @Column()
  country!: string;

  @Column({ name: 'default_currency', default: 'NPR' })
  defaultCurrency!: string;

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.TRIAL })
  status!: TenantStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
