import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPreferenceBhkType1752451214000 implements MigrationInterface {
  name = 'AddPreferenceBhkType1752451214000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer_preferences" ADD COLUMN "bhk_type" VARCHAR`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer_preferences" DROP COLUMN "bhk_type"`,
    );
  }
}
