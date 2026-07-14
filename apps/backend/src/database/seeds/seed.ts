/**
 * Dev seed — creates a super admin, a demo tenant, and a company admin.
 * Run: cd apps/backend && npm run seed
 *
 * Credentials after seeding:
 *   Super Admin  — superadmin@roomfinder.dev / SuperAdmin123!
 *   Company Admin — admin@demo-property.com  / Admin123!
 */
import { Client } from 'pg';
import * as argon2 from 'argon2';

// DATABASE_URL is loaded by dotenv-cli before this script runs

const SUPER_ADMIN_ID   = '00000000-0000-0000-0000-000000000001';
const DEMO_TENANT_ID   = '00000000-0000-0000-0000-000000000010';
const COMPANY_ADMIN_ID = '00000000-0000-0000-0000-000000000002';
const DEMO_CUSTOMER_ID = '00000000-0000-0000-0000-000000000003';

async function seed() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    /* ------------------------------------------------------------------ */
    /* 1. Super admin (no tenant)                                          */
    /* ------------------------------------------------------------------ */
    const superHash = await argon2.hash('SuperAdmin123!');
    await client.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, role, status)
       VALUES ($1, NULL, $2, $3, $4, 'super_admin', 'active')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [SUPER_ADMIN_ID, 'Platform Super Admin', 'superadmin@roomfinder.dev', superHash],
    );
    console.log('✓ Super admin  superadmin@roomfinder.dev');

    /* ------------------------------------------------------------------ */
    /* 2. Demo tenant                                                      */
    /* ------------------------------------------------------------------ */
    await client.query(
      `INSERT INTO tenants (id, name, subdomain, country, status)
       VALUES ($1, $2, $3, 'NP', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [DEMO_TENANT_ID, 'Demo Property Co.', 'demo-property'],
    );
    console.log('✓ Demo tenant  demo-property.roomfinder.app');

    /* ------------------------------------------------------------------ */
    /* 3. Company admin for the demo tenant                                */
    /* ------------------------------------------------------------------ */
    const adminHash = await argon2.hash('Admin123!');
    await client.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, 'company_admin', 'active')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [COMPANY_ADMIN_ID, DEMO_TENANT_ID, 'Demo Admin', 'admin@demo-property.com', adminHash],
    );
    console.log('✓ Company admin admin@demo-property.com  (tenant: Demo Property Co.)');

    /* ------------------------------------------------------------------ */
    /* 4. Demo customer for the demo tenant                                */
    /* ------------------------------------------------------------------ */
    const customerHash = await argon2.hash('Customer123!');
    await client.query(
      `INSERT INTO customers (id, tenant_id, name, phone, email, password_hash, phone_verified)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             password_hash = EXCLUDED.password_hash`,
      [DEMO_CUSTOMER_ID, DEMO_TENANT_ID, 'Demo Customer', '+9779800000001', 'demo@customer.com', customerHash],
    );
    console.log('✓ Demo customer demo@customer.com  (tenant: Demo Property Co.)');

    console.log('\nSeed complete. See README.md for login instructions.');
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
