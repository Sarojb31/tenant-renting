import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerPasswordHash1752451211000 implements MigrationInterface {
  name = 'AddCustomerPasswordHash1752451211000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN "password_hash" VARCHAR`);
    await queryRunner.query(
      `CREATE INDEX "IDX_customers_tenant_email" ON "customers" ("tenant_id", "email") WHERE "email" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_customers_tenant_email"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "password_hash"`);
  }
}
