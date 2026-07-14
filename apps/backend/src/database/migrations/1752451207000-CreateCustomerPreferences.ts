import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerPreferences1752451207000 implements MigrationInterface {
  name = 'CreateCustomerPreferences1752451207000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "customer_preferences" (
        "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
        "customer_id"       UUID        NOT NULL,
        "tenant_id"         UUID        NOT NULL,
        "locations"         JSONB,
        "budget_min"        DECIMAL(12,2),
        "budget_max"        DECIMAL(12,2),
        "room_type"         VARCHAR,
        "move_in_date"      DATE,
        "amenities_wanted"  JSONB,
        "active"            BOOLEAN     NOT NULL DEFAULT true,
        "created_at"        TIMESTAMP   NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_preferences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_customer_preferences_customer" UNIQUE ("customer_id"),
        CONSTRAINT "FK_customer_preferences_customer" FOREIGN KEY ("customer_id")
          REFERENCES "customers" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_customer_preferences_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_customer_preferences_tenant" ON "customer_preferences" ("tenant_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "customer_preferences"`);
  }
}
