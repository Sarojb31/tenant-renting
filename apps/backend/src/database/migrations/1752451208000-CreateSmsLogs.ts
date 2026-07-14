import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSmsLogs1752451208000 implements MigrationInterface {
  name = 'CreateSmsLogs1752451208000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sms_logs" (
        "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"           UUID        NOT NULL,
        "customer_id"         UUID        NOT NULL,
        "listing_id"          UUID,
        "provider"            VARCHAR,
        "message_body"        TEXT        NOT NULL,
        "status"              VARCHAR     NOT NULL DEFAULT 'queued',
        "provider_message_id" VARCHAR,
        "sent_at"             TIMESTAMP,
        "created_at"          TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sms_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sms_logs_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sms_logs_customer" FOREIGN KEY ("customer_id")
          REFERENCES "customers" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sms_logs_listing" FOREIGN KEY ("listing_id")
          REFERENCES "listings" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_sms_logs_tenant_id" ON "sms_logs" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sms_logs_customer_id" ON "sms_logs" ("customer_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "sms_logs"`);
  }
}
