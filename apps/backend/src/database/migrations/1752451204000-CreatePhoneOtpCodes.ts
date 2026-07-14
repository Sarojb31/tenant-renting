import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePhoneOtpCodes1752451204000 implements MigrationInterface {
  name = 'CreatePhoneOtpCodes1752451204000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "phone_otp_codes" (
        "id"          UUID      NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"   UUID      NOT NULL,
        "phone"       VARCHAR   NOT NULL,
        "code_hash"   VARCHAR   NOT NULL,
        "expires_at"  TIMESTAMP NOT NULL,
        "attempts"    INTEGER   NOT NULL DEFAULT 0,
        "used"        BOOLEAN   NOT NULL DEFAULT false,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_phone_otp_codes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_otp_tenant_phone" ON "phone_otp_codes" ("tenant_id", "phone")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "phone_otp_codes"`);
  }
}
