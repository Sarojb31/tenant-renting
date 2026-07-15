import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAmenitiesTable1752451212000 implements MigrationInterface {
  name = 'CreateAmenitiesTable1752451212000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "amenities" (
        "id"       UUID    NOT NULL DEFAULT gen_random_uuid(),
        "name"     VARCHAR NOT NULL,
        "category" VARCHAR NOT NULL DEFAULT 'general',
        CONSTRAINT "PK_amenities" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_amenities_name" UNIQUE ("name"),
        CONSTRAINT "CHK_amenities_category" CHECK ("category" IN ('general', 'feasibility'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "listing_amenities" (
        "listing_id" UUID NOT NULL,
        "amenity_id" UUID NOT NULL,
        CONSTRAINT "PK_listing_amenities" PRIMARY KEY ("listing_id", "amenity_id"),
        CONSTRAINT "FK_listing_amenities_listing" FOREIGN KEY ("listing_id")
          REFERENCES "listings" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_listing_amenities_amenity" FOREIGN KEY ("amenity_id")
          REFERENCES "amenities" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_listing_amenities_amenity_id" ON "listing_amenities" ("amenity_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "listing_amenities"`);
    await queryRunner.query(`DROP TABLE "amenities"`);
  }
}
