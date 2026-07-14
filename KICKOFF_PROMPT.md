You are starting the implementation of the RoomFinder SaaS platform. Before writing any code:

1. Read `docs/room-finder-saas-product-document.md` in full — this is the Plan, the single source of truth for scope, architecture, database schema, and roadmap.
2. Read `CLAUDE.md` in full — these are your standing operating rules for this entire project, not just this session.
3. Read `docs/PROGRESS.md`. If it doesn't exist yet, create it — copy it verbatim from the template I've provided; do not invent your own structure for it.

Then, in this exact order:

**Step 1 — Scaffold.**
Create the monorepo structure exactly as specified in Plan Section 13 (backend) and Section 15 (frontend apps). Do not deviate from the folder layout. Initialize package.json/tsconfig for each app, set up the Postgres + Redis docker-compose for local dev (Plan Section 18), and add a CI pipeline skeleton (lint + test on PR).

**Step 2 — Guardrails before features.**
Install the testing hooks from `CLAUDE.md` Section 7 into `.claude/settings.json`. Confirm they actually fire — test on a throwaway file edit — before writing any feature code.

**Step 3 — Tenant context foundation.**
Implement the multi-tenant context mechanism (Plan Section 17) and its cross-tenant-isolation test harness. Nothing else gets built until this passes — every module after this depends on it being correct.

**Step 4 — Begin Phase 1, in order.**
Follow the build order in Plan Section 23, step 5: Tenants/Auth → Listings → Customers/Preferences → Matching Engine → SMS adapter → Payments → Customer PWA → Admin dashboard. Do not skip ahead to a later module, and do not touch Phase 2/3/4 features.

**After every task, without exception:**
- Update `docs/PROGRESS.md` — check off what's done, note the tests added, log any deviation or open question.
- Confirm the task meets the Definition of Done in `CLAUDE.md` Section 5 before calling it complete.
- If anything in the Plan is ambiguous, missing, or seems wrong for what you're building, stop and ask — don't improvise silently and move on.

Start with Step 1 now. Stop and show me the scaffold for review before continuing to Step 2.
