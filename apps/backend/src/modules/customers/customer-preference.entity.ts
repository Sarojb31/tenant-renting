import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from './customer.entity';

// One preference record per customer (upserted). Plan §12 customer_preferences table.
@Entity('customer_preferences')
export class CustomerPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'customer_id', type: 'uuid', unique: true })
  customerId!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'jsonb', nullable: true })
  locations!: string[] | null;

  @Column({ name: 'budget_min', type: 'decimal', nullable: true })
  budgetMin!: string | null;

  @Column({ name: 'budget_max', type: 'decimal', nullable: true })
  budgetMax!: string | null;

  @Column({ name: 'room_type', type: 'varchar', nullable: true })
  roomType!: string | null;

  @Column({ name: 'move_in_date', type: 'date', nullable: true })
  moveInDate!: string | null;

  @Column({ name: 'amenities_wanted', type: 'jsonb', nullable: true })
  amenitiesWanted!: string[] | null;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;
}
