import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookings1752451209000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"   UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "listing_id"  UUID NOT NULL REFERENCES "listings"("id") ON DELETE RESTRICT,
        "customer_id" UUID NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
        "status"      VARCHAR(20) NOT NULL DEFAULT 'pending',
        "move_in_date" DATE,
        "amount_due"  NUMERIC(12,2) NOT NULL,
        "amount_paid" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_bookings_tenant_id" ON "bookings"("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "idx_bookings_customer_id" ON "bookings"("customer_id")`);
    await queryRunner.query(`CREATE INDEX "idx_bookings_listing_id" ON "bookings"("listing_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bookings"`);
  }
}
