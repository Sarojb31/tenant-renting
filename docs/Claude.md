# AGENTS.md — Development Guardrails for AI Coding Agents

## Purpose

This file is the standing operating instructions for any AI coding agent (Claude Code, Cursor, or similar) working on the RoomFinder SaaS codebase. It exists to prevent architecture drift, scope creep, and unreviewed deviations from **`room-finder-saas-product-document.md`** (referred to below as "the Plan"), which remains the single source of truth for product scope, data model, and technical architecture.

**Before writing any code**, read the section of the Plan that covers your current task. If anything in this file conflicts with the Plan, the Plan wins — flag the conflict instead of silently resolving it.

---

## 1. Non-Negotiables — never violate these without explicit human approval

- **Tech stack lock (Plan Section 7):** Backend is NestJS, frontend is React (Vite, PWA), database is PostgreSQL, queue/cache is Redis. Do not introduce a different framework, ORM, database engine, or major library that isn't already listed — even if it looks like a better fit for the task in front of you. Propose it and wait for approval instead of substituting it yourself.
- **Multi-tenancy (Plan Section 17):** every tenant-scoped table and query must be filtered through the tenant-context mechanism. Any new entity that touches tenant data ships with a cross-tenant-leakage test, or it is not done.
- **Schema changes go through migrations only** (Plan Section 12). Never hand-edit the database directly, and never generate a migration without updating the schema section of the Plan to match.
- **Security baseline (Plan Section 19):** no disabling DTO validation, no plaintext secrets, no webhook handler without signature verification, no bypassing auth guards "temporarily for testing."
- **Payment/SMS adapters stay behind their interfaces (Plan Section 16).** Never call a gateway SDK directly from business logic — always go through `SmsProvider` / `PaymentProvider`.
- **No task is complete without tests (Plan Section 20).** A new endpoint ships with an integration test; a new service/adapter ships with a unit test; a new tenant-scoped entity ships with a cross-tenant-isolation test; a new critical UI flow ships with at least a component test. "I'll add tests after" is not an acceptable state to hand back — see Section 7 for how this is enforced deterministically, not just requested.

## 2. Build in Plan Order — don't get ahead of the roadmap

- Follow the phase order in Plan Section 9 / Section 23. Do not implement Phase 3/4 features (WhatsApp, AI matching, Facebook Page integration, native apps, etc.) while Phase 1 (MVP) modules are incomplete.
- Within Phase 1, follow the build order in Section 23, step 5: **Tenants/Auth → Listings → Customers/Preferences → Matching Engine → SMS adapter → Payments → Customer PWA → Admin dashboard.** Don't jump ahead to a later module because it's more interesting or looks easier.
- If reordering seems justified, say so explicitly and wait for confirmation — don't just start building out of order.

## 3. Module & Folder Boundaries

- Match the NestJS module tree in Plan Section 13 and the frontend monorepo structure in Plan Section 15. New business logic belongs inside its matching module folder — not scattered into `common/`, and not a new ad hoc top-level folder.
- One responsibility per module. If a task doesn't obviously fit an existing module, ask where it should live rather than inventing a new one unilaterally.

## 4. When Blocked or Ambiguous

- Stop and ask a specific question rather than guessing or inventing new architecture to fill a gap.
- Never silently swap a chosen technology or pattern because "it was easier" — that is exactly the kind of drift this file exists to prevent.
- If the Plan itself seems wrong or incomplete for the task at hand, say so explicitly, cite the section, and propose the change. Don't quietly implement a workaround and move on as if nothing changed.

## 5. Definition of Done for Any Task

Every completed task/PR should be able to answer, unprompted:

- Which section(s) of the Plan does this implement? (cite them)
- What tests were added, and do they cover the tenant-isolation requirement if applicable (Section 17)?
- Does this introduce any new dependency, service, or pattern not already in Section 7 / 13 / 15 / 16? If yes, was it approved first?
- What was explicitly deferred, and to which phase?

For anything tagged as MVP work, it isn't "done" until it satisfies the relevant line item in the Plan's Section 22 (Definition of Done).

**Additionally: update `docs/PROGRESS.md` at the end of every task** — check off what's done, note what tests were added, log any deviation. Sessions don't carry memory forward; if it isn't written there, the next session (yours or a different agent's) has no way to know it happened.

## 6. Human Check-In Queries

Paste any of these back to the agent periodically — especially right after it reports a task as "finished" — to verify it hasn't drifted from the Plan:

1. "Which section of `room-finder-saas-product-document.md` does this change implement? Quote the relevant part."
2. "Show me the tenant-isolation test for the entity or endpoint you just added."
3. "Have you introduced any dependency, library, or service not listed in Section 7? If yes, which, and why?"
4. "What phase are we in per Section 9, and does everything you just built belong to that phase?"
5. "Walk me through how this endpoint enforces tenant scoping, referencing Section 17."
6. "List anything you deferred, skipped, or simplified from the spec, and explain why."
7. "Did you touch the database schema? If so, show me the migration and the corresponding update to Section 12."
8. "Did you call any payment or SMS gateway SDK directly, or did you go through the adapter interfaces in Section 16?"
9. "Open `docs/PROGRESS.md` — does it accurately reflect what you just did, including any tests added and any deviations?"

If an answer doesn't hold up, stop and correct course before continuing — don't let a second task build on top of an unverified first one.

## 7. Enforcing Tests Deterministically — Don't Just Ask, Configure a Hook

Instructions in this file (or `CLAUDE.md`) are things the agent *should* follow, but nothing stops it from occasionally skipping a test under time pressure or forgetting once a task feels "done." **Claude Code hooks are different: they're shell commands the harness runs automatically at specific lifecycle events, and the agent can't skip them.** This is the actual mechanism for "forcing" testing, not just requesting it.

