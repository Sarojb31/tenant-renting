We're resuming work on the RoomFinder SaaS project after a pause. This is a fresh session with no memory of what happened before — treat everything below as mandatory, not optional context-gathering:

1. **Read `docs/PROGRESS.md` in full**, especially the "Resume Point" note at the top — that's exactly where the last session left off and what it wants you to know first.
2. **Don't just trust the checklist — verify it.** Run the test suite and confirm what's actually passing matches what `PROGRESS.md` claims is done. If there's a mismatch between the file and reality, stop and flag it before writing any new code — this is exactly the kind of drift `CLAUDE.md` Section 6 exists to catch, and it's cheaper to catch now than after building more on top of a false assumption.
3. **Check `git log` and `git status`** for anything uncommitted, or committed to a WIP branch, from the last session. Resolve or explicitly carry forward anything left unfinished there.
4. **Re-skim `CLAUDE.md`.** The rules haven't changed, but a fresh reminder costs nothing and is cheaper than a drifted assumption three tasks from now.
5. **Check the "Known Deviations / Open Questions" log in `PROGRESS.md`.** If anything there is unresolved, resolve it or explicitly re-raise it with me before building further on top of it.
6. **Continue from the exact next unchecked item** in `PROGRESS.md`'s build order. Don't redo work already marked `[x]` and verified, and don't skip ahead of anything still `[ ]` or `[~]` above it.

Once you've done all of the above, tell me what you found (does the file match reality?) and what you're picking up next — then continue.
