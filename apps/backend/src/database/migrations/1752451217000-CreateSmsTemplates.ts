import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSmsTemplates1752451217000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TYPE sms_template_event_enum AS ENUM ('new_match', 'booking_confirmed', 'rent_reminder', 'custom')
    `);

    await qr.query(`
      CREATE TABLE sms_templates (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
        name           VARCHAR NOT NULL,
        body_text      TEXT NOT NULL,
        event_trigger  sms_template_event_enum NOT NULL DEFAULT 'custom',
        created_at     TIMESTAMP NOT NULL DEFAULT now(),
        updated_at     TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await qr.query(`CREATE INDEX IDX_sms_templates_tenant ON sms_templates(tenant_id)`);

    // Add template_id + delivered_at to sms_logs (nullable — existing rows get NULL)
    await qr.query(`ALTER TABLE sms_logs ADD COLUMN template_id UUID REFERENCES sms_templates(id) ON DELETE SET NULL`);
    await qr.query(`ALTER TABLE sms_logs ADD COLUMN delivered_at TIMESTAMP`);

    // Seed platform-level default template (tenant_id = NULL)
    await qr.query(`
      INSERT INTO sms_templates (tenant_id, name, body_text, event_trigger) VALUES
        (NULL, 'Default Match Alert', 'New room available: "{{title}}" for {{rentAmount}} in {{city}}. Reply STOP to opt out.', 'new_match'),
        (NULL, 'Booking Confirmed', 'Your booking for "{{title}}" is confirmed. Move-in: {{moveInDate}}.', 'booking_confirmed'),
        (NULL, 'Rent Reminder', 'Reminder: rent of {{rentAmount}} for "{{title}}" is due in 3 days.', 'rent_reminder')
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query('ALTER TABLE sms_logs DROP COLUMN IF EXISTS delivered_at');
    await qr.query('ALTER TABLE sms_logs DROP COLUMN IF EXISTS template_id');
    await qr.query('DROP TABLE sms_templates');
    await qr.query('DROP TYPE sms_template_event_enum');
  }
}
