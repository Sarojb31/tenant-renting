import { Entity, Column } from 'typeorm';
import { TenantScopedEntity } from '@database/base/tenant-scoped.entity';
import { RoomType } from '@common/enums/room-type.enum';
import { ListingStatus } from '@common/enums/listing-status.enum';

@Entity('listings')
export class Listing extends TenantScopedEntity {
  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'room_type', type: 'enum', enum: RoomType })
  roomType!: RoomType;

  @Column({ name: 'rent_amount', type: 'decimal', precision: 12, scale: 2 })
  rentAmount!: string;

  @Column({ name: 'deposit_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  depositAmount!: string | null;

  @Column({ default: 'NPR' })
  currency!: string;

  @Column({ type: 'varchar', nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', nullable: true })
  city!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude!: string | null;

  @Column({ type: 'enum', enum: ListingStatus, default: ListingStatus.DRAFT })
  status!: ListingStatus;

  @Column({ name: 'available_from', type: 'date', nullable: true })
  availableFrom!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;
}
