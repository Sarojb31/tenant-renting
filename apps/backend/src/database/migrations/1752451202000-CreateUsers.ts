import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1752451202000 implements MigrationInterface {
  name = 'CreateUsers1752451202000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('super_admin', 'company_admin', 'staff', 'agent')
    `);
    await queryRunner.query(`
      CREATE TYPE "user_status_enum" AS ENUM ('active', 'invited', 'disabled')
    `);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"                  UUID               NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"           UUID,
        "name"                VARCHAR            NOT NULL,
        "email"               VARCHAR            NOT NULL,
        "phone"               VARCHAR,
        "password_hash"       VARCHAR            NOT NULL,
        "role"                "user_role_enum"   NOT NULL,
        "status"              "user_status_enum" NOT NULL DEFAULT 'active',
        "refresh_token_hash"  VARCHAR,
        "last_login_at"       TIMESTAMP,
        "created_at"          TIMESTAMP          NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMP          NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "FK_users_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE SET NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_status_enum"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
  }
}
