We're resuming work on the RoomFinder SaaS project after a pause. This is a fresh session with no memory of what happened before — treat everything below as mandatory, not optional context-gathering:

1. **Read `docs/PROGRESS.md` in full**, especially the "Resume Point" note at the top — that's exactly where the last session left off and what it wants you to know first.
2. **Don't just trust the checklist — verify it.** Run the test suite and confirm what's actually passing matches what `PROGRESS.md` claims is done. If there's a mismatch between the file and reality, stop and flag it before writing any new code — this is exactly the kind of drift `CLAUDE.md` Section 6 exists to catch, and it's cheaper to catch now than after building more on top of a false assumption.
3. **Check `git log` and `git status`** for anything uncommitted, or committed to a WIP branch, from the last session. Resolve or explicitly carry forward anything left unfinished there.
4. **Re-skim `CLAUDE.md`.** The rules haven't changed, but a fresh reminder costs nothing and is cheaper than a drifted assumption three tasks from now.
5. **Check the "Known Deviations / Open Questions" log in `PROGRESS.md`.** If anything there is unresolved, resolve it or explicitly re-raise it with me before building further on top of it.
6. **Continue from the exact next unchecked item** in `PROGRESS.md`'s build order. Don't redo work already marked `[x]` and verified, and don't skip ahead of anything still `[ ]` or `[~]` above it.

Once you've done all of the above, tell me what you found (does the file match reality?) and what you're picking up next — then continue.


Priority for this round, in order:

Fix the test-integrity gap first (unchanged from before) — confirm whether integration tests run against synchronize/dropSchema or real migration:run, fix if needed, and treat any newly-surfaced failure as this session's actual bug to fix.
Fix the subscription payment-bypass bug (Plan Section 1.5) — this is the highest-severity item today, ahead of any new feature work. Confirm whether POST /subscriptions/subscribe currently mutates tenant_subscriptions.plan_id directly. If so: make it create a payment intent instead for any plan with price_monthly > 0, and move the actual plan-change to the webhook handler only, mirroring the booking-payment pattern already correct in Section 4.7. Add the specific test from Section 1.5 (subscribe to a paid plan → plan_id must not change until the webhook fires) before marking this done.
Fix the analytics zero-state bug (Plan Section 1.6). Start by checking whether the customer-count query in AnalyticsService is tenant-scoped the same way every other query is required to be (Section 17) — that's the most likely cause given this codebase's history. Add the zero-state test from Section 1.6.
Only after 1–3 are resolved and confirmed, move to the Facebook OAuth work from the previous priority note (Section 26.2 — FB_LOGIN_CONFIG_ID, FB_OAUTH_REDIRECT_URI, the start/callback endpoints).
Everything else from earlier Plan updates (1.3, 1.4, 14.1) stays behind all of the above.

Report back after (2) specifically — confirm the fix and its test before moving to (3), since a subscription/billing fix is worth a second look before trusting it.
