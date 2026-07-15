import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptionPlans1752451215000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE subscription_plans (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR NOT NULL UNIQUE,
        max_listings    INT,
        max_staff_users INT,
        sms_credits_included INT NOT NULL DEFAULT 0,
        price_monthly   DECIMAL(10, 2) NOT NULL DEFAULT 0,
        price_currency  VARCHAR(3) NOT NULL DEFAULT 'USD',
        features        JSONB NOT NULL DEFAULT '{}',
        created_at      TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Seed default plans (Plan §11 pricing table)
    await qr.query(`
      INSERT INTO subscription_plans (name, max_listings, max_staff_users, sms_credits_included, price_monthly, features) VALUES
        ('free_trial', 10, 1, 50, 0, '{"analytics": false, "customBranding": false}'),
        ('basic',      150, 3, 200, 29.00, '{"analytics": false, "customBranding": false}'),
        ('pro',        NULL, NULL, 1000, 79.00, '{"analytics": true, "customBranding": true}'),
        ('enterprise', NULL, NULL, 5000, 199.00, '{"analytics": true, "customBranding": true, "apiAccess": true, "aiMatching": true}')
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query('DROP TABLE subscription_plans');
  }
}
