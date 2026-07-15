import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddListingBhkRooms1752451213000 implements MigrationInterface {
  name = 'AddListingBhkRooms1752451213000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "bhk_type_enum" AS ENUM ('studio', '1bhk', '2bhk', '3bhk', '4bhk_plus')`,
    );
    await queryRunner.query(`ALTER TABLE "listings" ADD COLUMN "bhk_type" "bhk_type_enum"`);
    await queryRunner.query(`ALTER TABLE "listings" ADD COLUMN "number_of_rooms" INT`);
    // Composite index for cursor pagination: (tenant_id, status, created_at DESC, id DESC)
    await queryRunner.query(
      `CREATE INDEX "IDX_listings_cursor" ON "listings" ("tenant_id", "status", "created_at" DESC, "id" DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_listings_cursor"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "number_of_rooms"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "bhk_type"`);
    await queryRunner.query(`DROP TYPE "bhk_type_enum"`);
  }
}
