import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentGateway } from '../../common/enums/payment-gateway.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { PayableType } from '../../common/enums/payable-type.enum';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Column({ name: 'payable_type', type: 'varchar' })
  payableType!: PayableType;

  @Column({ name: 'payable_id', type: 'uuid' })
  payableId!: string;

  @Column({ type: 'varchar' })
  gateway!: PaymentGateway;

  @Column({ name: 'gateway_transaction_id', type: 'varchar', nullable: true })
  gatewayTransactionId!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ length: 3 })
  currency!: string;

  @Column({ type: 'varchar', default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @Column({ name: 'raw_response', type: 'jsonb', nullable: true })
  rawResponse!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
