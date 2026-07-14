import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayments1752451210000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"              UUID REFERENCES "tenants"("id") ON DELETE SET NULL,
        "payable_type"           VARCHAR(20) NOT NULL,
        "payable_id"             UUID NOT NULL,
        "gateway"                VARCHAR(20) NOT NULL,
        "gateway_transaction_id" VARCHAR(255),
        "amount"                 NUMERIC(12,2) NOT NULL,
        "currency"               CHAR(3) NOT NULL,
        "status"                 VARCHAR(20) NOT NULL DEFAULT 'pending',
        "raw_response"           JSONB,
        "created_at"             TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_payments_tenant_id" ON "payments"("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "idx_payments_payable" ON "payments"("payable_type", "payable_id")`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uniq_payments_gateway_txn"
      ON "payments"("gateway", "gateway_transaction_id")
      WHERE "gateway_transaction_id" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
  }
}
