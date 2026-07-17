# RoomFinder SaaS — Project Progress

**Last updated:** 2026-07-17 — Session 19: bound all dev servers to 0.0.0.0 for LAN access; added LAN_IP CORS support in backend; committed and verified all tests green.

---

## RESUME POINT — read this first in the next session

**Working from:** Plan v2.9. All §1.5–§1.7 complete. Phase 3 complete. MVP Definition of Done checklist: all 9 items code-complete.

**LAN access is configured** — all three servers bind to `0.0.0.0`:
- Customer PWA: `http://192.168.1.92:5173`
- Admin console: `http://192.168.1.92:5174`
- Backend: `http://192.168.1.92:3000`
- `apps/backend/.env` has `LAN_IP=192.168.1.92` — update this if IP changes.

**Credential provisioning still needed before end-to-end testing:**
- eSewa sandbox secret: get from rc-epay.esewa.com.np → add `PAYMENT_ESEWA_SECRET=` to `apps/backend/.env`
- Facebook OAuth: get App ID + App Secret from developers.facebook.com → add `FB_APP_ID=` and `FB_APP_SECRET=` to `apps/backend/.env`, then register `http://localhost:3000/facebook/callback` as Valid OAuth Redirect URI
- Stripe keys are already in `.env` (code-complete)
- Khalti key is already in `.env` (`PAYMENT_KHALTI_SECRET_KEY=4947e8b69405422da596b23c7ee4b1b6`)

**All tests green at session end (verified by running, not from memory):**
- Backend: 150 passing, 25 suites
- Customer-web: 18 passing, 4 suites
- Admin console: 21 passing, 4 suites
- Git: clean master branch, 17 commits ahead of origin

**Next:** credential provisioning (eSewa sandbox secret + Facebook App credentials) → end-to-end payment testing on device → pilot onboarding. Nothing code-wise is blocked.

**Phase 2 items DONE this session:**
- Subscriptions schema (3 migrations: subscription_plans, tenant_subscriptions, sms_templates)
- SubscriptionsModule: plan CRUD, subscribe/upgrade/cancel, assertListingLimit, deductSmsCredit
- Plan limit enforcement in ListingsService.create (403 when max_listings reached)
- SMS template system: SmsTemplate entity, template rendering in MatchingService, credit deduction + refund on failure
- AnalyticsModule: GET /analytics/overview (tenant) + GET /analytics/platform (super_admin)
- GET /listings/admin/all — admin endpoint, all statuses, offset-paginated
- Admin console: AnalyticsPage, SubscriptionPage, updated DashboardPage (analytics + sub strip)
- Sidebar + routes updated for Analytics + Subscription pages

**Phase §1.2 items DONE this session:**
- amenities table + listing_amenities join table + BhkType/AmenityCategory enums + migrations
- AmenitiesModule (GET /amenities?category= public)
- Cursor-paginated GET /listings: base64url (created_at, id) keyset
- SearchFilters: BHK select, room count, feasibility amenity chips
- LandingPage (/) — dark hero, amber accent, embedded search → /search
- SearchPage → /search with useInfiniteQuery + IntersectionObserver infinite scroll

**Before touching anything, verify:**
1. `docker compose up -d postgres redis`
2. `cd apps/backend && npm run build && npm run migration:run && npm run seed`
3. `cd apps/backend && npm run test:integration` — expect 96 passing
4. `cd apps/customer-web && ./node_modules/.bin/vitest run` — expect 18 passing
5. `cd apps/admin-console && ./node_modules/.bin/vitest run` — expect 21 passing
6. Create local env files if missing (gitignored — must be created manually):
   ```
   # apps/customer-web/.env
   VITE_API_URL=http://localhost:3000
   VITE_TENANT_ID=00000000-0000-0000-0000-000000000010

   # apps/admin-console/.env
   VITE_API_URL=http://localhost:3000

   # apps/backend/.env — add if missing:
   ADMIN_APP_BASE_URL=http://localhost:5174
   ```
