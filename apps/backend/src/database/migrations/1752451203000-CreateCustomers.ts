import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomers1752451203000 implements MigrationInterface {
  name = 'CreateCustomers1752451203000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id"                  UUID               NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"           UUID               NOT NULL,
        "name"                VARCHAR,
        "phone"               VARCHAR            NOT NULL,
        "email"               VARCHAR,
        "phone_verified"      BOOLEAN            NOT NULL DEFAULT false,
        "sms_opt_in"          BOOLEAN            NOT NULL DEFAULT true,
        "preferred_language"  VARCHAR,
        "refresh_token_hash"  VARCHAR,
        "created_at"          TIMESTAMP          NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMP          NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_customers_tenant_phone" UNIQUE ("tenant_id", "phone"),
        CONSTRAINT "FK_customers_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_customers_tenant_id" ON "customers" ("tenant_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "customers"`);
  }
}
