We're stopping for today. Before ending this session, do all of the following — don't skip any step because it seems obvious:

1. **Commit or explicitly flag uncommitted work.** If something is broken or half-finished, commit it to a clearly-named WIP branch and say so — do not leave main/develop in a state where tests fail.
2. **Confirm the test suite actually passes** for anything you're marking done. Don't rely on memory of it passing earlier — run it now.
3. **Update `docs/PROGRESS.md`:**
   - Check off `[x]` anything fully done (tests passing, meets the Definition of Done in `CLAUDE.md` Section 5).
   - Mark `[~]` for partial work, with a specific note on exactly what's left — not "almost done," but the actual next step (e.g. "webhook handler written, signature verification test still failing on the eSewa adapter — see line 42 of esewa.adapter.spec.ts").
   - Log any new deviations or open questions in the Known Deviations section.
   - Update the "Last updated" line with today's date and a one-line summary of the session.
4. **Write a short "Resume Point" note at the very top of `docs/PROGRESS.md`** — the one thing a completely fresh session needs to know before doing anything else. Include anything non-obvious: a flaky test to watch, a credential you're still waiting on, a design decision you made that isn't in the Plan yet.
5. **Do not leave anything ambiguous for future-you or a different agent to guess at.** If you're unsure whether something counts as done, mark it `[~]` and explain the uncertainty rather than guessing `[x]`.

Once all of that is done, summarize in one short paragraph: what got done this session, and what the very next task will be.
