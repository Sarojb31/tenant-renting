import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantFacebookConnections1752451223000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TYPE fb_connection_method_enum AS ENUM ('oauth_shared_app', 'byo_app')
    `);

    await qr.query(`
      CREATE TABLE tenant_facebook_connections (
        tenant_id          UUID PRIMARY KEY,
        connection_method  fb_connection_method_enum NOT NULL DEFAULT 'oauth_shared_app',
        fb_page_id         VARCHAR NOT NULL,
        fb_page_name       VARCHAR NOT NULL,
        page_access_token  TEXT NOT NULL,
        fb_app_id          VARCHAR,
        fb_app_secret      TEXT,
        connected_by       UUID NOT NULL,
        connected_at       TIMESTAMP NOT NULL DEFAULT now(),
        token_expires_at   TIMESTAMP
      )
    `);

    await qr.query(`
      CREATE UNIQUE INDEX IDX_fb_connections_page_id ON tenant_facebook_connections (fb_page_id)
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query('DROP TABLE IF EXISTS tenant_facebook_connections');
    await qr.query('DROP TYPE IF EXISTS fb_connection_method_enum');
  }
}
