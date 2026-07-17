# RoomFinder SaaS — Product & Development Document

**Product Type:** Multi-tenant SaaS platform for room-finding / room-rental companies
**Prepared for:** Product planning, architecture, and development handoff
**Version:** 2.9 — Added customer images (Section 1.7), bringing customers to parity with the already-built listing image support

---

## 1. Executive Summary

RoomFinder SaaS is a subscription-based platform that room-finder/room-rental companies (PG operators, hostel networks, brokers, rental agencies) can sign up for to run their entire business online. A company using the platform can:

- List and manage rooms/properties with photos, pricing, and availability
- Manage customer inquiries, leads, and bookings (mini-CRM)
- Accept and track payments (bookings, deposits, subscription fees)
- Automatically match customers to newly listed rooms based on saved preferences and notify them instantly via **SMS** (through a third-party SMS gateway)
- Give their own customers a branded web frontend to search, browse, and book rooms

Because it is built as a **SaaS**, each room-finder company operates as an isolated "tenant" with its own data, branding, staff accounts, and subscription plan — while Anthropic-style shared infrastructure keeps hosting/maintenance centralized for you as the platform owner.

---

## 1.1 Finalized Scope Decisions (v1.1)

| Decision | Choice | Rationale |
|---|---|---|
| Backend | NestJS | Structured, TypeScript-first, good fit for multi-tenant modular architecture |
| Frontend | React (PWA) | Installable, offline-capable, no separate native codebase needed for MVP |
| Native apps (iOS/Android) | **Deferred.** Add Expo/React Native later only if app-store presence becomes a requirement | PWA covers install-to-home-screen, push notifications, offline caching for MVP |
| Facebook Marketplace | **No direct posting/message-sync integration** — no free/open API exists for either (see 4.12) | Meta's Marketplace Partner API is a gated approval program, not self-serve; Marketplace chat is tied to personal profile and isn't exposed via any Messenger API |
| Launch markets | Nepal + International | Requires dual payment gateways, dual SMS providers, and multi-currency support from the data-model level |

## 1.2 Scope Addition — Advanced Search & Premium Landing Page (Post-Phase-1)

Added after Phase 1 Steps 2 (Listings) and 7 (Customer PWA) were already built and tested — this is a genuine scope change, not a pre-build spec, so treat it as such rather than assuming it slots in for free:

| Addition | What it means |
|---|---|
| Location search | Beyond the existing `city` filter — proper geocoded area/address search, with room to add radius/"near me" search later |
| Room configuration search | Filter by BHK type (studio/1BHK/2BHK/3BHK+) and by number of rooms — two related but distinct listing attributes, both new columns |
| Advanced search | A combined filter panel (location + BHK + price + move-in date + feasibility tags) beyond the current quick-filter bar |
| Feasibility search | Proximity tags such as "near highway" / "near public transport station" — implemented as a new category on the **existing** `amenities` table rather than a new schema concept, to avoid duplicating infrastructure that's already built and tested |
| Premium landing page | A dedicated marketing/entry page (hero, search bar, featured listings, trust signals) — the Customer PWA currently has no landing page distinct from the search page; this is new, not a redesign |
| Pagination / infinite scroll | The current `GET /listings` returns an unpaginated result set — cursor-based pagination is added for the public search endpoint specifically (feeds infinite scroll, stays stable under continuous writes), offset pagination for admin list views. See Section 14.1 for the full rationale and shapes. |

**Impact on what's already built (flag these in `PROGRESS.md` when you resume):**
- `listings` table needs a migration to add `bhk_type` and `number_of_rooms` (Section 12) — the 13 existing listings integration tests will need new assertions, not a rewrite.
- `amenities` needs a `category` column (Section 12) — existing amenity seed data needs categorizing, not deleting.
- The public search endpoint (`GET /listings`, currently filtering on `city`/`roomType`/rent range only, and currently unpaginated) needs new query params (Section 14) plus cursor pagination (Section 14.1) — additive, existing filter tests should keep passing unchanged, but a new composite index (Section 12) is needed for the cursor query to perform well.
- The Customer PWA's `SearchFilters` component (5 existing tests) needs new fields added — extend it, don't replace it. The Landing Page and the infinite-scroll list view are net-new, not a change to the existing `SearchPage` component's core logic.
- **This entire round of frontend work — landing page and the advanced/feasibility search UI — should be built using the `frontend-design` Skill**, not default Tailwind boilerplate. The landing page is explicitly the one surface in this product where "looks premium, not templated" has direct commercial value (see Section 15.1's original rationale for the customer app vs. admin apps split — this reinforces it, it doesn't change it).

---

## 1.3 Scope Addition — Property Owner Self-Service Submission

Section 2 always listed "Property Owner" as an optional persona; this formalizes it into an actual feature: **a property owner can request their rental be listed without needing a staff account**, closing the loop on inbound supply instead of requiring a staff member to create every listing manually.

**How it works, reusing existing infrastructure rather than building a parallel system:**
- A public, unauthenticated form (`POST /listings/owner-submission`) collects owner contact info (name, phone, email) plus basic property details, and creates a normal `listings` row with `status = pending_review` and a new `submission_source = owner_submitted` marker — this is the **same status workflow already built** for staff-created drafts, not a new pipeline.
- Staff reviews it in the existing admin Listings view (filterable by `submission_source`), completes anything missing (exact amenities, additional photos), and either publishes it (same `PATCH /listings/:id` staff endpoint already built) or rejects it.
- Once published, it behaves exactly like any staff-created listing — same matching engine trigger (Section 4.5), same search visibility. No changes needed there.
- The owner is notified by SMS at submission ("we received your listing, under review") and at approval ("your listing is live") — reusing the `sms_templates` event-trigger system already built in Phase 2, with two new trigger values added (Section 12).

**Deliberate design call — no OTP verification at submission time:** unlike customer accounts, owner submissions don't require phone verification before being accepted. The `pending_review` gate — a human staff member looking at every submission before it goes live — is the actual spam control, and adding OTP friction to a one-time submission form would cost real conversions for a moderation benefit staff review already provides. What *is* needed: rate limiting on the endpoint by IP (Section 19), since it's a new unauthenticated public write endpoint. Revisit OTP-gating only if spam volume through staff review becomes a real problem.

**Impact on what's already built:**
- `listings` needs a migration: `created_by` becomes nullable (owner submissions have no staff user), plus new nullable `submission_source`, `owner_name`, `owner_phone`, `owner_email` columns (Section 12) — additive, existing listing tests (staff-created path) are unaffected since `submission_source` defaults to `staff_created`.
- `sms_templates.event_trigger` gets two new values (Section 12) — additive to the enum, doesn't touch the existing `new_match`/`booking_confirmed`/`rent_reminder` templates or their tests.
- The admin Listings page needs a filter/tab for `submission_source`, reusing the already-built `GET /listings/admin/all` endpoint (Phase 2) with one new query param — not a new page.

---

## 1.4 Clarification — Admin Console "Create" Flows Are Explicitly Required

The backend has always supported staff creating both listings (`POST /listings`) and customers (`POST /customers`) — this isn't new API scope. What needed spelling out explicitly: **the admin console's Listings and Customers pages must include an actual "Create New" form, not just a table with row-level actions** (publish/archive, SMS opt-in toggle, etc.). Section 4.3 and 4.4's feature bullets always implied this ("Add/edit/delete room listings," "Lead capture... manual entry"), but Section 15's page list only said "Listings (table + publish/archive actions)" and "Customers (table + SMS opt-in)" — reasonable to read as list-and-act views only, with creation happening some other way. It doesn't; the admin console is the only place staff create either one, so this needed to be unambiguous:

- **Company Admin Dashboard → Listings page:** table view **plus** a "Create Listing" form (title, description, rent/deposit, room type, BHK/room count, amenities including feasibility tags, images, availability) — calls the existing `POST /listings` endpoint. Same form, reused for editing.
- **Company Admin Dashboard → Customers page:** table view **plus** a "Create Customer" form (name, phone, email, initial preferences, images — Section 1.7) — calls the existing `POST /customers` endpoint plus the new `POST /customers/:id/images` endpoint. Same RBAC as the rest of the page (staff/company_admin write access, agents read-only per the Phase 2 RBAC refinement already built).
- No backend changes needed — this is a frontend gap to close in the admin console, using endpoints that already exist and are already tested.

---

## 1.5 Bug Fix Required — Subscription Plan Changes Must Be Payment-Gated

**Reported bug:** a Company Admin can switch to a paid subscription plan without making any payment. This is a revenue-integrity bug, not a cosmetic one — as built, it means every tenant can sit on the top-tier plan (unlimited listings, full SMS credits) for free indefinitely.

**Root cause, most likely:** the Plan already established the correct pattern for regular bookings back in Section 4.7 — a payment intent is created, and the actual state change (booking confirmed) only happens inside the webhook handler after the gateway confirms success. The subscriptions module was built with two separate pieces in the same session (`POST /subscriptions/subscribe` for direct plan changes, and a separate `POST /payments/subscription-intent` + webhook flow) — and it's very likely `POST /subscriptions/subscribe` still directly mutates `tenant_subscriptions.plan_id` immediately, with nothing forcing the admin console's "upgrade" button through the payment path first.

