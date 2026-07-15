import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantSubscriptions1752451216000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TYPE subscription_status_enum AS ENUM ('active', 'past_due', 'cancelled')
    `);

    await qr.query(`
      CREATE TABLE tenant_subscriptions (
        id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        plan_id                UUID NOT NULL REFERENCES subscription_plans(id),
        status                 subscription_status_enum NOT NULL DEFAULT 'active',
        current_period_start   TIMESTAMP NOT NULL DEFAULT now(),
        current_period_end     TIMESTAMP NOT NULL DEFAULT (now() + interval '30 days'),
        sms_credits_remaining  INT NOT NULL DEFAULT 0,
        created_at             TIMESTAMP NOT NULL DEFAULT now(),
        updated_at             TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE(tenant_id)
      )
    `);

    await qr.query(`CREATE INDEX IDX_tenant_subscriptions_tenant ON tenant_subscriptions(tenant_id)`);

    // Assign free_trial plan to all existing tenants
    await qr.query(`
      INSERT INTO tenant_subscriptions (tenant_id, plan_id, sms_credits_remaining)
      SELECT t.id, p.id, p.sms_credits_included
      FROM tenants t
      CROSS JOIN subscription_plans p
      WHERE p.name = 'free_trial'
      ON CONFLICT (tenant_id) DO NOTHING
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query('DROP TABLE tenant_subscriptions');
    await qr.query('DROP TYPE subscription_status_enum');
  }
}
