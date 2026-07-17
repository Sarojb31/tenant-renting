import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingPlanToSubscriptions1752500000000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE tenant_subscriptions
        ADD COLUMN IF NOT EXISTS pending_plan_id UUID NULL
          REFERENCES subscription_plans (id) ON DELETE SET NULL
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE tenant_subscriptions DROP COLUMN IF EXISTS pending_plan_id`);
  }
}
