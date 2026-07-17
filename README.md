# RoomFinder SaaS

Turbo monorepo — NestJS backend + two React frontends.

## Apps & Ports

| App | URL | Description |
|-----|-----|-------------|
| `backend` | http://localhost:3000 | NestJS REST API |
| `customer-web` | http://localhost:5173 | Tenant-facing React app |
| `admin-console` | http://localhost:5174 | Admin React dashboard |
| Swagger docs | http://localhost:3000/api/docs | Auto-generated API docs (dev only) |
| pgAdmin | http://localhost:5050 | DB GUI (optional, see below) |

## Prerequisites

- Node >= 20
- pnpm >= 9 (`npm i -g pnpm`)
- Docker + Docker Compose

## One-Command Start

```bash
# Clone, install, configure env, then:
docker-compose up -d && pnpm install && pnpm dev
```

This starts Postgres + Redis in Docker, installs all workspace deps, and launches all three apps concurrently via Turborepo.

## Full Setup (First Time)

### 1. Start infrastructure

```bash
docker-compose up -d
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure backend environment

```bash
cp apps/backend/.env.example apps/backend/.env   # if .env.example exists
# OR create apps/backend/.env manually:
```

**`apps/backend/.env`** — required vars:

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://roomfinder:roomfinder_dev@localhost:5432/roomfinder
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=your_access_secret_min_32_chars_here
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars_here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

APP_BASE_URL=http://localhost:3000
CUSTOMER_APP_BASE_URL=http://localhost:5173

# Optional — leave blank to disable
SMS_SPARROW_API_KEY=
SMS_TWILIO_ACCOUNT_SID=
SMS_TWILIO_AUTH_TOKEN=
SMS_TWILIO_FROM=

PAYMENT_STRIPE_SECRET_KEY=
PAYMENT_STRIPE_WEBHOOK_SECRET=
PAYMENT_ESEWA_MERCHANT_ID=
PAYMENT_KHALTI_SECRET_KEY=

S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_REGION=ap-south-1
S3_ENDPOINT=

FB_PAGE_ACCESS_TOKEN=
FB_WEBHOOK_VERIFY_TOKEN=
```

### 4. Start all apps

```bash
pnpm dev
```

## Individual App Commands

```bash
# backend only
pnpm --filter @roomfinder/backend dev

# customer-web only
pnpm --filter @roomfinder/customer-web dev

# admin-console only
pnpm --filter @roomfinder/admin-console dev
```

## Database

```bash
# Run migrations (after backend builds)
pnpm --filter @roomfinder/backend migration:run

# Revert last migration
pnpm --filter @roomfinder/backend migration:revert
```

## Optional Tools

```bash
# pgAdmin at http://localhost:5050
# Login: admin@roomfinder.local / admin
docker-compose --profile tools up -d
```

## Seed Data (Dev Login Credentials)

After running migrations, seed the database to create admin accounts:

```bash
cd apps/backend && npm run seed
```

This creates:

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| **Super Admin** | `superadmin@roomfinder.dev` | `SuperAdmin123!` | Platform-wide access, no tenant |
| **Company Admin** | `admin@demo-property.com` | `Admin123!` | Tenant: *Demo Property Co.* |
| **Demo Customer** | `demo@customer.com` | `Customer123!` | Tenant: *Demo Property Co.* |

**Access the Admin Console** at http://localhost:5174

- Super Admin → redirected to `/super/dashboard` (platform overview + tenant management)
- Company Admin → redirected to `/company/dashboard` (listings, customers, payments)

**Access the Customer App** at http://localhost:5173

- Login via Phone OTP (tab 1) or Email+Password (tab 2)
- Demo customer email: `demo@customer.com` / `Customer123!`

**API login** (for Swagger/curl testing):
```bash
# Admin login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@roomfinder.dev","password":"SuperAdmin123!"}'

# Customer email login (requires x-tenant-id header)
curl -X POST http://localhost:3000/api/auth/customer/email-login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: <demo-tenant-uuid>" \
  -d '{"email":"demo@customer.com","password":"Customer123!"}'
```

