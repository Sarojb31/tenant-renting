import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReviews1752451219000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE reviews (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID NOT NULL,
        listing_id  UUID NOT NULL,
        customer_id UUID NOT NULL,
        rating      INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment     TEXT,
        created_at  TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, listing_id, customer_id)
      )
    `);

    await qr.query(`CREATE INDEX IDX_reviews_listing ON reviews(tenant_id, listing_id)`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query('DROP TABLE IF EXISTS reviews');
  }
}
