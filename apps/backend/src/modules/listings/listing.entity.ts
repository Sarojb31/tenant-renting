import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { TenantScopedEntity } from '@database/base/tenant-scoped.entity';
import { RoomType } from '@common/enums/room-type.enum';
import { BhkType } from '@common/enums/bhk-type.enum';
import { ListingStatus } from '@common/enums/listing-status.enum';
import { SubmissionSource } from '@common/enums/submission-source.enum';
import { Amenity } from '@modules/amenities/amenity.entity';

@Entity('listings')
export class Listing extends TenantScopedEntity {
  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'room_type', type: 'enum', enum: RoomType })
  roomType!: RoomType;

  @Column({ name: 'bhk_type', type: 'enum', enum: BhkType, nullable: true })
  bhkType!: BhkType | null;

  @Column({ name: 'number_of_rooms', type: 'int', nullable: true })
  numberOfRooms!: number | null;

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

  @Column({
    name: 'submission_source',
    type: 'enum',
    enum: SubmissionSource,
    default: SubmissionSource.STAFF_CREATED,
  })
  submissionSource!: SubmissionSource;

  @Column({ name: 'owner_name', type: 'varchar', nullable: true })
  ownerName!: string | null;

  @Column({ name: 'owner_phone', type: 'varchar', nullable: true })
  ownerPhone!: string | null;

  @Column({ name: 'owner_email', type: 'varchar', nullable: true })
  ownerEmail!: string | null;

  @ManyToMany(() => Amenity, (a) => a.listings, { eager: false })
  @JoinTable({
    name: 'listing_amenities',
    joinColumn: { name: 'listing_id' },
    inverseJoinColumn: { name: 'amenity_id' },
  })
  amenities!: Amenity[];
}
