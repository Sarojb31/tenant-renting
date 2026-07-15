import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerFavorites1752451220000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE customer_favorites (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID NOT NULL,
        customer_id UUID NOT NULL,
        listing_id  UUID NOT NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, customer_id, listing_id)
      )
    `);

    await qr.query(`CREATE INDEX IDX_customer_favorites_customer ON customer_favorites(tenant_id, customer_id)`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query('DROP TABLE IF EXISTS customer_favorites');
  }
}
