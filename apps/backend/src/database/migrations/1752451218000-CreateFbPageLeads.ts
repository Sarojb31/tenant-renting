import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFbPageLeads1752451218000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE fb_page_leads (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID NOT NULL,
        fb_page_id          VARCHAR NOT NULL,
        fb_sender_psid      VARCHAR NOT NULL,
        message_text        TEXT NOT NULL,
        matched_customer_id UUID,
        created_at          TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await qr.query(`CREATE INDEX IDX_fb_page_leads_tenant ON fb_page_leads(tenant_id)`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query('DROP TABLE IF EXISTS fb_page_leads');
  }
}
