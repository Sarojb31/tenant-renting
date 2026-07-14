import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateListings1752451205000 implements MigrationInterface {
  name = 'CreateListings1752451205000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "room_type_enum" AS ENUM ('single', 'shared', 'pg', 'apartment', 'studio')
    `);
    await queryRunner.query(`
      CREATE TYPE "listing_status_enum" AS ENUM ('draft', 'pending_review', 'published', 'occupied', 'archived')
    `);
    await queryRunner.query(`
      CREATE TABLE "listings" (
        "id"               UUID                   NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"        UUID                   NOT NULL,
        "title"            VARCHAR                NOT NULL,
        "description"      TEXT,
        "room_type"        "room_type_enum"       NOT NULL,
        "rent_amount"      NUMERIC(12,2)          NOT NULL,
        "deposit_amount"   NUMERIC(12,2),
        "currency"         VARCHAR                NOT NULL DEFAULT 'NPR',
        "address"          VARCHAR,
        "city"             VARCHAR,
        "latitude"         NUMERIC(10,7),
        "longitude"        NUMERIC(10,7),
        "status"           "listing_status_enum"  NOT NULL DEFAULT 'draft',
        "available_from"   DATE,
        "created_by"       UUID,
        "created_at"       TIMESTAMP              NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP              NOT NULL DEFAULT now(),
        CONSTRAINT "PK_listings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_listings_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_listings_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_listings_tenant_id" ON "listings" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_listings_status" ON "listings" ("tenant_id", "status")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "listings"`);
    await queryRunner.query(`DROP TYPE "listing_status_enum"`);
    await queryRunner.query(`DROP TYPE "room_type_enum"`);
  }
}
