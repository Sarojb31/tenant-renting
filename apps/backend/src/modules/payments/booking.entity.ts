import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BookingStatus } from '../../common/enums/booking-status.enum';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('uuid')
  listingId!: string;

  @Column('uuid')
  customerId!: string;

  @Column({ type: 'varchar', default: BookingStatus.PENDING })
  status!: BookingStatus;

  @Column({ type: 'date', nullable: true })
  moveInDate!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amountDue!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amountPaid!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
