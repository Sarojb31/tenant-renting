import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenants1752451201000 implements MigrationInterface {
  name = 'CreateTenants1752451201000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "tenant_status_enum" AS ENUM ('trial', 'active', 'suspended', 'cancelled')
    `);
    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id"               UUID                  NOT NULL DEFAULT gen_random_uuid(),
        "name"             VARCHAR               NOT NULL,
        "subdomain"        VARCHAR               NOT NULL,
        "custom_domain"    VARCHAR,
        "logo_url"         VARCHAR,
        "theme_color"      VARCHAR,
        "country"          VARCHAR               NOT NULL,
        "default_currency" VARCHAR               NOT NULL DEFAULT 'NPR',
        "status"           "tenant_status_enum"  NOT NULL DEFAULT 'trial',
        "created_at"       TIMESTAMP             NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP             NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenants" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tenants_subdomain" UNIQUE ("subdomain")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_tenants_subdomain" ON "tenants" ("subdomain")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_tenants_subdomain"`);
    await queryRunner.query(`DROP TABLE "tenants"`);
    await queryRunner.query(`DROP TYPE "tenant_status_enum"`);
  }
}
