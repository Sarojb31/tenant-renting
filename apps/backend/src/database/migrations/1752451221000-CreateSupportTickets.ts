import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSupportTickets1752451221000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TYPE support_ticket_status_enum AS ENUM ('open', 'in_progress', 'resolved', 'closed')
    `);

    await qr.query(`
      CREATE TABLE support_tickets (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID,
        raised_by_user_id   UUID NOT NULL,
        subject             VARCHAR NOT NULL,
        description         TEXT NOT NULL,
        status              support_ticket_status_enum NOT NULL DEFAULT 'open',
        created_at          TIMESTAMP NOT NULL DEFAULT now(),
        updated_at          TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await qr.query(`CREATE INDEX IDX_support_tickets_tenant ON support_tickets(tenant_id)`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query('DROP TABLE IF EXISTS support_tickets');
    await qr.query('DROP TYPE IF EXISTS support_ticket_status_enum');
  }
}