> Re-running `npm run seed` is safe — uses `ON CONFLICT ... DO UPDATE` and `ON CONFLICT ... DO NOTHING`.

## Other Commands

```bash
pnpm build    # build all apps
pnpm test     # run all test suites
pnpm lint     # lint all packages
```
Good — I have the full picture. Now writing the guide:

---
Remaining Steps to Pilot-Ready

Step 1 — Update apps/backend/.env

The .env.example is missing several keys. Add these to your actual .env:

env
# Already in .env.example — verify these are set:
APP_BASE_URL=http://localhost:3000
CUSTOMER_APP_BASE_URL=http://localhost:5173
ADMIN_APP_BASE_URL=http://localhost:5174

# Missing from .env.example — add these:
FB_APP_ID=
FB_APP_SECRET=
ENCRYPTION_KEY=          # 64-char hex (32 bytes) — generate below

Generate ENCRYPTION_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

---
Step 2 — eSewa Sandbox

1. Go to https://rc-epay.esewa.com.np (eSewa UAT portal)
2. Log in with eSewa test credentials:
  - Phone: 9806800001 / Password: Nepal@123
  - MPIN: 1122
3. Create a merchant account → get Merchant Code and Secret Key
4. Add to .env:
env
PAYMENT_ESEWA_MERCHANT_ID=<your_merchant_code>
PAYMENT_ESEWA_SECRET=<your_secret_key>
5. Test: NODE_ENV=development already points the adapter to rc-epay.esewa.com.np

---
Step 3 — Khalti Sandbox

1. Go to https://khalti.com → sign up as merchant
2. In dashboard → Test Credentials section, get the Test Secret Key
3. Add to .env:
env
PAYMENT_KHALTI_SECRET_KEY=<your_test_secret_key>
4. Test wallet credentials: 9800000000 / Test@12345
5. NODE_ENV=development already points adapter to a.khalti.com (sandbox)

---

---
Step 4 — Stripe Sandbox

1. Go to https://dashboard.stripe.com → create account
2. Developers → API keys: copy Secret key (sk_test_...)
3. Developers → Webhooks: add endpoint http://localhost:3000/payments/webhook/stripe (use Stripe CLI (https://stripe.com/docs/stripe-cli) for local testing):
stripe listen --forward-to localhost:3000/payments/webhook/stripe
That command prints a Webhook signing secret (whsec_...)
4. Add to .env:
env
PAYMENT_STRIPE_SECRET_KEY=sk_test_...
PAYMENT_STRIPE_WEBHOOK_SECRET=whsec_...
5. Test card: 4242 4242 4242 4242 / any future date / any CVC

---
Step 5 — Facebook App (for lead capture)

1. Go to https://developers.facebook.com → My Apps → Create App
2. Choose Business type
3. Settings → Basic: copy App ID and App Secret
4. Add Facebook Login product → set Valid OAuth Redirect URI:
http://localhost:3000/facebook/callback
5. Add Webhooks product → subscribe to messages events on your Page
6. Add to .env:
env
FB_APP_ID=<your_app_id>
FB_APP_SECRET=<your_app_secret>
FB_WEBHOOK_VERIFY_TOKEN=<any_random_string_you_choose>
7. Connect a Facebook Page from the admin console → Company → Facebook Leads

---
Step 6 — File Storage (for production images)

Currently using NullStorageAdapter (images aren't actually stored). For pilot, use Cloudflare R2 (S3-compatible, free tier):

1. https://dash.cloudflare.com → R2 → Create Bucket (roomfinder-dev)
2. Manage R2 API tokens → Create token with Object Read/Write
3. Add to .env:
env
S3_BUCKET=roomfinder-dev
S3_ACCESS_KEY=<r2_access_key>
S3_SECRET_KEY=<r2_secret_key>
S3_REGION=auto
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
Without this, image uploads succeed (no error) but URLs won't be real. Fine for initial testing.

---
Step 7 — SMS (for matching notifications)

For Nepal pilot, use Sparrow SMS:
1. https://sparrowsms.com → register → get API key
2. Add to .env:
env
SMS_SPARROW_API_KEY=<your_key>
SMS_SPARROW_FROM=RoomFinder

---
Step 8 — Update .env.example
