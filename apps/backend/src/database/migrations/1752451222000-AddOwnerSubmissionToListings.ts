import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOwnerSubmissionToListings1752451222000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    // submission_source enum + new listing columns (additive — existing rows default to staff_created)
    await runner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_submission_source_enum') THEN
          CREATE TYPE listing_submission_source_enum AS ENUM ('staff_created', 'owner_submitted');
        END IF;
      END $$;
    `);

    await runner.query(`
      ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS submission_source listing_submission_source_enum NOT NULL DEFAULT 'staff_created',
        ADD COLUMN IF NOT EXISTS owner_name        VARCHAR(200)  NULL,
        ADD COLUMN IF NOT EXISTS owner_phone       VARCHAR(30)   NULL,
        ADD COLUMN IF NOT EXISTS owner_email       VARCHAR(200)  NULL;
    `);

    // Index for the admin review queue filter
    await runner.query(`
      CREATE INDEX IF NOT EXISTS IDX_listings_submission_source
        ON listings (tenant_id, submission_source);
    `);

    // Extend sms_template_event_trigger enum with two new values
    await runner.query(`ALTER TYPE sms_template_event_enum ADD VALUE IF NOT EXISTS 'owner_submission_received';`);
    await runner.query(`ALTER TYPE sms_template_event_enum ADD VALUE IF NOT EXISTS 'owner_submission_approved';`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP INDEX IF EXISTS IDX_listings_submission_source;`);
    await runner.query(`
      ALTER TABLE listings
        DROP COLUMN IF EXISTS submission_source,
        DROP COLUMN IF EXISTS owner_name,
        DROP COLUMN IF EXISTS owner_phone,
        DROP COLUMN IF EXISTS owner_email;
    `);
    await runner.query(`DROP TYPE IF EXISTS listing_submission_source_enum;`);
    // Note: Postgres does not support removing enum values; sms_template_event_enum
    // values owner_submission_received / owner_submission_approved remain on rollback.
  }
}
