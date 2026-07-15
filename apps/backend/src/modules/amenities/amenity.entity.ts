import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { AmenityCategory } from '@common/enums/amenity-category.enum';
import { Listing } from '@modules/listings/listing.entity';

@Entity('amenities')
export class Amenity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ type: 'varchar', default: AmenityCategory.GENERAL })
  category!: AmenityCategory;

  @ManyToMany(() => Listing, (l) => l.amenities)
  listings!: Listing[];
}
