import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('customer_favorites')
export class CustomerFavorite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
