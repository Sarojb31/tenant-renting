import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateListingImages1752451206000 implements MigrationInterface {
  name = 'CreateListingImages1752451206000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "listing_images" (
        "id"          UUID      NOT NULL DEFAULT gen_random_uuid(),
        "listing_id"  UUID      NOT NULL,
        "url"         VARCHAR   NOT NULL,
        "sort_order"  INTEGER   NOT NULL DEFAULT 0,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_listing_images" PRIMARY KEY ("id"),
        CONSTRAINT "FK_listing_images_listing" FOREIGN KEY ("listing_id")
          REFERENCES "listings" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_listing_images_listing_id" ON "listing_images" ("listing_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "listing_images"`);
  }
}
