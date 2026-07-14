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

## Other Commands

```bash
pnpm build    # build all apps
pnpm test     # run all test suites
pnpm lint     # lint all packages
```