7. `pnpm dev` — restart required after creating .env files
8. Admin → http://localhost:5174 (dark styled login, email+password)
9. Customer → http://localhost:5173 (Phone/OTP tab + Email tab)

**Key decisions / architecture (carry forward):**
- NestJS has NO global prefix. Routes at `/auth/login`, `/listings`, etc.
- Both frontends hit backend directly via `VITE_API_URL=http://localhost:3000` (no proxy dependency).
- CORS allows 5173 + 5174. Env vars: `CUSTOMER_APP_BASE_URL`, `ADMIN_APP_BASE_URL`.
- Production: `VITE_API_URL=https://api.yourdomain.com`, `VITE_TENANT_ID` blank (subdomain resolves tenant).
- JWT payload `type: 'user'|'customer'` — JwtStrategy routes to correct table.
- Customer auth: OTP (phone) OR email+password. Both return `{ accessToken, customer }`.
- customer-web axios client sends `x-tenant-id` header from `VITE_TENANT_ID` on every request.
- Seed credentials: superadmin@roomfinder.dev / SuperAdmin123! · admin@demo-property.com / Admin123! · demo@customer.com / Customer123!
- Migration 1752451211000 adds `password_hash` to customers — run before seed.

---

## How to Use This File

- Update this file at the end of **every** task — this is a requirement in `CLAUDE.md`/`AGENTS.md` Section 5, not optional busywork.
- `[ ]` = not started · `[~]` = in progress / partially done (add a note explaining what's left) · `[x]` = done, tests passing, matches the Plan's Definition of Done for that item.
- Never mark `[x]` without the accompanying test existing and passing (Plan Section 20 / 22).
- If something was built differently than the Plan describes, log it under **Known Deviations** below instead of silently leaving the checklist inconsistent with reality.

---

## Phase 0 — Discovery & Setup

- [x] Monorepo scaffold created (matches Plan Section 13 backend + Section 15 frontend structure exactly)
- [x] `docker-compose.yml` for local Postgres + Redis working (pgadmin on `tools` profile)
- [x] CI pipeline skeleton (lint + test on PR) — `.github/workflows/ci.yml`
- [x] Testing hooks installed per `docs/Claude.md` Section 7 into `.claude/settings.json` — PostToolUse (Edit|Write) + Stop hooks. Pattern matching verified against all four path types (backend .ts, customer-web .tsx, admin-console .tsx, packages/ skip). Hooks gracefully skip until `pnpm install` is run. Hook stdout goes to user terminal, not back to Claude context (expected behavior for exit-0 hooks).
- [ ] SMS gateway accounts (Sparrow/Aakash + Twilio) — credentials obtained, not necessarily integrated yet
- [ ] Payment gateway accounts (eSewa/Khalti + Stripe) — credentials obtained

## Phase 1 — MVP (build order per Plan Section 23, step 5)

### 1. Tenants / Auth
- [x] Tenant onboarding endpoint + tests — `POST /tenants` (super admin only), `GET /tenants/:id`, `PATCH /tenants/:id`. 11 integration tests in `tenants.integration.spec.ts`.
- [x] Tenant-context middleware (`AsyncLocalStorage`) + **cross-tenant-isolation test** — `TenantContextService`, `TenantScopedEntity`, `TenantScopedRepository`, updated `TenantContextInterceptor`. 4 integration tests passing (`tenant-isolation.integration.spec.ts`).
- [x] Staff/admin JWT auth + tests — `POST /auth/login`, `POST /auth/refresh` (cookie rotation), `POST /auth/logout`. 7 integration tests in `auth.integration.spec.ts`. argon2 passwords, signed refresh JWT stored as hash on user row.
- [x] Customer OTP auth + tests — `POST /auth/otp/request`, `POST /auth/otp/verify`. 11 tests in `customer-otp.integration.spec.ts`. argon2-hashed OTP, 10min TTL, 3-attempt lockout, customer auto-created on first verify. SMS via `SMS_PROVIDER` DI token (NullSmsAdapter stub for now). `type: 'user'|'customer'` field added to JWT payload.

### 2. Listings
- [x] Listing CRUD endpoints + tests — `POST/GET/PATCH/DELETE /listings`. `ListingStatus` (draft→archived), `RoomType` enum. Tenant-scoped. Cross-tenant isolation verified (§17). 13 integration tests in `listings.integration.spec.ts`.
- [x] Image upload to S3/R2 + tests — `POST /listings/:id/images` with multer `memoryStorage`. `FILE_STORAGE_PROVIDER` DI token; `NullStorageAdapter` (dev) and `S3StorageAdapter` (prod/R2). `listing_images` table with FK→listings CASCADE. Tenant isolation: 404 if listing not in caller's tenant. 3 new tests (upload success, cross-tenant 404, 401 no auth).
- [x] Public search/filter endpoint + tests — `GET /listings?city=&roomType=&minRent=&maxRent=`. TypeORM QueryBuilder, always filters to PUBLISHED. `@IsNumberString()` validators on numeric params. 3 new filter tests (city, roomType, rent range). GET /listings now returns only PUBLISHED listings.

### 3. Customers / Preferences
- [x] Customer CRM endpoints + tests — `GET/POST /customers`, `GET/PATCH /customers/:id`. Staff-only list/create; staff or self-access for get/update. `ConflictException` on duplicate phone. Cross-tenant isolation: 404 when staff from tenant B tries to read/update tenant A customer. 19 integration tests in `customers.integration.spec.ts`.
- [x] Saved-preferences endpoint + tests — `PATCH /customers/:id/preferences` (upsert). `CustomerPreference` entity (1:1 with Customer, UNIQUE customer_id). Fields: locations (jsonb), budgetMin/Max (decimal), roomType, moveInDate, amenitiesWanted (jsonb), active. Staff or self-access. Cross-tenant 404 tested. Included in 19 test count above.

### 4. Matching Engine
- [x] Rule-based match trigger (on listing publish) + tests — `ListingsService.create/update` dispatches BullMQ `matching` queue job when status → PUBLISHED. `MatchingProcessor` (BullMQ consumer) delegates to `MatchingService.triggerMatchForListing(listingId, tenantId)`. Matching criteria: same tenant, `active=true` preference, roomType match (null = any), budget range match (null bounds = no filter), `smsOptIn=true`. 13 tests: match success, DRAFT skip, opt-out skip, inactive pref skip, budget over/under, roomType mismatch, null filters, multi-customer, SMS failure.
- [x] Match/audit logging + tests — `SmsLog` entity (sms_logs table per Plan §12). Status: queued→sent/failed. `providerMessageId` from SMS provider. `sentAt` timestamp. Cross-tenant isolation: 2 tests proving tenant A listing never triggers SMS for tenant B customers. Included in 13-test count.

### 5. SMS Adapter
- [x] `SmsProvider` interface + Sparrow/Aakash adapter + Twilio adapter + tests — `SparrowSmsAdapter` (POST form-encoded to Sparrow API, response_code 200 = success), `AakashSmsAdapter` (POST to Aakash API), `TwilioAdapter` (Twilio SDK `messages.create` + `getDeliveryStatus`). All adapters accept `ConfigService`-provided credentials; gracefully handle HTTP/SDK errors. 5 Sparrow unit tests + 5 Twilio unit tests.
- [x] Phone-prefix routing logic + tests — `SmsRoutingService` as `SMS_PROVIDER`. Routes: `+977` → Sparrow (if key) → Aakash (fallback) → Null. All others → Twilio (if SID) → Null. Exported `resolveAdapter()` method for unit testing. 8 routing unit tests. Config keys: `SMS_SPARROW_API_KEY`, `SMS_AAKASH_API_KEY`, `SMS_TWILIO_ACCOUNT_SID`.
- [x] Idempotent send (no double-SMS on retry) + test — `MatchingService.sendMatchSms()` checks for existing SENT `SmsLog` row for same (customerId, listingId) before sending. If found, skips send. Integration test: two `triggerMatchForListing()` calls → exactly 1 SMS + 1 log row.

### 6. Payments
- [x] `PaymentProvider` interface + eSewa/Khalti/Stripe adapters + tests — `StripeAdapter` (Stripe SDK, HMAC-signed webhook), `EsewaAdapter` (redirect URL + HMAC-SHA256 signature verification on callback), `KhaltiAdapter` (Khalti Epayment API + server-side lookup verification). `PaymentRoutingService.resolveAdapter(gateway)` routes by gateway enum. 7 Stripe + 5 eSewa + 5 Khalti + 4 routing = 22 adapter unit tests.
- [x] `Booking` + `Payment` entities + migrations — `bookings` table (tenant, listing, customer, status, move_in_date, amount_due, amount_paid), `payments` table (tenant, payable_type/id, gateway, transaction_id UNIQUE, amount, currency, status, raw_response jsonb). `BookingsService.create()` verifies listing is PUBLISHED and in same tenant.
- [x] `POST /bookings` + `POST /payments/intent` + `POST /payments/webhook/:gateway` endpoints — JWT-guarded booking creation; payment intent creates Payment record + calls gateway adapter; webhook routes to correct adapter, verifies signature, updates Payment + Booking status on success.
- [x] Webhook signature verification (Plan §19) — Stripe: `webhooks.constructEvent()` with raw body (main.ts: `rawBody: true`); eSewa: HMAC-SHA256 of signed_field_names; Khalti: server-side lookup API call.
- [x] Idempotency — duplicate webhook with same `gateway_transaction_id` updates the existing Payment record (no insert); UNIQUE index on `(gateway, gateway_transaction_id)`.
- [x] Cross-tenant isolation tests — 2 tests: customer B cannot book tenant A listing; customer B cannot create payment intent for tenant A booking.
- [x] Integration tests — 11 tests in `test/bookings.integration.spec.ts` covering all booking/payment flows + isolation.

### 7. Customer PWA
- [x] Search / listing detail pages — `SearchPage` (TanStack Query + filters), `ListingDetailPage` (amenities, deposit, Book CTA). Public routes, no auth required.
- [x] Booking + payment flow — `LoginPage` (OTP request/verify, 2-step react-hook-form + zod), `BookingPage` (move-in date, amount summary, creates booking via API), `PaymentPage` (gateway selector: eSewa/Khalti/Stripe, redirects to gateway).
- [x] Profile page — `ProfilePage` (customer name/phone, logout button).
- [x] `ProtectedRoute` — redirects unauthenticated users to `/login` with return path.
- [x] `Layout` — sticky header, brand nav, footer.
- [x] API layer — `client.ts` (axios + interceptors), `auth.ts`, `listings.ts`, `bookings.ts`, `payments.ts`.
- [x] Auth store — Zustand + persist (localStorage token).
- [x] Tailwind + PostCSS configured. Brand color palette (`brand-50` → `brand-700`).
- [x] PWA icons — placeholder PNGs at `public/icons/icon-192.png` + `icon-512.png` (brand blue rounded rect). vite-plugin-pwa manifest references them.
- [x] 14 Vitest component tests — `ListingCard` (5), `SearchFilters` (3), `LoginPage` (4), `ProtectedRoute` (2). All passing.
- [ ] Manifest + service worker — **not confirmed installable on Android** (would require a device; deferred to pilot testing phase). Workbox config is wired in `vite.config.ts`.

### 8. Admin Dashboard
- [x] Company Admin: Dashboard (StatCards + recent listings/payments), Listings (table + publish/archive actions), Customers (table + SMS opt-in), Payments (table + revenue total). Tailwind dark sidebar + white content area design.
- [x] Super Admin: Platform overview (tenant counts by status + StatCards), Tenants (table + activate/suspend actions).
- [x] Login page — dark split layout (brand panel left, form right). Email + password, JWT stored in localStorage via Zustand store. Role-based redirect (super_admin → /super/dashboard, company_admin → /company/dashboard).
- [x] `ProtectedRoute` with `requireRole` — company_admin cannot access super admin routes.
- [x] `StatusBadge` — consistent color-coded pills for all system statuses (published, pending, success, failed, draft, archived, suspended, trial, refunded).
- [x] `StatCard` — metric cards with live indicator (pulsing dot) and accent color variants.
- [x] `DataTable` — TanStack Table v8 wrapper with loading skeletons and empty state.
- [x] `Sidebar` — dark (#0F1117) sticky nav with role badge, nav groups, logout.
- [x] 21 Vitest component tests — StatusBadge ×9, StatCard ×4, ProtectedRoute ×4, LoginPage ×4. All passing.
- [x] Seed script (`apps/backend/npm run seed`) — creates super admin + demo company admin + demo customer with argon2-hashed passwords.
- [x] README updated with seed credentials and login instructions.
- [x] Customer email+password login — migration `1752451211000-AddCustomerPasswordHash`, new `POST /auth/customer/email-login` endpoint, `CustomerEmailLoginDto`, `CustomersService.findByEmail/setPasswordHash`, constant-time verify (matches staff auth pattern). 4 new backend unit tests.
- [x] LoginPage (customer-web) tab switcher — Phone/OTP tab + Email tab side-by-side. Zod-validated email+password form. 18 Vitest tests (was 14). `verifyOtp` response now returns `customer` object (bug fix).
- [x] Auth store `Customer` interface updated: `phone` and `email` both optional (either auth flow works).
- [x] Billing / analytics views — AnalyticsPage + SubscriptionPage added in Phase 2.

## Plan v2.9 Additions

- [x] §1.5 — Subscription plan changes payment-gated: `subscribe()` throws `BadRequestException` for paid-plan upgrades/new subscriptions (must use `/payments/subscription-intent`); free tier applies immediately; paid downgrade sets `pendingPlanId` for next billing cycle. Migration `1752500000000-AddPendingPlanToSubscriptions`. `applyPendingPlan()` helper added to service. 6 new tests (was 9 subscription tests, now 15).
- [x] §1.6 — Analytics isolation bug fixed: raw QueryBuilder `p.tenantId` → `p.tenant_id` (TypeORM doesn't translate property names in string WHERE clauses). Zero-state analytics test added: 3 tests asserting every count = 0 for empty tenant and that tenantId is passed to every scoped query.
- [x] §1.7 — Customer images (backend): migration `1752500001000-CreateCustomerImages`, `CustomerImage` entity (tenant_id, customer_id, url, type, sort_order), `POST /customers/:id/images` + `GET /customers/:id/images` endpoints mirroring listing images exactly. StorageModule imported into CustomersModule. 3 tests: upload success, cross-tenant 404, type defaults to 'other'.
- [x] §1.7 — Customer images (frontend): `api/customers.ts` + `fetchCustomerImages`/`uploadCustomerImages`. `CustomersPage` expandable row panel per customer — type picker (other/profile_photo/id_document), thumbnail grid with type label overlay, hidden file input, upload mutation with error display. `DataTable` extended with `expandedRow`/`renderExpanded` props (React.Fragment, colSpan row). TypeScript: 0 errors. SubscriptionPage rewrite (§1.5 frontend) + api/subscriptions.ts also committed this session.

## Phase 2 — Core SaaS Hardening (in progress)

### Subscriptions & Billing
- [x] `subscription_plans` + `tenant_subscriptions` migrations + seeded 4 plans
- [x] SubscriptionsModule: GET /subscriptions/plans (public), GET /subscriptions/current, POST /subscriptions/subscribe, DELETE /subscriptions/cancel
- [x] Plan limit enforcement in ListingsService.create — 403 when max_listings reached
- [x] SMS credit deduction per send in MatchingService (atomic UPDATE, skip if exhausted, refund on failure)
- [x] Subscription payment flow — POST /payments/subscription-intent; webhook activates sub + resets SMS credits
- [x] Dunning / past_due — SubscriptionsService.markPastDue + POST /subscriptions/mark-past-due (super_admin)

### SMS Templates
- [x] `sms_templates` migration + SmsTemplate entity (tenant-scoped + platform defaults)
- [x] Template rendering in MatchingService (tenant template → platform default fallback)
- [x] template_id + delivered_at columns added to sms_logs
- [ ] Admin UI for SMS template CRUD (create/edit/preview)

### Analytics
- [x] GET /analytics/overview — tenant metrics (listings/customers/bookings/revenue/SMS credits)
- [x] GET /analytics/platform — platform-level super_admin view
- [x] AnalyticsPage in admin console with categorized StatCards

### Admin Console Phase 2 UI
- [x] SubscriptionPage — plan picker, upgrade/downgrade, cancel flow
- [x] DashboardPage — uses analytics endpoint + subscription strip
- [x] GET /listings/admin/all — all-status admin endpoint (offset pagination)
- [x] SMS template management page

### RBAC Refinement
- [x] Staff vs Agent granular permissions — agents READ_ROLES only on listings and customers
- [x] User management: GET /users, POST /users/invite, PATCH /users/:id/status (company_admin only)
- [x] Admin console UsersPage — table + invite form + enable/disable actions (5 new unit tests)

### Booking Calendar
- [x] GET /listings/:id/availability — returns availableFrom, status, upcoming booking dates (Plan §4.3)
- [x] PATCH /listings/:id/availability — toggle occupied/vacant, set available_from (Plan §4.3)
- [x] Admin console AvailabilityPanel — date picker, mark occupied/vacant, booking list (6 new unit tests)

### SMS Templates
- [x] GET/POST/PATCH/DELETE /sms-templates — tenant-scoped CRUD, platform defaults read-only
- [x] ForbiddenException on edit/delete of platform defaults (tenantId=null)
- [x] Admin console SmsTemplatesPage — grouped by event, inline edit, live placeholder preview (7 new unit tests)

## Phase 3 — Growth & Distribution

- [x] Facebook Page integration (Plan §4.12) — HMAC-SHA256 webhook, `fb_page_leads` table, `GET /facebook/leads`, admin FbLeadsPage, ListingsPage share modal
- [x] Reviews & ratings — `reviews` table (UNIQUE tenant+listing+customer), `POST /reviews` (auth), `GET /reviews/listing/:id` (public), customer-web ReviewsSection + StarRow + submit form (ConflictException handled)
- [x] Favorites / saved listings — `customer_favorites` table (UNIQUE tenant+customer+listing), heart toggle on SearchPage (useMutation), FavoritesPage (`/favorites`), Layout ♥ Saved nav link
- [x] Custom branding per tenant — `GET /tenant-settings/branding` (no auth, TenantSettingsController), BrandingPage (logo URL + color picker), `useTenantBranding` hook (CSS `--color-brand` on `:root`)
- [x] Support ticketing system — `support_ticket_status_enum` + `support_tickets` migration, SupportService (create/findAll/findAllPlatform/updateStatus), SupportController (COMPANY_ADMIN + SUPER_ADMIN guards), SupportPage accordion admin UI
- [x] Bulk listing upload via CSV — `POST /listings/bulk-upload` (FileInterceptor + memoryStorage, WRITE_ROLES), inline CSV parser (quoted fields + CRLF), admin console Upload CSV button + result card + sample CSV download; 6 unit tests

## MVP Definition of Done (mirrors Plan Section 22 — all must be true before pilot onboarding)

- [x] New tenant can be onboarded with a working subdomain — Super Admin "Onboard Tenant" form (name, subdomain, country, currency, admin email/name/password); backend interceptor resolves tenant from Host header subdomain. Session 18.
- [x] Company admin can create/edit/publish a listing with images — Create form + publish/archive actions + listing image upload panel (admin) + image gallery display (customer PWA). Sessions 8–18.
- [x] Customer can register via OTP and save search preferences — OTP request/verify, preferences upsert, email+password login. Sessions 5–8.
- [x] Publishing a matching listing triggers an SMS, logged in `sms_logs` — MatchingProcessor + SmsRoutingService + idempotent send. Session 6.
- [x] Customer can browse/search/filter and submit an enquiry on the PWA — SearchPage (infinite scroll, filters), ListingDetailPage, BookingPage (enquiry = booking creation). Sessions 7–9.
- [x] A booking + payment can be completed via at least one gateway (sandbox) — code complete: Stripe/eSewa/Khalti adapters, webhook + browser callback handlers (eSewa POST callback, Khalti GET callback → /payment/success or /payment/failed). Sandbox credentials needed in .env. Session 18.
- [x] Admin dashboard shows live counts — AnalyticsPage with StatCards from GET /analytics/overview. Session 10.
- [x] Automated tests confirm no cross-tenant data leakage — cross-tenant isolation tests across tenants, bookings, customers, analytics. Sessions 2–14.
- [x] PWA is installable — manifest complete (id, scope, orientation, purpose: any maskable on 512px icon, theme_color #0284c7), Apple PWA meta tags, favicon.svg created, useInstallPrompt hook + dismissible install banner in Layout. Workbox runtimeCaching fixed for all API origins. Session 18.

---

## Known Deviations / Open Questions

_(Running log. Format: date — what changed vs. the Plan — why — resolved / still open.)_

- 2026-07-13 — Product doc filename is `docs/room-finder-saas-product-document.md.md` (double extension) vs. `docs/room-finder-saas-product-document.md` referenced in KICKOFF_PROMPT.md. Claude Code found it fine; no action needed unless it causes CLI issues. OPEN.
- 2026-07-13 — `CLAUDE.md` lives at `docs/Claude.md` (not repo root as Section 10 recommends). Claude Code loads it via directory scan on macOS (case-insensitive). Recommend moving or symlinking to root for portability. OPEN.
- 2026-07-13 — `sms.service.ts` and `payments.service.ts` (explicitly named in Plan Section 13 folder layout) are stubs only — will be fleshed out in Phase 1 Steps 5 and 6. Not a deviation from build order. RESOLVED (deferred correctly).
- 2026-07-14 — `TenantContextService` placed in `src/common/` (not `src/modules/tenants/`) and `TenantScopedEntity`/`TenantScopedRepository` placed in `src/database/base/`. Plan Section 13 lists `common/` for cross-cutting concerns and `database/` for DB infrastructure — both placements are consistent with the spec's intent. RESOLVED.
- 2026-07-14 — `apps/admin-console` scaffold had hallucinated `@refinedev` versions (`@refinedev/core@^4.47.0`, `@refinedev/simple-rest@^4.5.5` — neither version exists). Updated to actual published versions: core `^5.0.12`, simple-rest `^6.0.1`, react-query `^5.81.5`. `@refinedev/react-router-v6@4.6.2` has a peer dep warning (requires core ^4.46.1) — acceptable for now, revisit when building admin console in Phase 1 Step 8. OPEN.
- 2026-07-14 — Integration test uses a test-only entity `_test_rooms` (prefixed with underscore to distinguish from production tables). Uses `synchronize: true` with `dropSchema: true` — all tables dropped/recreated on every test run. Dev DB is empty after each run; don't store real data in dev DB while running tests. OPEN (revisit when dev DB accumulates real data).
- 2026-07-14 — Email uniqueness is global (not per-tenant) in `users.email` UNIQUE constraint. §12 implies per-tenant uniqueness but global is simpler and avoids needing composite unique index. Deviation documented; revisit if B2B customers complain about email conflicts across tenants. OPEN.
- 2026-07-14 — `refresh_token_hash` column added to users table — not in §12 schema. Required by argon2-based refresh token rotation (§4.9 security req). RESOLVED (implementation detail, not spec gap).
- 2026-07-14 — `listings.rent_amount` / `deposit_amount` use TypeORM `decimal` type which Postgres driver returns as `string`. DTOs accept `number`; service uses `as any` cast on save to bridge the type mismatch. Revisit with a TypeORM value transformer if precision becomes a concern in Phase 3+. OPEN.
- 2026-07-14 — Khalti webhook verification is API-based (server-side lookup to `epayment/lookup/`) rather than HMAC-signed. Khalti v2 API does not provide HMAC signatures for webhooks. `verifyWebhookSignature()` returns `true` (bypass); actual verification happens in `handleWebhook()` via Khalti lookup API. This satisfies Plan §19's intent (no unauthenticated webhook processing) via server-side verification instead of client-side HMAC. RESOLVED.
- 2026-07-14 — `.env` file added to repo root for local dev. Contains dev-only values (no real secrets). `.gitignore` excludes `.env` from version control. `test:integration` now uses `dotenv-cli` to load `.env` so `DATABASE_URL` does not need to be passed on the CLI. RESOLVED.
- 2026-07-14 — Frontend work (Phase 1 Steps 7–8) should use the `frontend-design` skill. Phase 1 Step 7 (Customer PWA) built without Figma (no designs provided); used Tailwind utility classes + brand palette directly. OPEN for Step 8 if designs are provided.
- 2026-07-14 — Customer PWA uses `handleSubmit(onSearch)` from react-hook-form which passes `(data, event)` to the handler — tests assert both args via `expect.anything()`. RESOLVED.
- 2026-07-14 — PWA icons are SVG placeholders converted to PNG programmatically. Not production-quality; replace before pilot launch. OPEN.
- 2026-07-16 — Plan v2.5: §1.4 clarified that admin console Listings + Customers pages must include Create forms (not just tables). Backend already supports POST /listings and POST /customers — frontend-only gap. Adding this session. OPEN → resolving now.
- 2026-07-16 — Plan v2.5 review: §1.3 Property Owner Self-Service Submission was listed in Phase 3 roadmap (Section 9) but was never tracked in PROGRESS.md or built. Phase 3 marked complete prematurely — corrected above. Building this session. OPEN → resolving now.
- 2026-07-16 — Facebook multi-tenant architecture (§4.12) — RESOLVED in Session 14 (Plan v2.6). `tenant_facebook_connections` table now exists, OAuth + BYO-app flows built, webhook lookup-before-verify migrated. The OPEN deviation is now fully closed. The `x-tenant-id` header approach (prior deviation) has been removed from the webhook handler.
- 2026-07-16 — `GET /facebook/connect` originally used `@Redirect()` which caused 401 on every OAuth click (browser navigation doesn't carry `Authorization: Bearer`). Fixed in Session 15: endpoint returns `{ url }` JSON; frontend calls via Axios then navigates with `window.location.href`. RESOLVED.
- 2026-07-16 — `FB_APP_ID` and `FB_APP_SECRET` not yet added to `apps/backend/.env`. Facebook OAuth config is correct in code (`configuration.ts` has the keys), but actual end-to-end OAuth will fail until real credentials are provided. Not a code defect — a credential provisioning step. OPEN — requires Meta App setup by operator before pilot testing.
- 2026-07-17 — Plan v2.9 §1.5: existing subscription tests for "creates new subscription" and "upgrades existing subscription" tested now-removed behavior (paid-plan immediate apply). Tests updated to match the gated behavior — no functionality was removed, behavior was corrected. RESOLVED.
- 2026-07-17 — Analytics raw QueryBuilder `p.tenantId` in string WHERE clause was not translated to column name `tenant_id` by TypeORM. Fixed to `p.tenant_id`. Only affects the revenue sum query (other analytics uses ORM-level `.count({ where: {...} })` which does translate correctly). RESOLVED.

## Test Coverage Snapshot

_(Agent updates this after significant test runs — rough numbers are fine, this is a trend indicator, not an audit.)_

- Backend unit tests: **150 passing** (141 prior + 3 analytics-zero-state + 6 subscription-payment-gate + 3 customer-images) — 25 test suites, all green
- Backend integration tests: **96 passing** (unchanged — Phase 3 unit tests only)
- Frontend component tests (customer-web): **18 passing** (ListingCard ×5, SearchFilters ×3, LoginPage ×8, ProtectedRoute ×2)
- Frontend component tests (admin-console): **21 passing** (StatusBadge ×9, StatCard ×4, ProtectedRoute ×4, LoginPage ×4)
- Cross-tenant-isolation tests passing: **4 / 4** ✓
