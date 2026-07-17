import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerImages1752500001000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE customer_images (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID NOT NULL,
        customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
        url         TEXT NOT NULL,
        type        VARCHAR NOT NULL DEFAULT 'other',
        sort_order  INT NOT NULL DEFAULT 0,
        created_at  TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`CREATE INDEX IDX_customer_images_customer ON customer_images (customer_id)`);
    await qr.query(`CREATE INDEX IDX_customer_images_tenant  ON customer_images (tenant_id)`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS customer_images`);
  }
}
