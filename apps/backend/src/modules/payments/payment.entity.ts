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

  @Column('uuid', { nullable: true })
  tenantId!: string | null;

  @Column({ type: 'varchar' })
  payableType!: PayableType;

  @Column('uuid')
  payableId!: string;

  @Column({ type: 'varchar' })
  gateway!: PaymentGateway;

  @Column({ type: 'varchar', nullable: true })
  gatewayTransactionId!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ length: 3 })
  currency!: string;

  @Column({ type: 'varchar', default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @Column({ type: 'jsonb', nullable: true })
  rawResponse!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