**Required fix:**
- `POST /subscriptions/subscribe` (or whatever endpoint the admin console's plan picker calls) **must not mutate `tenant_subscriptions.plan_id` for any plan with `price_monthly > 0`.** It should create a payment intent (`POST /payments/subscription-intent`) and return a checkout redirect — nothing else.
- **Only the payment webhook handler is allowed to apply the plan change**, after the gateway confirms success — this mirrors the booking-payment pattern already correctly built in Section 4.7/6, just needed to be enforced identically here.
- **The one legitimate exception:** switching to a plan where `price_monthly = 0` (the free/trial tier) can apply immediately with no payment step, since there's nothing to charge.
- **Downgrades to a still-paid tier** shouldn't require an immediate new payment (the tenant already paid for the current period) — schedule the downgrade for the next billing cycle rather than applying it immediately, so it can't be used as a backdoor around the upgrade gate.
- **Required test, specifically the kind that would have caught this:** an integration test asserting that calling the subscribe endpoint for a paid plan does **not** change `tenant_subscriptions.plan_id` until the corresponding webhook fires with a success event. Add this to Section 20's testing requirements — it's the same class of gap as the migration-vs-synchronize issue: a green test suite that never actually exercised the path that matters.

## 1.6 Bug Fix Required — Analytics Showing Nonzero Counts for Empty Tenants

**Reported bug:** the customer count on a tenant's analytics/dashboard shows 1 when that tenant has zero customers. Most likely causes, roughly in order of likelihood given this codebase's history: (a) the count query in `AnalyticsService` isn't properly scoped by `tenant_id` and is picking up a seeded demo customer belonging to a different tenant — this would be a **cross-tenant isolation leak specifically in the analytics/reporting path**, which is worth treating as seriously as any other isolation bug even though it's "just a count," since the same query pattern likely appears in other analytics numbers; (b) a `COUNT(*)` over a `LEFT JOIN` (e.g. customers joined to preferences) producing a phantom row even when the base table is empty for that tenant; (c) a stale cached value never invalidated after a customer was deleted or reassigned.

**Required fix:**
- Check whether the customer-count query in `GET /analytics/overview` filters by the resolved tenant context (Section 17) the same way every other tenant-scoped query must — this is the first thing to rule out, given it's the most consistent with problems already seen in this codebase.
- **Required test, again the kind that would have caught this:** a zero-state integration test — create a brand-new tenant with no customers, call `GET /analytics/overview`, assert every count is `0`. Add this to Section 20 alongside the subscription-payment test above; analytics/reporting endpoints have had no dedicated tests so far per `PROGRESS.md`, which is consistent with this bug going unnoticed.

---

## 1.7 Scope Addition — Customer Images (Parity with Listing Images)

Listings already support multi-image upload (`POST /listings/:id/images`, `listing_images` table, `FILE_STORAGE_PROVIDER` adapter — Section 4.3, already built). Customers don't have any image capability yet. This brings them to parity, reusing the exact same storage mechanism rather than building a second one.

**Deliberately generalized rather than assuming a single intent:** "customer images" could mean a profile photo, an ID/KYC document (common for room rental in this market — landlords often want to see a copy of citizenship/passport before booking), or both. Rather than picking one now, the schema below supports either without commitment — a `type` field on each image row, defaulting to a generic value, that can be narrowed to a stricter taxonomy later (e.g. adding upload validation or a required-document checklist) without a schema change:

- New table **`customer_images`** — `id, tenant_id, customer_id (FK), url, type (varchar, default 'other' — e.g. 'profile_photo', 'id_document', 'other'), sort_order, created_at`. Same tenant-isolation requirement as every other table (Section 17): a 404 if the customer isn't in the caller's tenant.
- New endpoint **`POST /customers/:id/images`** — mirrors `POST /listings/:id/images` exactly: multer `memoryStorage`, routed through the existing `FILE_STORAGE_PROVIDER` DI token (no new storage adapter needed, Section 4.3/16), same cross-tenant 404 test pattern already proven for listings.
- The Customer detail view (both the "Create Customer" form from Section 1.4 and the customer table's row-detail/edit view) gets an image upload field, same UI pattern as the Listings "Create Listing" form already specifies.
- **Required tests, mirroring the listing-image tests already written:** upload success, cross-tenant 404, 401 no auth — the exact same three cases already proven out for `listing_images`, just against the customer endpoint.

---

## 2. Target Users & Personas

| Persona | Who they are | What they need from the platform |
|---|---|---|
| **Platform Owner (You)** | Runs the SaaS business, sells to room-finder companies | Tenant management, billing, usage analytics, uptime |
| **Company Admin** | Owner/manager of a room-finder company (tenant) | Dashboard to manage listings, staff, customers, revenue |
| **Staff / Agent** | Employees or field agents of the tenant company | Add/update listings, respond to leads, log site visits |
| **End Customer** | Person looking for a room | Search rooms, filter by budget/location, get notified by SMS when a match appears, pay booking/advance online |
| **Property Owner** | Owner of the room/property being listed | Submit their rental via a public self-service form (no staff account needed), track submission/approval status, get notified by SMS when it goes live — see Section 1.3 |

---

## 3. High-Level System Architecture

```
                        ┌────────────────────────┐
                        │   Super Admin Panel     │  (You – SaaS owner)
                        │  Tenant & billing mgmt  │
                        └───────────┬─────────────┘
                                    │
                     ┌──────────────┴───────────────┐
                     │   Multi-Tenant Core Backend    │
                     │  (Auth, Listings, CRM, Billing) │
                     └───────┬───────────────┬────────┘
                             │               │
                 ┌───────────┘               └───────────┐
        ┌────────▼─────────┐               ┌────────────▼───────────┐
        │  Company Admin    │               │   Customer Web/App     │
        │  Dashboard (per    │               │   Frontend (per tenant, │
        │  tenant)           │               │   branded)              │
        └────────┬──────────┘               └────────────┬────────────┘
                  │                                       │
      ┌───────────┴──────────┐              ┌─────────────┴─────────────┐
      │  Payment Gateway API  │              │   Matching Engine → SMS    │
      │  (Stripe/eSewa/Khalti)│              │   Gateway API (Twilio/     │
      └───────────────────────┘              │   Sparrow SMS/etc.)        │
                                              └────────────────────────────┘
```

**Key architectural principle:** Multi-tenancy at the database or schema level, so each room-finder company's listings, customers, and payments are logically isolated even though they share the same application codebase and infrastructure.

---

## 4. Core Modules

### 4.1 Multi-Tenant & Super Admin Module
**Purpose:** Lets you (the SaaS owner) onboard new room-finder companies, control subscription plans, and monitor platform health.

**Features:**
- Tenant sign-up / onboarding wizard (company profile, subdomain e.g. `abc.roomfinder.com`, branding/logo/colors)
- Subscription plan assignment (Free trial, Basic, Pro, Enterprise)
- Usage metering (number of listings, SMS credits used, active customers)
- Tenant suspension/activation, impersonation for support
- Platform-wide analytics (revenue, churn, active tenants)
- Global feature flags (enable/disable modules per plan, e.g. SMS add-on only for Pro+)

### 4.2 Company Admin Dashboard
**Purpose:** The main workspace for each room-finder company to run day-to-day operations.

**Features:**
- Overview dashboard: active listings, new leads, pending payments, SMS credits remaining
- **Pending owner submissions** as a visible queue/stat (Section 1.3) — new inbound rentals waiting on staff review, distinct from staff's own drafts
- Staff/agent account management with role-based permissions
- Company profile & branding settings (logo, contact info, theme color for their customer frontend)
- Notification settings (which events trigger SMS/email)
- Reports export (CSV/PDF) for listings, customers, revenue

### 4.3 Room / Property Listing Management
**Purpose:** Core inventory module — where rooms/properties are created and maintained.

**Features:**
- Add/edit/delete room listings: title, description, rent, deposit, room type (single/shared/PG/apartment), amenities (WiFi, parking, attached bathroom, furnished, etc.)
- **Owner self-service submission (Section 1.3):** a public, unauthenticated form lets property owners request their rental be listed without a staff account — creates a `listings` row at `status = pending_review` with `submission_source = owner_submitted`, reusing the same draft→pending_review→published workflow already in place for staff-created listings. Staff completes/verifies and publishes or rejects from the same admin Listings view. Owner gets an SMS on submission and on approval, via the existing SMS template system (Section 4.6).
- **Room configuration:** BHK type (studio/1BHK/2BHK/3BHK/4BHK+) and number of rooms, captured as distinct searchable fields — not every listing fits BHK terminology (a single PG room doesn't), so both fields are optional and independently filterable (Section 12)
- **Feasibility/proximity tagging:** extends the existing amenities model with a `category` (e.g. "feasibility") so tags like "near highway," "near public transport station," "near hospital" are managed through the same admin UI and data model as standard amenities, rather than a parallel system
- Multi-image upload with gallery, optional 360°/virtual tour add-on
- Location capture with map pin (Google Maps/OpenStreetMap) and address autocomplete
- Availability calendar (available from date, occupied/vacant status)
- Categorization & tagging (near college, near hospital, bachelor-friendly, family-friendly)
- Bulk upload via CSV for companies with large inventories
- Listing approval workflow (draft → pending review → published) if the company wants quality control — this same workflow is now also the review gate for owner submissions (Section 1.3), not a separate one
- Auto-expiry/renewal reminders for stale listings

### 4.4 Customer Management (Mini-CRM)
**Purpose:** Track every person who interacts with the company, from first inquiry to booking.

**Features:**
- Customer profile: contact info, budget range, preferred location(s), room type preference, move-in date
- **Customer images (Section 1.7):** profile photo and/or ID/document images, uploaded via the same storage mechanism already built for listing images — not a separate system
- Lead capture from website inquiry forms, walk-ins (manual entry), or phone
- Lead status pipeline (New → Contacted → Site Visit Scheduled → Negotiating → Booked/Lost)
- Saved search preferences per customer (used by the Matching Engine below)
- Interaction log/notes per customer (calls, visits, messages)
- Duplicate detection (same phone/email)
- Customer segmentation for targeted SMS campaigns (e.g. "all customers looking in Baneshwor under NPR 8,000")

### 4.5 Matching Engine & Smart Notification Trigger
**Purpose:** The differentiating feature — when a new room is listed (or a room's status changes to vacant), the system automatically checks which customers' saved preferences match it, and triggers an SMS.

**Features:**
- Rule-based matching (location, budget range, room type, amenities) with configurable weight/priority
- Real-time trigger on new listing creation or listing update
- Batch/daily digest mode as an alternative to instant SMS (configurable by company)
- Matching log/audit trail (which customers were notified for which listing, and when)
- Opt-in/opt-out preference per customer (compliance with SMS marketing rules)
- Future extensibility for AI-based ranking (see Add-ons)

### 4.6 SMS Notification Module (Third-Party Gateway Integration)
**Purpose:** Sends the actual SMS to customers, via a pluggable third-party provider.

**Features:**
- Adapter-based integration so any SMS gateway can be plugged in — **finalized for dual-market launch:** Sparrow SMS/Aakash SMS as the primary provider for `+977` (Nepal) numbers for reliable local delivery, and Twilio (or equivalent) for international numbers, with automatic routing by number prefix
- Template management (e.g. "New room found near {location} for NPR {price}! Reply YES to schedule a visit.")
- SMS credit/wallet system per tenant — companies buy SMS credit bundles or it's bundled into subscription tier
- Delivery status tracking (sent/delivered/failed) and retry logic
- Two-way SMS support (optional) so customers can reply to confirm interest
- Rate limiting & spam-prevention safeguards
- Fallback to email/push notification if SMS fails or customer has no phone verified

### 4.7 Payment & Billing Module
**Purpose:** Handles two separate money flows: (a) the SaaS subscription the tenant pays you, and (b) the booking/deposit payments the tenant's customers pay them.

**Features:**
- **Platform-level billing:** subscription invoicing, plan upgrades/downgrades, dunning for failed payments, tenant billing history
- **Tenant-level payments:** booking fee/advance/deposit collection from end customers, invoice/receipt generation, refund handling
- Multiple payment gateway support — **finalized for dual-market launch:** eSewa, Khalti, and Fonepay for Nepal + Stripe/PayPal for international, routed via a single payment-gateway abstraction based on tenant/customer currency
- Multi-currency support (NPR + at least USD) built into the pricing/listing data model from day one, even if the UI ships with one default locale first
- Commission/service-fee calculation if the platform takes a cut of bookings (optional revenue model)
- Payment status dashboard, reconciliation reports
- Webhook handling for async payment confirmation

### 4.8 Customer-Facing Frontend (Web + Mobile-responsive)
**Purpose:** The branded storefront each room-finder company's customers use.

**Features:**
- **Premium landing page** — a dedicated entry point (hero section, prominent search bar, featured/trending listings, trust signals, "how it works") distinct from the search results page itself; this is the one screen where visual polish has direct commercial value, so it's built with the `frontend-design` Skill rather than default component styling
- Search & filter (location, price range, room type, amenities, move-in date) as a quick-filter bar, plus an **advanced search panel** combining all of the above with BHK/room-count and feasibility tags in one place
- **Infinite scroll on search results**, backed by cursor-based pagination (Section 14.1) — paired with a manual "Load more" fallback rather than pure auto-scroll, for accessibility and to keep the footer reachable
- **Location search** beyond a plain city dropdown — address/area autocomplete, with room to add radius ("near me") search later
- **Room configuration search** — filter by BHK type (studio/1BHK/2BHK/3BHK+) and by number of rooms
- **Feasibility search** — filter by proximity tags such as "near highway" or "near public transport station," surfaced through the same amenities-based filter UI as standard amenities (Section 4.3)
- Map view + list view toggle
- Room detail page with gallery, amenities, nearby landmarks, "Enquire" / "Book Visit" CTA
- Customer account: save preferences, favorite listings, view booking/payment history, manage SMS notification preferences
- Online booking/reservation flow with payment integration
- Reviews & ratings on rooms/properties
- Company-specific branding (logo, colors, custom domain/subdomain) pulled from tenant settings
- **Built as a Progressive Web App (PWA):** React + Vite (`vite-plugin-pwa`) or Next.js (`next-pwa`) with a web app manifest and service worker — installable to home screen, offline shell caching, and push notifications, without a separate native codebase. Native iOS/Android apps (via Expo/React Native) are explicitly deferred until app-store presence is needed.

### 4.9 Authentication & Role-Based Access Control
**Purpose:** Secure, role-appropriate access across all the above modules.

**Features:**
- Roles: Super Admin, Company Admin, Staff/Agent, Property Owner (optional), Customer
- Email/phone OTP-based login for customers; password + optional 2FA for admin/staff
- JWT/session-based auth with tenant-scoped permissions
- Social login option (Google) for customer convenience

### 4.10 Analytics & Reporting
**Purpose:** Give both you and each tenant visibility into performance.

**Features:**
- For tenants: listing performance (views, inquiries, conversion rate), lead funnel, revenue reports, SMS delivery/engagement rate
- For you (platform): MRR/ARR, tenant growth, churn rate, feature usage, SMS volume across platform
- Exportable reports and dashboard charts

### 4.11 Support & Communication
**Purpose:** Keep the loop closed between customer, tenant staff, and platform support.

**Features:**
- In-app enquiry/chat between customer and company staff
- Ticketing system for tenants to raise support requests with you (the SaaS provider)
- Automated email/SMS confirmations for key events (booking confirmed, payment received)

### 4.12 Facebook Distribution Add-on (Page-based, not Marketplace API)
**Purpose:** Give tenants extra reach on Facebook without depending on an integration that doesn't officially exist.

**Why not a direct Marketplace integration:**
- Facebook Marketplace has no free/open API for posting listings — the only path is Meta's **Marketplace Partner Item API**, which requires formal approval as a commerce partner (not self-serve, geographically restricted, aimed at large catalogs).
- Facebook Marketplace **buyer/seller chats are tied to the seller's personal profile inbox**, and are not exposed by the Messenger Platform's Send/Receive API or Conversations API under any circumstance. There is no way to pull Marketplace messages into this platform.

**What we build instead:**
- A "Share to Facebook" action on each listing that generates a pre-formatted post (title, price, photos, description) with a link/CTA that routes interested buyers to message the **tenant's Facebook Page** rather than a personal profile
- Staff still does the actual posting to Marketplace manually (low effort, avoids ToS risk from automation/scraping)
- Because **Page messaging is fully supported** by the official Messenger Platform API, leads that land in the Page inbox *can* be captured via webhook and pushed into the Customer Management (CRM) module and Matching Engine automatically — giving most of the practical benefit of "Marketplace integration" through a channel that's actually API-reachable
- Scoped as a **Phase 3 add-on**, not part of MVP

**Multi-tenant architecture correction — one shared Meta App, many connected Pages:** each tenant company has its own Facebook Page, so a single global `FB_PAGE_ACCESS_TOKEN` env var only works for one tenant, not the whole platform. The correct shape: **you (the platform owner) create and own exactly one Meta App**, complete App Review on it once, and each **tenant connects their own Page to it individually** via a "Connect Facebook Page" button in their Company Admin dashboard — a standard Facebook Login for Business OAuth flow, not a manually pasted token. The resulting per-tenant Page Access Token is stored encrypted in a new `tenant_facebook_connections` table (Section 12), keyed by `tenant_id`, so the webhook receiver looks up which tenant a message belongs to by `fb_page_id`, then uses that tenant's stored token to reply — not a single shared credential. See Section 26 for the concrete setup steps and real console paths, split into what you do once versus what each tenant does themselves.

**Second connection option — Bring Your Own App (BYO-app):** for tenants who won't authorize a connector app on their Page (common for larger/more risk-averse property companies), offer a second path where the tenant creates and owns their *own* Meta App, points its webhook at your shared `/facebook/webhook` endpoint themselves, and pastes their own credentials into a form in the admin console instead of going through OAuth. `tenant_facebook_connections.connection_method` records which path a given tenant used (Section 12); the webhook handler branches on it to know which App Secret to verify the inbound signature against. **This does not reduce what the platform can access on the tenant's Page — the Page Access Token grants the same capability either way — and it requires the tenant to hand over their App Secret, a more sensitive credential than OAuth ever exposes on either side.** It also means the tenant's own app needs its own App Review for Advanced Access before real customer messages arrive, same requirement as the shared app, just now their responsibility instead of yours. Offer both, default the admin console UI to OAuth, and let BYO-app be the explicit alternative for tenants who ask for it — see Section 26.3 for the tenant-facing setup steps.

---

## 5. Add-On / Premium Modules (Upsell Opportunities)

These are monetizable extras you can gate behind higher subscription tiers:

| Add-on | Description |
|---|---|
| **WhatsApp Business API integration** | Send notifications/matches via WhatsApp in addition to SMS |
| **AI-based smart matching** | Use ML to rank matches by likelihood-to-convert, not just rule-based filters |
| **Virtual tour / 360° photos** | Richer listing media for premium properties |
| **Roommate-matching** | Let customers who want to share a room find compatible roommates |
| **Verification/KYC badge** | Verify property owners/listings to build trust ("Verified Listing") |
| **Broker/agent commission tracking** | If tenant works with external brokers, track and pay commissions automatically |
| **Automated rent reminders** | Recurring SMS/email reminders to tenants' customers for rent due dates (useful if the room-finder company also manages ongoing rent collection) |
| **Multi-language support** | Localize the customer frontend and SMS templates |
| **Native mobile apps** | iOS/Android apps beyond the responsive web/PWA |
| **Custom domain mapping** | Let a tenant use their own domain instead of a subdomain |
| **API access** | Let larger tenants integrate the platform with their own external tools |

---

## 6. Suggested SaaS Subscription Tiers

| Tier | Target | Includes |
|---|---|---|
| **Starter (Free/Trial)** | New/small companies testing the platform | Up to 20 listings, 1 admin user, no SMS (email only), basic branding |
| **Basic** | Small room-finder companies | Up to 150 listings, 3 staff accounts, limited SMS credits/month, payment integration |
| **Pro** | Growing companies | Unlimited listings, unlimited staff, higher SMS credit bundle, analytics, custom branding |
| **Enterprise** | Large multi-branch companies | All Pro features + API access, custom domain, dedicated support, AI matching add-on, white-labeling |

*(SMS is naturally a metered/consumption cost since third-party SMS gateways charge per message — pricing this as credits/bundles on top of a base subscription protects your margins.)*

---

## 7. Recommended Tech Stack

| Layer | Recommendation | Notes |
|---|---|---|
| Frontend (Customer PWA) | React + Vite (`vite-plugin-pwa`) — **finalized** | SPA with installable PWA; Next.js/SSR considered but not needed for MVP — revisit only if organic search SEO on listing pages becomes a priority |
| Frontend (Admin Console) | React + Vite, shared component library with the customer app | Covers both Company Admin and Super Admin, gated by role |
| Admin/Super-Admin Framework | Refine (headless) + shadcn/ui + TanStack Table | Auto-generates CRUD screens from the NestJS API; see Section 15.1 for rationale |
| Backend API | NestJS — **finalized** | Modular, TypeScript-first, strong fit for multi-tenant guards/interceptors |
| Database | PostgreSQL | Row-level multi-tenancy via `tenant_id` (see Section 17), strong relational integrity for bookings/payments |
| Cache/Queue | Redis + BullMQ | For async SMS sending, matching engine jobs, notifications, rent reminders |
| SMS Gateway | Sparrow SMS/Aakash SMS (Nepal) + Twilio (international) — **finalized dual-provider**, adapter pattern with routing by phone prefix | See Section 16 for adapter interface |
| Payments | eSewa/Khalti/Fonepay (Nepal) + Stripe/PayPal (international) — **finalized dual-gateway**, adapter pattern | See Section 16 for adapter interface |
| File/Image Storage | AWS S3 / Cloudflare R2 | For listing photos, documents |
| Hosting/Infra | Docker containers on AWS ECS Fargate or GCP Cloud Run + CI/CD (GitHub Actions) | Avoids full Kubernetes overhead at this scale; API, worker, and frontends scale independently |
| Maps | Google Maps API or OpenStreetMap/Mapbox | For location pin, search-by-map |
| Monitoring | Sentry + Grafana/Prometheus | Track errors and SMS/payment delivery health |

---

## 8. High-Level Data Model (Key Entities)

- **Tenant** (company) → has many **Users** (admin/staff), **Listings**, **Customers**, **SubscriptionPlan**
- **Listing** (room/property) → belongs to Tenant, has many Images, Amenities, has one Location
- **Customer** → belongs to Tenant, has one SavedPreference, has many Bookings, Inquiries
- **Booking** → belongs to Customer + Listing, has one Payment
- **Payment** → polymorphic: can belong to Booking (tenant-level) or Subscription (platform-level)
- **SMSLog** → belongs to Tenant + Customer + Listing (match event), tracks status
- **SubscriptionPlan** → defines feature limits per Tenant

*(This is the conceptual model. See Section 12 for the concrete, field-level PostgreSQL schema ready for migration files.)*

---

## 9. Development Roadmap

### Phase 0 — Discovery & Setup (2–3 weeks)
- Finalize requirements, wireframes/UI design (Figma), finalize tech stack
- Set up multi-tenant architecture skeleton, CI/CD, staging environment
- Choose and contract SMS gateway + payment gateway providers

### Phase 1 — MVP (8–10 weeks)
- Tenant onboarding (basic, manual approval OK for MVP)
- Room listing CRUD + image upload
- Customer capture + saved preferences (basic CRM)
- Rule-based matching engine (synchronous, simple filter match)
- SMS integration (single provider) triggered on match
- Basic payment integration (one gateway) for bookings
- Customer-facing frontend: search, listing detail, enquiry form
- Company admin dashboard: listings, leads, basic reports
- **Goal:** Onboard 2–3 pilot room-finder companies

### Phase 2 — Core SaaS Hardening (6–8 weeks)
- Super Admin panel: tenant management, subscription plans, usage metering
- Billing module: subscription invoicing, plan limits enforcement
- SMS credit/wallet system, delivery tracking, templates
- Role-based access control refinement (staff/agent roles)
- Analytics dashboards (tenant + platform level)
- Booking calendar/availability management

### Phase 3 — Growth Features (6–8 weeks)
- Multiple SMS/payment gateway support (localization by country)
- Reviews & ratings, favorites, saved searches on customer frontend
- Custom branding per tenant (theme, subdomain)
- Support ticketing system
- Bulk listing upload (CSV) for larger tenants
- Facebook Page-based distribution: "Share to Facebook" listing generator + Page inbox webhook capture into CRM/Matching Engine (see Section 4.12)
- Property owner self-service submission (Section 1.3) — public unauthenticated form, staff review queue, SMS notification on approval

### Phase 4 — Premium Add-ons & Scale (ongoing)
- WhatsApp integration, AI-based matching, virtual tours
- Native mobile apps
- API access for Enterprise tenants
- Multi-language support
- Performance optimization, load testing, advanced monitoring

**Total estimated time to a solid, sellable v1 (Phases 0–2): ~4–5 months** with a small focused team (1 PM, 2 backend, 2 frontend, 1 designer, part-time QA). Phase 3–4 can run as continuous post-launch iterations based on paying-customer feedback.

---

## 10. Non-Functional Requirements

- **Security:** Tenant data isolation, encrypted storage of payment/PII data, OWASP-compliant API, rate limiting on public endpoints
- **Scalability:** Stateless API services behind a load balancer; SMS/matching jobs run in background workers/queues so spikes (e.g. many new listings at once) don't block the main app
- **Compliance:** SMS opt-in/opt-out handling to respect anti-spam regulations; payment data handled via PCI-compliant gateways (never store raw card data yourself)
- **Availability:** Target 99.5%+ uptime for a paid SaaS product; automated backups of the database
- **Localization-readiness:** Currency, date, and language should be configurable per tenant from day one, even if only one locale ships at MVP

---

## 11. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| SMS delivery failures/costs spiral | Use adapter pattern to switch providers; set per-tenant SMS credit caps |
| Multi-tenant data leakage | Enforce tenant_id scoping at the ORM/query level with automated tests |
| Payment gateway compliance complexity | Use established gateways (Stripe/eSewa/Khalti) rather than building custom payment handling |
| Feature creep delaying MVP | Lock Phase 1 scope strictly to the MVP list above; add-ons are explicitly deferred |
| Low customer SMS opt-in due to spam concerns | Clear opt-in flow, useful/relevant message templates, easy opt-out |

---

## 12. Detailed Database Schema (PostgreSQL)

Field-level schema, ready to translate into migration files. All tenant-scoped tables carry `tenant_id` for row-level isolation (see Section 17). Every table also carries `created_at`/`updated_at` timestamps via a shared base entity — these are omitted from most tables below for brevity and only spelled out where they matter for a specific reason (e.g. `listings`, where `created_at` is load-bearing for pagination, not just an audit column — see Section 14.1).

**tenants**
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | varchar | |
| subdomain | varchar, unique | e.g. `abc` → `abc.roomfinder.com` |
| custom_domain | varchar, nullable | Enterprise add-on |
| logo_url, theme_color | varchar, nullable | |
| country | varchar | primary operating country |
| default_currency | varchar | NPR, USD, etc. |
| status | enum(trial, active, suspended, cancelled) | |
| created_at, updated_at | timestamp | |

**subscription_plans**
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | varchar | Starter/Basic/Pro/Enterprise |
| max_listings, max_staff_users | int, nullable | null = unlimited |
| sms_credits_included | int | |
| price_monthly | decimal | |
| price_currency | varchar | |
| features | jsonb | feature-flag map |

**tenant_subscriptions**
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| tenant_id | uuid, FK → tenants | |
| plan_id | uuid, FK → subscription_plans | |
| status | enum(active, past_due, cancelled) | |
| current_period_start/end | timestamp | |
| sms_credits_remaining | int | |

**users** (staff/admin/super-admin)
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| tenant_id | uuid, FK, nullable | null only for super_admin |
| name, email, phone | varchar | email unique per tenant |
| password_hash | varchar | bcrypt/argon2 |
| role | enum(super_admin, company_admin, staff, agent) | |
| status | enum(active, invited, disabled) | |
| last_login_at | timestamp, nullable | |

**customers**
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| tenant_id | uuid, FK | |
| name, phone, email | varchar | phone unique per tenant |
| phone_verified | boolean | via OTP |
| sms_opt_in | boolean, default true | |
| preferred_language | varchar | |

**customer_preferences**
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| customer_id | uuid, FK | |
| locations | jsonb | array of area names/geo bounds |
| budget_min, budget_max | decimal | |
| room_type | enum(single, shared, pg, apartment, studio) | |
| bhk_type | enum(studio, 1bhk, 2bhk, 3bhk, 4bhk_plus), nullable | *(added post-Phase-1)* so the Matching Engine (Section 4.5) can match on BHK, not just room_type |
| move_in_date | date, nullable | |
| amenities_wanted | jsonb | array of amenity IDs — now includes feasibility-category amenities |
| active | boolean | used/paused by matching engine |

**listings**
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| tenant_id | uuid, FK | |
| title, description | varchar/text | |
| room_type | enum(single, shared, pg, apartment, studio) | |
| bhk_type | enum(studio, 1bhk, 2bhk, 3bhk, 4bhk_plus), nullable | *(added post-Phase-1)* mainly applies to apartment/studio room_type; nullable since PG/shared rooms don't fit BHK terminology |
| number_of_rooms | int, nullable | *(added post-Phase-1)* distinct from bhk_type — usable for listings that don't fit BHK terms |
| rent_amount, deposit_amount | decimal | |
| currency | varchar | |
| address, city | varchar | |
| latitude, longitude | decimal | used for location search; radius search is a Phase 2+ extension |
| status | enum(draft, pending_review, published, occupied, archived) | |
| available_from | date | |
| created_by | uuid, FK → users, **nullable** | *(nullability added Section 1.3)* null when `submission_source = owner_submitted` — no staff user created it |
| submission_source | enum(staff_created, owner_submitted), default 'staff_created' | *(added Section 1.3)* |
| owner_name, owner_phone, owner_email | varchar, nullable | *(added Section 1.3)* populated only for owner-submitted listings; contact info for an owner who has no staff/user account |
| created_at, updated_at | timestamp | **spelled out here** (unlike other tables) because `created_at` is the keyset sort column for cursor pagination on the public search endpoint — see Section 14.1. Composite index: `(tenant_id, status, created_at DESC, id DESC)`.

**listing_images** — `id, listing_id (FK), url, sort_order`
**customer_images** *(Section 1.7)* — `id, tenant_id, customer_id (FK), url, type (varchar, default 'other'), sort_order, created_at`
**amenities** — `id, name (unique), category (enum(general, feasibility), default 'general')` — *(category added post-Phase-1)* lets "near highway" / "near public transport station" style feasibility tags reuse the existing amenity + `listing_amenities` infrastructure instead of a parallel schema
**listing_amenities** — join table: `listing_id (FK), amenity_id (FK)`, composite PK

**bookings**
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| tenant_id, listing_id, customer_id | uuid, FK | |
| status | enum(pending, confirmed, cancelled, completed) | |
| move_in_date | date | |
| amount_due, amount_paid | decimal | |

**payments**
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| tenant_id | uuid, FK, nullable | null for platform-level subscription payments |
| payable_type | enum(booking, subscription) | polymorphic |
| payable_id | uuid | references bookings.id or tenant_subscriptions.id |
| gateway | enum(stripe, paypal, esewa, khalti, fonepay) | |
| gateway_transaction_id | varchar | |
| amount, currency | decimal/varchar | |
| status | enum(pending, success, failed, refunded) | |
| raw_response | jsonb | full gateway payload for audit |

**sms_templates** — `id, tenant_id (nullable=platform default), name, body_text, event_trigger enum(new_match, booking_confirmed, rent_reminder, owner_submission_received, owner_submission_approved, custom)` — *(the two `owner_submission_*` values added Section 1.3, additive to the existing enum)*

**sms_logs**
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| tenant_id, customer_id | uuid, FK | |
| listing_id | uuid, FK, nullable | the match that triggered it |
| template_id | uuid, FK, nullable | |
| provider | enum(sparrow, aakash, twilio) | |
| message_body | text | |
| status | enum(queued, sent, delivered, failed) | |
| provider_message_id | varchar, nullable | |
| sent_at, delivered_at | timestamp, nullable | |

**notifications** — `id, tenant_id, recipient_type(customer/user), recipient_id, channel enum(sms,email,push,in_app), status, payload jsonb`

**reviews** — `id, tenant_id, listing_id, customer_id, rating (1-5), comment, created_at`

**support_tickets** — `id, tenant_id (nullable), raised_by_user_id, subject, description, status enum(open,in_progress,resolved,closed)`

**audit_logs** — `id, tenant_id (nullable), actor_user_id, action, entity_type, entity_id, metadata jsonb, created_at`

**tenant_facebook_connections** *(Phase 3, added alongside the Section 4.12 architecture correction)* — `tenant_id (PK/FK, one connection per tenant), connection_method enum(oauth_shared_app, byo_app), fb_page_id, fb_page_name, page_access_token (encrypted at rest), fb_app_id (nullable — only set for byo_app, stored for support/debugging reference), fb_app_secret (nullable, encrypted at rest — only set for byo_app, see Section 4.12/26.3), connected_by (FK → users), connected_at, token_expires_at (nullable — long-lived Page tokens don't expire but can be revoked)`. Looked up by `fb_page_id` when the shared webhook receives a message, so it knows which tenant's token to use for the reply — and, per `connection_method`, which App Secret to verify the inbound signature against (Section 19).

**fb_page_leads** *(Phase 3)* — `id, tenant_id, fb_page_id, fb_sender_psid, message_text, matched_customer_id (nullable, FK), created_at`

---

## 13. Backend Architecture — NestJS Module & Folder Structure

```
src/
  main.ts
  app.module.ts
  common/
    guards/            (tenant.guard.ts, roles.guard.ts, jwt-auth.guard.ts)
    interceptors/       (tenant-context.interceptor.ts, logging.interceptor.ts)
    filters/            (http-exception.filter.ts)
    decorators/         (current-user.decorator.ts, roles.decorator.ts)
  config/               (configuration.ts, validation.schema.ts)
  modules/
    auth/               (JWT + OTP login, refresh tokens)
    tenants/            (onboarding, settings, branding)
    users/              (staff/admin accounts, RBAC)
    listings/           (CRUD, images, amenities, availability)
    customers/          (CRM, preferences)
    matching-engine/    (rule evaluation, triggers SMS job)
    sms/
      adapters/         (sparrow-sms.adapter.ts, aakash-sms.adapter.ts, twilio.adapter.ts)
      sms.service.ts     (routes to correct adapter, logs to sms_logs)
    payments/
      adapters/         (stripe.adapter.ts, esewa.adapter.ts, khalti.adapter.ts)
      payments.service.ts
    bookings/
    subscriptions/       (plan enforcement, billing)
    notifications/
    reviews/
    support/
    facebook-integration/ (Phase 3: Page webhook receiver, lead capture)
    analytics/
    super-admin/          (platform-level: tenant management, metering)
  database/
    migrations/
    seeds/
jobs/                      (BullMQ processors: matching-dispatch, sms-dispatch, rent-reminders)
```

**Tenant context mechanism:** a request-scoped `TenantContextService` (backed by `AsyncLocalStorage`) resolves the tenant either from the request subdomain (customer/public routes) or from the JWT's `tenant_id` claim (admin/staff routes), and every tenant-scoped repository call is auto-filtered by it (see Section 17).

---

## 14. REST API Endpoint Map (Core Modules)

| Method | Path | Module | Description | Auth |
|---|---|---|---|---|
| POST | /auth/otp/request | auth | Send OTP to customer phone | Public |
| POST | /auth/otp/verify | auth | Verify OTP, issue tokens | Public |
| POST | /auth/login | auth | Staff/admin email+password login | Public |
| POST | /auth/refresh | auth | Refresh access token | Refresh token |
| POST | /tenants | tenants | Onboard new tenant | Super Admin |
| GET/PATCH | /tenants/:id | tenants | View/update tenant settings | Company Admin+ |
| GET/POST | /listings | listings | List (public, cursor-paginated, filterable by city, roomType, bhkType, numberOfRooms, rent range, amenity/feasibility tag IDs — see Section 14.1) / create | Public (GET) · Staff (POST) |
| POST | /listings/owner-submission | listings | Public, unauthenticated property-owner self-service submission — creates a listing at `pending_review` (Section 1.3) | Public, rate-limited |
| GET | /listings/admin/all | listings | All-status admin view, offset-paginated, filterable by `submissionSource` for the owner-submission review queue (Section 1.3) | Staff |
| GET/PATCH/DELETE | /listings/:id | listings | View/update/delete a listing | Public (GET) · Staff |
| POST | /listings/:id/images | listings | Upload listing images | Staff |
| GET/POST | /customers | customers | List/create customer records | Staff |
| POST | /customers/:id/images | customers | Upload customer images — profile/ID photo (Section 1.7) | Staff |
| PATCH | /customers/:id/preferences | customers | Update saved search preferences | Customer/Staff |
| POST | /bookings | bookings | Create a booking | Customer/Staff |
| PATCH | /bookings/:id | bookings | Update booking status | Staff |
| POST | /payments/intent | payments | Create payment intent (routed to gateway) | Customer |
| POST | /payments/webhook/:gateway | payments | Gateway webhook receiver | Public (signature-verified) |
| GET | /sms/logs | sms | View SMS delivery logs | Company Admin |
| POST | /sms/test | sms | Send a test SMS | Company Admin |
| GET | /subscriptions/plans | subscriptions | List available plans | Public |
| POST | /subscriptions/subscribe | subscriptions | Subscribe tenant to a plan | Company Admin |
| GET | /super-admin/tenants | super-admin | List all tenants | Super Admin |
| PATCH | /super-admin/tenants/:id/status | super-admin | Suspend/activate tenant | Super Admin |
| GET | /analytics/overview | analytics | Dashboard metrics | Company Admin / Super Admin |
| POST | /facebook/webhook | facebook-integration | Page message webhook (Phase 3) | Public (verify token) |

*(This is the MVP-critical subset; each module will have additional supporting endpoints such as pagination, search filters, and bulk operations as it's built out.)*

### 14.1 Pagination Strategy — Cursor Where It Earns Its Complexity, Offset Everywhere Else

Cursor pagination is the right tool for exactly one endpoint here, not a default to apply everywhere. The split:

| Endpoint type | Strategy | Why |
|---|---|---|
| Public listing search (`GET /listings`) — powers customer infinite scroll | **Cursor (keyset)** | New listings publish continuously (the Matching Engine writes on every publish). Offset pagination visibly breaks under continuous writes — a customer scrolling while new listings insert either sees duplicates or skips rows, because "page 3" shifts under them mid-scroll. Cursor pagination has no such drift, and it maps directly onto `useInfiniteQuery`. |
| Admin/internal list endpoints (`GET /customers`, `GET /super-admin/tenants`, `GET /sms/logs`, admin's own listings table view) | **Offset (page number)** | Admin users want "page 5 of 12" and an exact total count — things cursor pagination structurally can't give you. Refine's data provider and TanStack Table (Section 15.1) are built around page/pageSize out of the box, so this is also the path of least implementation effort. Tenant-scoped data volumes here are moderate, so the `COUNT(*)` cost of offset pagination isn't a real concern yet — revisit only if a specific tenant's table grows large enough to matter. |

**Cursor-based request/response shape (`GET /listings`):**
```
GET /listings?limit=20&cursor=<opaque-base64>&city=&bhkType=&numberOfRooms=&minRent=&maxRent=&amenityIds=

Response: { "data": Listing[], "nextCursor": string | null }
```
- The cursor encodes the last-seen `(created_at, id)` tuple, base64'd — never a raw offset number.
- Query pattern: `WHERE tenant_id = :tenantId AND status = 'published' AND (created_at, id) < (:cursorCreatedAt, :cursorId) ORDER BY created_at DESC, id DESC LIMIT :limit`.
- Fetch `limit + 1` rows; if the extra row exists, set `nextCursor` from row `limit` and drop it from `data` — this is how you know there's a next page without a separate count query.
- Backed by the composite index noted in Section 12 (`tenant_id, status, created_at DESC, id DESC`) — without it, this query pattern degrades the same way offset pagination does.

**Offset-based request/response shape (admin list endpoints):**
```
GET /customers?page=1&pageSize=25&sort=name&filter=

Response: { "data": T[], "total": number, "page": number, "pageSize": number }
```

**Frontend implementation:**
- **Customer PWA:** `useInfiniteQuery` (TanStack Query) driven by `nextCursor`, triggered by an `IntersectionObserver` on a sentinel element near the bottom of the list. **Pair it with a visible "Load more" button as a fallback, not pure auto-scroll-triggered loading** — auto-only infinite scroll is genuinely harder to use with a keyboard or screen reader, and it makes the footer/company info effectively unreachable. Also persist loaded pages + scroll position (session storage keyed by search params) when navigating to a listing detail page, so returning via back-button doesn't collapse the list back to page one.
- **Admin console:** already covered by the Refine + TanStack Table choice in Section 15.1 — both expect page/pageSize natively, so this needs no additional library or pattern beyond what's already specified.

---

## 15. Frontend Architecture — React PWA Structure

Recommended as a monorepo (pnpm workspaces or Turborepo) with two deployable apps sharing a component library — separating them keeps the customer PWA's caching/installability concerns isolated from the admin console:

```
apps/
  customer-web/         (Vite + React, PWA — public, tenant-themed)
    src/
      pages/             (Landing, Search, ListingDetail, Account, Bookings)
      components/
      hooks/
      api/               (typed API client)
      pwa/               (manifest.json, service worker registration)
  admin-console/          (Vite + React — Company Admin + Super Admin, role-gated)
    src/
      pages/
        company/          (Listings [list + Create Listing form + publish/archive], Customers [list + Create Customer form], Payments, Settings — see Section 1.4)
        super-admin/       (Tenants, Billing, Platform Analytics)
      components/
      hooks/
      api/
packages/
  ui/                    (shared design system / component library)
  api-client/            (shared typed API client + DTO types)
  utils/
```

**State/data:** React Query for server state, Zustand for light UI state, React Hook Form + Zod for form validation (mirroring backend DTOs).
**Routing:** React Router v6.
**PWA specifics:** `vite-plugin-pwa` with `registerType: 'autoUpdate'`. **Open technical decision to make early:** a fully static `manifest.json` can't show a different name/icon per tenant at install time — if per-tenant branded installs matter for launch, the manifest needs to be served dynamically from the backend (`/manifest.webmanifest?tenant=x`) rather than as a static file; otherwise all tenants share one generic app identity at install time, which is fine for MVP.

### 15.1 UI Library Recommendations — Different Choice per App, on Purpose

The customer PWA and the two admin apps have opposite priorities — one needs to feel distinctive and trustworthy to strangers, the other two need to be built fast and stay consistent for internal use — so they shouldn't reach for the same toolkit.

**Customer PWA (`customer-web`) — needs to feel distinctive, not templated:**
- Tailwind CSS + Radix UI (or Headless UI) primitives as the accessible unstyled base, styled per-tenant on top — avoids the generic "AI-built SaaS" look that comes from reaching for a pre-themed component kit on the one surface where branding actually matters commercially.
- If building this with an AI coding agent, explicitly point it at Anthropic's `frontend-design` Skill (already available in this Claude environment) when generating customer-facing screens — it exists specifically to push back on templated, default-looking UI.
- **This applies with extra weight to the Landing Page and the Advanced/Feasibility Search panel (Section 1.2).** These are the highest-visibility screens a prospective customer sees before trusting the platform with a deposit — don't let an agent default to a generic hero-plus-three-cards template here. Instruct it explicitly to load and follow `frontend-design` for these specific screens, not just "build a landing page."

**Company Admin Dashboard + Super Admin Dashboard (`admin-console`) — needs speed and consistency, not uniqueness:**
- **Refine** (headless React admin framework) is the strongest fit here: it ships a NestJS/NestJs-Query data provider matching this stack exactly, it's headless so it renders through Tailwind/shadcn instead of forcing Ant Design or MUI, and it auto-generates CRUD screens (list/create/edit/show) from the API — which matters because Company Admin and Super Admin are ~80% the same table/form/detail patterns, just scoped to different resources and permissions.
- Pair Refine with **shadcn/ui** (Tailwind-based, fast-growing component set, keeps a consistent look with the customer app's design tokens if desired), **TanStack Table** for any data grid Refine doesn't cover out of the box, and **Recharts** for the analytics/dashboard charts already specified in Section 7.
- **Mature alternative:** `react-admin` (Marmelab) is a more opinionated, longer-track-record option with more built-in components, but it's built around Material UI by default — reach for it instead of Refine only if the team explicitly wants that more "batteries-included" feel over Refine's headless flexibility.
- **Consistency tip for agent-built UI:** if multiple agent sessions will be generating admin screens over time, consider encoding "always use Refine + shadcn/ui + TanStack Table for admin/super-admin work" as a small custom Skill (via the `skill-creator` tool) rather than restating it in every prompt — the same mechanism that keeps `frontend-design` consistent across sessions.

---

## 16. Third-Party Integration Adapter Design

Both SMS and payments use the same adapter pattern so providers can be swapped/added without touching business logic:

```typescript
export interface SmsProvider {
  send(to: string, message: string): Promise<{ providerMessageId: string; status: 'sent' | 'failed' }>;
  getDeliveryStatus?(providerMessageId: string): Promise<'delivered' | 'failed' | 'pending'>;
}

export interface PaymentProvider {
  createPaymentIntent(amount: number, currency: string, metadata: Record<string, unknown>):
    Promise<{ redirectUrl?: string; clientSecret?: string; providerRef: string }>;
  verifyWebhookSignature(payload: unknown, signature: string): boolean;
  handleWebhook(payload: unknown): Promise<{ status: 'success' | 'failed'; providerRef: string }>;
}
```

- **`SmsRouterService`** picks the adapter by phone prefix: `+977` → Sparrow/Aakash SMS, everything else → Twilio.
- **`PaymentRouterService`** picks the adapter by the tenant's configured default gateway or the customer's selected payment method at checkout.
- **Facebook Page webhook** (Phase 3): standard Messenger webhook verifying `hub.verify_token`, receiving `messaging` events, mapping `sender.id` (PSID) + `page_id` into an `fb_page_leads` row, and pushing it into the Customer/CRM module as a new inquiry.

---

## 17. Multi-Tenancy Implementation Strategy

**Chosen approach:** single database, shared schema, row-level isolation via `tenant_id` — simpler to operate than schema-per-tenant or database-per-tenant, and comfortably scales to hundreds/low-thousands of tenants, which fits this business size for the foreseeable future.

**Mechanism:**
1. Resolve tenant from the request subdomain (public/customer routes) or from the JWT's `tenant_id` claim (admin/staff routes).
2. A NestJS middleware/interceptor stores the resolved tenant in an `AsyncLocalStorage`-backed `TenantContextService`.
3. An ORM-level hook (TypeORM subscriber or Prisma middleware) automatically appends `WHERE tenant_id = :tenantId` to every query on tenant-scoped entities, and auto-stamps `tenant_id` on every insert.
4. Requests that can't resolve a tenant are rejected (except explicitly whitelisted super-admin/public routes).
5. **Mandatory automated test category:** for every tenant-scoped entity, a test asserting that a query made under Tenant A's context can never return Tenant B's rows.

**Future scaling option (not needed for launch):** migrate a specific large Enterprise tenant to its own schema or database if it ever needs stronger physical isolation — the row-level design doesn't block this later.

---

## 18. DevOps, Environments & Deployment

- **Environments:** local (docker-compose) → staging → production.
- **`docker-compose.yml` (local):** `postgres`, `redis`, `api` (NestJS), `customer-web`, `admin-console`, optional `pgadmin`.
- **CI/CD (GitHub Actions):** lint + unit + integration tests on every PR → auto-deploy to staging on merge to `develop` → deploy to production on merge/tag to `main`.
- **Hosting:** Docker images on AWS ECS Fargate or GCP Cloud Run — avoids full Kubernetes operational overhead at this scale. API, background worker (BullMQ processors), and the two frontends deploy and scale as separate services.
- **Background jobs run in their own container** (matching engine dispatch, SMS dispatch, rent reminders) so a burst of new listings/matches never blocks the main API.
- **Static frontend builds** served via CDN (CloudFront/Cloudflare).
- **Database:** automated daily snapshots + point-in-time recovery enabled from day one.

---

## 19. Security Implementation Checklist

- JWT access token (short-lived) + httpOnly refresh token cookie for staff/admin; OTP-based phone login for customers.
- Passwords hashed with bcrypt or argon2 — never stored plain or reversibly encrypted.
- Tenant isolation enforced at the ORM layer (Section 17) and covered by automated cross-tenant leakage tests.
- Every endpoint validated via `class-validator` DTOs with unknown properties stripped (whitelist mode).
- Rate limiting (NestJS Throttler) on public endpoints — especially OTP request, search, and the owner-submission endpoint (Section 1.3), which is a new unauthenticated public **write** path and the primary spam vector to guard now that it exists.
- Mandatory signature verification on all inbound webhooks (payment gateways, Facebook) — for Facebook specifically, verification now requires a `tenant_facebook_connections` lookup by `fb_page_id` first to resolve which App Secret to check against (Section 26.3), since BYO-app tenants bring their own. A tenant-supplied App Secret gets the same encryption-at-rest and least-privilege access treatment as any platform-owned credential — it is not lower-sensitivity just because the tenant provided it.
- **Billing/subscription state changes are applied only by a confirmed payment webhook, never by a direct client-facing endpoint** (Section 1.5). This is the same pattern already required for booking payments (Section 4.7) — a client-facing endpoint may create a payment intent, but only the webhook, after gateway confirmation, may mutate the actual paid state (`tenant_subscriptions.plan_id`, `bookings.status`, credit balances). Any endpoint that lets a client directly flip a billing-relevant field is the exact bug class covered in Section 1.5.
- Secrets loaded from a secrets manager (AWS/GCP Secrets Manager) in staging/production — never committed `.env` files.
- HTTPS + HSTS everywhere.
- Audit log entries for sensitive actions: refunds, tenant suspension, role changes, plan changes.

---

## 20. Testing Strategy

- **Unit tests (Jest):** services and adapters, with SMS/payment providers mocked.
- **Integration tests (Supertest):** against a dockerized test Postgres instance — this is where tenant-isolation edge cases get covered. **The test database must be built by running actual migration files (`migration:run`), not `synchronize: true`/`dropSchema: true`.** TypeORM's `synchronize` auto-generates the schema fresh from current entity definitions on every run — it never actually executes your migrations, so a broken, missing, or out-of-sync migration can pass every integration test and still fail the moment it's run against a real environment. If integration tests are currently using `synchronize`, that's not a minor style choice — it means "tests are green" and "migrations work" are two different, unverified claims, and only the first one is being checked. Fix this before trusting a green integration suite as evidence the backend/DB layer is actually sound.
- **E2E tests (Playwright/Cypress):** critical customer journey — search → enquire → SMS triggered (mocked) → booking → payment (gateway test/sandbox mode).
- **Load testing (k6/Artillery):** specifically on the matching engine + SMS dispatch queue before launch — this is the feature most likely to spike under real usage (e.g. one popular listing matching hundreds of saved preferences at once).
- **CI gate:** PRs blocked unless lint + unit + integration tests pass — and per above, "integration tests pass" only means something if they ran against migrated schema.

---

## 21. Environment Variables Reference

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection for queues/cache |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing |
| `JWT_ACCESS_EXPIRY` | Access token TTL |
| `SMS_SPARROW_API_KEY`, `SMS_SPARROW_API_URL` | Nepal SMS provider |
| `SMS_TWILIO_ACCOUNT_SID`, `SMS_TWILIO_AUTH_TOKEN` | International SMS provider |
| `PAYMENT_STRIPE_SECRET_KEY`, `PAYMENT_STRIPE_WEBHOOK_SECRET` | International payments |
| `PAYMENT_ESEWA_MERCHANT_ID`, `PAYMENT_ESEWA_SECRET` | Nepal payments |
| `PAYMENT_KHALTI_SECRET_KEY` | Nepal payments |
| `FB_APP_ID`, `FB_APP_SECRET`, `FB_WEBHOOK_VERIFY_TOKEN`, `FB_LOGIN_CONFIG_ID`, `FB_OAUTH_REDIRECT_URI` | Phase 3 Facebook Page integration — all five are global (one shared Meta App for the whole platform, Section 4.12) and **backend-only**. None belong in a `VITE_*` frontend env var or anywhere in the admin console bundle — the backend constructs the OAuth redirect and does the code exchange server-side (Section 26.2), so the frontend never needs `client_id` directly, only a button that hits your backend's `/facebook/oauth/start` endpoint. **`FB_PAGE_ACCESS_TOKEN` is intentionally not a global env var** — each tenant's Page token is stored encrypted per-tenant in `tenant_facebook_connections` (Section 12), obtained via OAuth, not hardcoded. |
| `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Listing image storage |
| `APP_BASE_URL`, `CUSTOMER_APP_BASE_URL` | Used in SMS links, webhooks, CORS |
| `NODE_ENV` | environment flag |

---

## 22. MVP Definition of Done (Acceptance Criteria)

- [ ] A new tenant can be onboarded with a working subdomain
- [ ] Company admin can create/edit/publish a listing with images
- [ ] Customer can register via OTP and save search preferences
- [ ] Publishing a matching listing triggers an SMS to matching customers, logged in `sms_logs`, within an acceptable delay
- [ ] Customer can browse/search/filter listings on the PWA and submit an enquiry
- [ ] A booking can be created and a payment collected via at least one gateway (sandbox mode acceptable pre-launch)
- [ ] Company admin dashboard shows live counts (listings, leads, payments)
- [ ] Automated tests confirm no cross-tenant data leakage
- [ ] The customer app is installable as a PWA (manifest + service worker verified on Chrome/Android at minimum)

---

## 23. Immediate Next Steps (Business + Technical Kickoff)

1. Confirm subscription pricing with 1–2 pilot tenants before finalizing the billing module logic
2. Start Sparrow/Aakash SMS and eSewa/Khalti merchant account setup now — KYC/approval on these typically takes longer than the dev work itself
3. Set up the monorepo (NestJS backend + `apps/customer-web` + `apps/admin-console`), CI pipeline, and staging environment
4. Implement the multi-tenant context + tenant-isolation test harness **first**, before any feature module — everything else depends on it being correct
5. Build MVP modules in this order: Tenants/Auth → Listings → Customers/Preferences → Matching Engine → SMS adapter → Payments (single gateway first) → Customer PWA → Admin dashboard
6. Run the MVP Definition of Done checklist (Section 22) before onboarding the first real pilot tenant

---

## 24. Horizontal Scaling Strategy

**Where the architecture already helps:**
- JWT-based auth is stateless — any instance can validate any request, so no session affinity is needed at the load balancer.
- Tenant context (Section 17) is resolved per-request via `AsyncLocalStorage` — it's request-scoped, not stored on the server, so it carries no state between requests or instances.
- File/image storage already goes straight to S3/R2 (Section 7) rather than local disk — critical, since local-disk storage silently breaks the moment a second server is added (uploads become instance-specific and disappear from the load balancer's point of view).

**What needs explicit design for safe horizontal scaling:**

### 24.1 API Layer
- Deploy the NestJS API as N identical, stateless container instances behind a load balancer (AWS ALB / GCP Load Balancer / Nginx).
- No sticky sessions required (auth is JWT).
- A `/health` endpoint lets the load balancer/orchestrator route traffic only to ready instances, and drain an instance gracefully on deploy/scale-down (finish in-flight requests, stop accepting new ones — avoids dropped requests mid-deploy).
- Auto-scale on CPU utilization and/or requests-per-instance. A reasonable starting policy: min 2 instances (redundancy, not load), max 8-10, scale out above ~65-70% sustained CPU.

### 24.2 Shared State — Redis Must Be Centralized
- A single managed Redis (AWS ElastiCache / GCP Memorystore) — never one Redis per instance — backs: BullMQ queues, rate-limit counters, and any application-level cache (cached search results, tenant settings, subscription plan limits).
- NestJS's default Throttler storage is in-memory — once there's more than one instance it must be switched to a Redis-backed storage adapter, or each instance ends up enforcing its own separate rate limit instead of one shared limit.
- If real-time features (live chat, push-style updates) are added later, use Socket.IO's Redis adapter so a message published from one instance reaches sockets connected to any other instance.

### 24.3 Background Workers Scale Independently
- BullMQ workers pull from the shared Redis queue — safe to run as multiple worker instances, since each job is claimed by exactly one worker.
- Scale the worker pool separately from the API pool: SMS/matching-engine load and API request load don't move together — a single popular listing can spike matching/SMS jobs without any spike in API traffic at all.
- Make job handlers idempotent (e.g. a dedupe key of `listing_id + customer_id + event_type` checked before sending an SMS) so a retried job never double-sends.

### 24.4 Database — the Real Bottleneck at Scale
- **Connection pooling is mandatory once there are multiple API instances.** Put PgBouncer (or RDS Proxy / Cloud SQL's built-in pooler) in front of Postgres — N instances × M connections each can exhaust Postgres's connection limit quickly without it.
- **Read replicas** for read-heavy paths (public listing search/browse) once traffic justifies it — route reads there, writes to the primary.
- **Migrations run once, as a CI/CD deploy step — never on each instance's boot.** Letting every instance run migrations on startup causes race conditions when multiple instances deploy simultaneously.
- Index `tenant_id` (and composite indexes like `(tenant_id, status)` on listings) — every query is tenant-filtered by design, so this is where query performance is won or lost as data grows.

### 24.5 Idempotency Across Instances
- A payment gateway webhook retry can land on a different server than the first attempt. Guard with a unique constraint on `gateway_transaction_id` in the `payments` table and check-before-process logic — never assume "this instance already saw this webhook," since the next attempt may hit a different one.
- Apply the same principle to the Facebook Page webhook and any other inbound webhook.

### 24.6 Observability Across Instances
- Centralized logging (CloudWatch / Stackdriver / ELK) — logs from any instance must be queryable together, not left on individual instance disks.
- Propagate a request ID through headers so a single customer request can be traced across load balancer → API instance → worker → SMS/payment adapter.
- Centralized metrics (Prometheus/Grafana or a managed equivalent) aggregated across all instances — per-instance dashboards stop being useful once auto-scaling is in play.

### 24.7 Suggested Scaling Order (Don't Over-Build Early)
1. **Launch:** 2 API instances behind a load balancer (for redundancy, not yet for load) + 1 shared Redis + 1 Postgres primary + 1-2 worker instances. This alone gives zero-downtime deploys and basic fault tolerance.
2. **Add a read replica** once search/browse read traffic noticeably competes with write-heavy operations.
3. **Add PgBouncer** as soon as instance count grows past a handful, or sooner if connection-limit errors appear.
4. **Scale the worker pool independently** once SMS/matching volume grows — this is likely to need scaling before the API layer does, since one listing can fan out to hundreds of matched customers at once.
5. **Tune real auto-scaling thresholds** only once there's production traffic data to tune against — guessing CPU/RPS thresholds before launch usually just wastes cost on over-provisioning.

---

## 25. Agent Development Guardrails

If any part of this build is delegated to an AI coding agent (Claude Code, Cursor, or similar), place **`AGENTS.md`** at the repository root alongside this document. It pins the agent to this Plan as the single source of truth and prevents three common failure modes: architecture substitution (swapping the agreed stack for "something easier"), scope creep (building Phase 3/4 features before Phase 1 is done), and silent schema drift (editing the database without updating Section 12).

It also includes a set of **human check-in queries** — questions to paste back to the agent after any task looks "finished," to verify it actually followed the Plan rather than just producing plausible-looking code. Use them liberally; catching drift after one task is cheap, catching it after ten is not.

If using Claude Code specifically, save it as `CLAUDE.md` at the repo root so it's loaded automatically every session — see `AGENTS.md` Section 7 for the exact placement rule.

Three companion files complete the setup:
- **`docs/PROGRESS.md`** — a living checklist mirroring this Plan's Phase 1 build order and Section 22 Definition of Done. The agent updates it after every task; since agent sessions don't carry memory forward, this file is the only record of what's actually been done versus what's merely been discussed.
- **`KICKOFF_PROMPT.md`** — the exact first message to paste into Claude Code (or a similar agent) to start the build. It sequences the agent through reading the Plan and `CLAUDE.md`, scaffolding the repo, installing the testing hooks, building the tenant-isolation foundation first, and then proceeding through Phase 1 in order — stopping for review after the initial scaffold rather than running unsupervised through the whole MVP.
- **`PAUSE_PROMPT.md`** / **`RESUME_PROMPT.md`** — paste `PAUSE_PROMPT.md` before ending any session (forces a proper `PROGRESS.md` update and a clear "Resume Point" note) and `RESUME_PROMPT.md` at the start of the next one (forces the agent to verify that note against actual test/git state before writing new code, rather than trusting it blindly). See `AGENTS.md` Section 9.
- **`PLAN_UPDATE_PROMPT.md`** — paste this whenever the Plan itself has been revised since the agent last worked from it (as opposed to a normal day-to-day pause/resume). It forces the agent to classify each change against what's already built, flag anything that's now ambiguous or needs rework, and report back for a priority decision before writing any code. See `AGENTS.md` Section 10.

---

## 26. Facebook Page Integration — Manual Setup Guide (Real Console Paths)

**This is a human-only task, not something to hand to a coding agent.** It requires logging into Meta's developer console with real business credentials, and — for the one-time platform setup — submitting an App Review that a person has to fill out. The URLs below were verified directly against Meta's current developer documentation (last confirmed May 2026); if any menu label has shifted slightly by the time you do this, the documentation links are the reliable anchor, since Meta's console UI does get reorganized periodically (it moved its docs from `/docs/messenger-platform/...` to `/documentation/business-messaging/messenger-platform/...` earlier this year, so don't be surprised by that kind of shift).

### 26.1 One-time platform setup (you, the SaaS owner — done once, not per-tenant)

1. **Create the Meta App.** Go to **https://developers.facebook.com/apps** → "Create App." Meta now uses a "use case" model rather than the old product picker — choose the use case that adds Messenger/Page-messaging functionality (look for wording like "manage messaging" or "Messenger" among the options; the exact label has changed before and may again). Reference: **https://developers.facebook.com/docs/development/create-an-app/**
2. **Read the Messenger Platform overview** before configuring anything: **https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview**
3. **Configure the webhook.** Inside your app's dashboard, go to **Products → Messenger → Settings**. Enter your webhook callback URL (your deployed `POST /facebook/webhook` endpoint from Section 14) and a Verify Token you choose yourself — this value becomes your `FB_WEBHOOK_VERIFY_TOKEN` env var. Full walkthrough: **https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks**
4. **Subscribe to the right fields.** At minimum: `messages` (incoming text/attachments) and `messaging_postbacks` (button/CTA taps, relevant if your "Share to Facebook" post uses a CTA button). Field reference: **https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks/webhook-events**
5. **Note your App ID and App Secret** from the app dashboard's Settings → Basic page — these become `FB_APP_ID` and `FB_APP_SECRET` (Section 21). The App Secret is what your webhook uses to verify the `X-Hub-Signature-256` header on every inbound event (Section 19) — don't skip that verification step, Meta signs every payload specifically so you can check it.
6. **Submit for App Review to get Advanced Access on `pages_messaging` and `pages_manage_metadata`.** Without this, you can only receive messages from people who have a Developer/Tester/Admin role on your app (fine for testing with your own demo Page, not usable for real tenant customers). Access levels explained: **https://developers.facebook.com/docs/graph-api/overview/access-levels**. App-Review guidance specific to Messenger: **https://developers.facebook.com/documentation/business-messaging/messenger-platform/app-review**. Budget real calendar time for this — Meta's review isn't instant.
7. **Local development:** Meta requires a real HTTPS endpoint with a valid (non-self-signed) TLS certificate for the webhook — plain `localhost` won't validate. Use a tunnel tool (ngrok is the common choice) to expose your local NestJS server during development, and swap in your real deployed URL once you have one.

### 26.2 Per-tenant connect flow (what each Company Admin does, from inside your product — not Meta's dashboard)

This is the part your team builds, using the mechanics Meta exposes. **Correction from the earlier version of this section:** Facebook Login *for Business* (needed for `pages_messaging`) doesn't take raw `scope` values the way classic consumer Facebook Login does — it uses a **Login Configuration** you create once in your app dashboard, identified by a `config_id`. Passing `scope` directly still technically works but Meta's own docs say not to rely on it. Reference: **https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business**

1. **One-time setup (add this to Section 26.1's platform setup, not per-tenant):** in your app dashboard, go to **Products → Facebook Login for Business → Configurations**, create a Configuration that bundles `pages_show_list`, `pages_messaging`, and `pages_manage_metadata`, and note the resulting **Configuration ID** — this becomes `FB_LOGIN_CONFIG_ID` (Section 21).
2. Company Admin clicks "Connect Facebook Page" in the admin console (Section 4.2/4.12). This hits a **backend** endpoint, e.g. `GET /facebook/oauth/start`.
3. **Your backend constructs the redirect — the frontend never needs to know your App ID.** This is the resolution to "where does the client ID go": `client_id` is required by Facebook's OAuth dialog, but there's no reason for the admin console's frontend bundle to carry it — the backend builds the URL server-side using its own `FB_APP_ID` and `FB_LOGIN_CONFIG_ID` env vars, and 302-redirects the admin's browser to it:
   ```
   GET https://www.facebook.com/v25.0/dialog/oauth?client_id=<FB_APP_ID>&redirect_uri=<FB_OAUTH_REDIRECT_URI>&config_id=<FB_LOGIN_CONFIG_ID>&state=<CSRF_TOKEN>
   ```
   Reference for this dialog and its parameters: **https://developers.facebook.com/documentation/facebook-login/guides/advanced/manual-flow**. The `redirect_uri` must exactly match a URL registered under **Products → Facebook Login → Settings → Valid OAuth Redirect URIs** in your app dashboard — mismatches are one of the most common setup errors here.
4. The admin picks which Page to connect on Facebook's side, then gets redirected back to your registered `redirect_uri` (e.g. `GET /facebook/oauth/callback`) with a `code` query param.
5. **Your backend exchanges that code for a user access token server-to-server** — this is where `FB_APP_SECRET` gets used, and it never leaves the backend:
   ```
   GET https://graph.facebook.com/v25.0/oauth/access_token?client_id=<FB_APP_ID>&client_secret=<FB_APP_SECRET>&code=<CODE>&redirect_uri=<FB_OAUTH_REDIRECT_URI>
   ```
6. Your backend exchanges that user token for a **long-lived Page Access Token** for the selected Page, then stores it encrypted in `tenant_facebook_connections` (Section 12) against that tenant's `tenant_id`, with `connection_method = oauth_shared_app`.
7. Your backend calls the Page's `subscribed_apps` edge to subscribe that specific Page to your one shared app's webhook — another server-to-server Graph API call:
   ```
   POST https://graph.facebook.com/<PAGE_ID>/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=<PAGE_ACCESS_TOKEN>
   ```
   Full reference for this call and its requirements (the token needs to come from someone with `MODERATE` access on that Page): **https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks** (see "Subscribe to Meta Webhooks" section on that page).
8. From this point on, a message to that tenant's Page arrives at your **one shared** `/facebook/webhook` endpoint; your handler reads `entry[].id` (the `fb_page_id`) from the payload, looks up which tenant owns that Page in `tenant_facebook_connections`, and files the lead against the correct tenant — this is the mechanism that makes one shared Meta App work safely across many tenants.

**For testing/debugging any step above without writing code first:** the **Graph API Explorer** (**https://developers.facebook.com/tools/explorer**) lets you generate tokens and fire test requests (including the `subscribed_apps` call above) directly from the browser — useful for confirming the Meta side works before wiring up your OAuth flow in the admin console.

### 26.3 BYO-App connect flow (tenant owns their own Meta App instead of using yours)

For tenants who won't authorize a connector app on their Page, this is the alternative path (Section 4.12). The mechanics are the same as Section 26.1, just done by the tenant, scoped to their one Page, and reported back to you via a form instead of an OAuth grant:

1. **The tenant creates their own Meta App**, following the same steps as Section 26.1 items 1–5, but pointed at their own business account: create the app at **https://developers.facebook.com/apps**, add Messenger/Page-messaging functionality, and configure the webhook (**Products → Messenger → Settings**) with the **same callback URL and Verify Token you use platform-wide** — your `/facebook/webhook` endpoint and your `FB_WEBHOOK_VERIFY_TOKEN` stay identical regardless of which app is calling it, since your server is the one comparing that token, not Meta.
2. **The tenant submits their own app for App Review** to get Advanced Access on `pages_messaging` and `pages_manage_metadata` — this is genuinely their task now, not yours, and it's worth telling them upfront it isn't instant (same reference as 26.1 item 6: **https://developers.facebook.com/documentation/business-messaging/messenger-platform/app-review**).
3. **The tenant generates a Page Access Token** for their own Page from their own app's Messenger settings, and collects their **App ID** and **App Secret** from their app dashboard's Settings → Basic page.
4. **In your admin console**, the Company Admin picks "Connect using your own Facebook App" instead of the default OAuth button, and pastes in: Page ID, Page Access Token, App ID, App Secret. Your backend stores these in `tenant_facebook_connections` with `connection_method = byo_app`, encrypting `page_access_token` and `fb_app_secret` the same way (Section 19) — a tenant-supplied App Secret is not a lower-sensitivity credential than one of yours, treat it identically.
5. **Signature verification now branches per request.** Your webhook handler parses the payload first to read `entry[].id` (the `fb_page_id`), looks up the matching `tenant_facebook_connections` row to get both `tenant_id` and `connection_method`, then computes the `X-Hub-Signature-256` check using `FB_APP_SECRET` (global) if `connection_method = oauth_shared_app`, or that tenant's decrypted `fb_app_secret` if `connection_method = byo_app`. The lookup-before-verify order is safe: the lookup only decides *which* secret to check against, and a forged payload still fails verification against either secret if the request didn't actually come from Meta.
6. The tenant still has to manually subscribe their Page to their own app (Section 26.1's webhook configuration step covers this on their side) — there's no server-to-server `subscribed_apps` call for your backend to make here, since it's their app doing the subscribing, not yours.
