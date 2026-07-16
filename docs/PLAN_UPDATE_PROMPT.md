The Plan document (`docs/room-finder-saas-product-document.md`) has just been updated. Before writing any code:

1. **Check the version header at the top of the Plan** against what you last worked from (check `docs/PROGRESS.md`'s Resume Point for any prior version reference, or ask me if it's not recorded). Read every section added or changed since then — don't assume you already know what's new.

2. **Cross-reference each change against `docs/PROGRESS.md`.** For every new or modified item in the Plan, classify it as one of:
   - **Already built and unaffected** — nothing to do
   - **Already built but now needs rework** — the Plan changed something that already-shipped code assumed differently
   - **Already built but was ambiguous, now clarified** — the Plan didn't change scope, it closed a gap in how something already-built should have worked (check for sections literally titled "Clarification")
   - **Entirely new** — not started

3. **Don't silently rewrite or delete already-tested code to fit a new Plan detail unless the change genuinely requires it.** Prefer migrating/extending over replacing. If a change is additive (new nullable column, new enum value, new endpoint), treat it as additive in the code too — don't use it as an excuse to refactor something unrelated.

4. **For anything reclassified as "already built but now needs rework":** write the migration, update only the specific tests that need new assertions, and leave unrelated passing tests alone. If the scope of rework is unclear, ask before touching working, tested code.

5. **Check the Plan's roadmap phase lists (Section 9) against what `PROGRESS.md` marks as phase-complete.** If the Plan now lists something under a phase that `PROGRESS.md` already marked fully done, that's drift — flag it explicitly rather than either (a) silently leaving the phase marked complete when it isn't, or (b) silently reopening it without telling me.

6. **Update `docs/PROGRESS.md` before writing any code for the new work:**
   - Add new/changed items to the appropriate Phase section as `[ ]`, unless cross-referencing shows they're already satisfied
   - Log anything reclassified out of `[x]` under Known Deviations, with which Plan section triggered it
   - Update the Resume Point to name the Plan version you're now working from and what you're tackling first

7. **If the update touches multiple modules or the priority isn't obvious, ask me which to tackle first** rather than guessing an order — this is exactly the kind of moment where a wrong guess compounds across several tasks before anyone notices.

Start by giving me a short summary: what changed in the Plan, how each change maps onto `PROGRESS.md` per the classification in step 2, and what you're proposing to do first. Wait for my go-ahead on the priority before writing code.

Priority for this round: build the "Connect Facebook Page" flow in the Company Admin dashboard first, before anything else from this Plan update. Concretely, that means:

Migration for tenant_facebook_connections (Section 12) — connection_method, fb_app_id, fb_app_secret (encrypted).
Backend: OAuth connect endpoint (exchange + store long-lived Page token, call subscribed_apps, Section 26.2) and a separate BYO-app endpoint (accept pasted Page ID / Page Access Token / App ID / App Secret, store with connection_method = byo_app, Section 26.3) — plus a status/disconnect endpoint so the admin console can show what's currently connected.
Webhook handler update: branch signature verification by connection_method looked up via fb_page_id, per Section 26.3 step 5 — this is the one piece that touches already-shipped code, so treat it as a migration of the existing webhook handler, not a rewrite.
Admin console UI: an Integrations/Settings section with a primary "Connect Facebook Page" button (OAuth) and a secondary "Connect using your own Facebook App" option that reveals the BYO-app form, plus a connected-state view (Page name, method, disconnect).
