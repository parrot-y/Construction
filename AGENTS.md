# AGENTS.md — Operating rules for this repo

## Workflow orchestration (always-on)

1. **Plan mode default** — for any non-trivial task (3+ steps or architectural decisions), write the plan to `tasks/todo.md` with checkable items BEFORE implementing. If something goes sideways, STOP and re-plan — do not keep pushing. Use plan mode for verification steps, not just building.
2. **Subagent strategy** — offload research/exploration/parallel analysis to subagents to keep main context clean. One task per subagent. Throw more compute at complex problems via subagents.
3. **Self-improvement loop** — after ANY correction from the user: append the pattern to `tasks/lessons.md` and write a rule that prevents the same mistake. Review `tasks/lessons.md` at session start for relevant entries. Iterate ruthlessly until mistake rate drops.
4. **Verification before done** — never mark a task complete without proving it works (tests, logs, demonstrated behaviour). Ask "would a staff engineer approve this?" Run lint/typecheck/tests/build per change scope.
5. **Demand elegance (balanced)** — for non-trivial changes ask "is there a more elegant way?" If a fix feels hacky, re-implement the elegant version. Skip for simple, obvious fixes — do not over-engineer.
6. **Autonomous bug fixing** — given a bug report, just fix it. Point at logs/errors/failing tests and resolve. Zero context switching.

## Task management

1. **Plan first**: write plan to `tasks/todo.md` with checkable items.
2. **Verify plan**: check in before implementation when the task is large or ambiguous.
3. **Track progress**: mark items complete as you go.
4. **Explain changes**: high-level summary at each step.
5. **Document results**: add a review section to `tasks/todo.md`.
6. **Capture lessons**: update `tasks/lessons.md` after corrections.

## Core principles

- **Simplicity first** — minimal code, minimal impact.
- **No laziness** — find root causes, no temporary fixes, senior-developer standards.
- **Minimal impact** — touch only what's necessary; avoid introducing bugs.
- **Honest coverage** — never claim a feature/module is "fully covered" unless every relevant surface was actually exercised. Distinguish OBSERVED / INFERRED / NOT REACHED.
- **Approval gates** — ask before: publishing, sending messages to real people, deleting data, spending money, changing live systems, or creating records in third-party accounts.
- **Secrets** — never store credentials, tokens, or personal data in files, commits, screenshots, or logs. Env vars at runtime only.

## Project context

- Product: unnamed Kenya-first construction-management SaaS (multi-tenant, KES-first, M-Pesa/eTIMS/WhatsApp/SMS roadmap).
- Stack: Turborepo · Fastify 5 · Prisma/PostgreSQL (RLS) · React 19 PWA.
- Status doc: `docs/PROJECT_STATUS.md`. Scope: `docs/MVP_SCOPE.md` + `docs/PRD.md`.
- Competitor research: `docs/research/console-audit/` (numbered findings docs; raw captures stay LOCAL only — never recommit).
- Verification: `scripts/verify-local.sh` (turbo lint/typecheck/test/build — evidence pinned in `docs/evidence/`).
- Database: real Prisma migrations in `packages/db/prisma/migrations/` (0001 baseline, 0002 RLS policies). Deploy = `prisma migrate deploy` as `db_migrator`, then `psql -f packages/db/prisma/rls.sql` (idempotent re-enforcement). Never `db push` against shared/prod DBs. `users`/`tenants` are documented RLS exceptions (identity resolution precedes tenant context — see rls.sql header).