Add both of these to `.claude/settings.json` (checked into the repo so every session, human or agent, gets the same gate):

**Fast feedback while editing** — run only the tests related to the file just touched:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "path=$(jq -r '.tool_input.file_path'); case \"$path\" in apps/backend/*.ts) npx jest --findRelatedTests \"$path\" --passWithNoTests ;; apps/customer-web/*.tsx|apps/admin-console/*.tsx) npx vitest related \"$path\" --run ;; esac"
          }
        ]
      }
    ]
  }
}
```

**Full gate before a task is considered finished** — run the whole relevant suite and feed failures back to Claude before it stops:
```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "cd apps/backend && npm test --silent" },
          { "type": "command", "command": "cd apps/customer-web && npm run test --silent" },
          { "type": "command", "command": "cd apps/admin-console && npm run test --silent" }
        ]
      }
    ]
  }
}
```

Notes:
- Exact exit-code behavior and hook syntax can shift between Claude Code versions — check `/hooks` inside a live session and the current docs at `code.claude.com/docs/en/hooks-guide` before relying on this verbatim; treat the JSON above as a starting point, not a guarantee.
- Keep `PostToolUse` hooks scoped to related tests only (not the full suite) so they stay fast — full-suite runs belong on the `Stop` hook.
- This is a repo-level `settings.json`, so it applies to every contributor and every agent session equally — nobody can quietly turn it off for one task.

## 8. Parallel Frontend/Backend Development

The monorepo split in Plan Section 15 (`apps/backend`, `apps/customer-web`, `apps/admin-console`) is intentionally structured so backend and frontend work can run at the same time without one blocking the other. Claude Code supports this natively through **git worktrees** — isolated checkouts that give each session its own directory and branch, so two agents editing at the same time never overwrite each other's files.

**How to run it:**
```bash
# Terminal 1 — backend agent, isolated checkout on its own branch
claude --worktree backend-listings

# Terminal 2 — frontend agent, isolated checkout on its own branch
claude --worktree frontend-listings
```
Or, from a single orchestrating session, dispatch each as a subagent with `isolation: worktree` in its definition so Claude manages the worktrees for you instead of you running separate terminals.

**This only works safely if the contract is agreed first:**
1. Before either agent starts, lock the API contract for the feature — DTO shapes, endpoint paths, status codes — either via NestJS's Swagger/OpenAPI output or a shared `packages/api-client` types file (Plan Section 15). Whichever agent gets there first should not be improvising the contract alone.
2. The frontend agent builds against a mock of that contract (MSW — Mock Service Worker — intercepting requests in dev/test) rather than waiting for the real endpoint to exist.
3. The backend agent implements the real endpoint to the same contract, independently.
4. **Merge and run an integration pass before calling the feature done.** Worktrees prevent file collisions, but they do *not* prevent the two agents from interpreting the same contract differently (e.g. one assumes a field is optional, the other assumes it's required). That's a logical conflict, not a file conflict, and only a real integration test run against both sides together will catch it — don't skip this step just because both worktrees individually reported passing tests.

Use the Human Check-In Queries (Section 6) on *each* worktree separately before merging, plus one more afterward: *"Run the full integration suite against the merged branch and report any contract mismatches between the frontend and backend changes."*

## 9. Pausing and Resuming Work

Agent sessions don't carry memory forward — stopping for the day and picking back up tomorrow is a fresh session with nothing but `docs/PROGRESS.md`, git history, and this file to go on. Two companion prompts handle the two ends of that gap:

- **`PAUSE_PROMPT.md`** — run this before ending a session. It forces the agent to commit or clearly flag WIP, confirm tests actually pass (not just recall that they did), update `PROGRESS.md` with a specific "Resume Point" note, and never leave something ambiguous for the next session to guess at.
- **`RESUME_PROMPT.md`** — run this at the start of the next session. It forces the agent to read the Resume Point, **verify** the checklist against actual test runs and git state rather than trusting the file blindly, re-skim `CLAUDE.md`, and resolve or re-raise anything left open — before touching any new code.

The verification step in `RESUME_PROMPT.md` matters more than it looks: a stale or slightly wrong `PROGRESS.md` entry is a normal, low-stakes mistake if it's caught immediately at the start of the next session. It becomes an expensive mistake if three more tasks get built on top of it first.

## 10. When the Plan Document Itself Changes Mid-Project

The Plan (`docs/room-finder-saas-product-document.md`) isn't static — it gets revised after real development has already happened (new scope, or a clarification closing a gap in something already built). That's a different situation from a normal resume: it's not "pick up where you left off," it's "some of what you already built may now be incomplete, ambiguous, or need a migration."

**`PLAN_UPDATE_PROMPT.md`** — run this whenever the Plan has been revised since the agent last worked from it. It forces the agent to identify what specifically changed, classify each change against what `PROGRESS.md` already marks as built (unaffected / needs rework / was ambiguous-now-clarified / entirely new), and — critically — **report back and wait for a priority decision before writing code**, rather than guessing which change to tackle first or silently rewriting already-tested work.

This is not a substitute for `RESUME_PROMPT.md` — use `RESUME_PROMPT.md` at the start of every session as usual, and layer `PLAN_UPDATE_PROMPT.md` on top specifically when picking up a session after the Plan changed.

## 11. Where to Place This File

- **Using Claude Code:** save a copy as `CLAUDE.md` at the repository root — it loads automatically at the start of every session.
- **Using another agent** (Cursor, Codex-style tools, etc.): most respect `AGENTS.md` at the repo root by the same convention — keep this filename there.
- Either way, keep `room-finder-saas-product-document.md` inside the repo (e.g. `/docs/`) so the agent can actually open and cite it. A guardrail file that references a document the agent can't reach is not useful.
