# Skill: test-strategy

## When to use
Every milestone. Defines what "tested" means before code is written.

## Test pyramid for this codebase
- **Unit** (`packages/*`): money math, validation schemas, permission logic. Fast, no DB.
- **Integration** (`apps/api`): route → service → real Postgres with RLS as `db_app` (non-superuser). Covers auth, tenancy isolation, workflows, audit log.
- **E2E/simulation**: the 24-step live-site simulation pattern — contiguous real-world operations through the whole loop.
- **Web unit** (`apps/web`): component behaviour with vitest.

## Mandatory test types
1. **Tenant-isolation tests**: cross-tenant read AND write rejected, run as app role.
2. **Permission tests**: each route × each role → allowed or 403.
3. **Money tests**: rounding (half-up), precision (4dp qty/rate, 2dp amount), currency.
4. **Callback/webhook tests**: duplicate, out-of-order, wrong-tenant, bad signature.
5. **Immutability tests**: UPDATE/DELETE on ledger/audit rejected at DB level.
6. **Backup/restore test**: dump → restore → verify schema, RLS, data survive.

## Acceptance criteria format
Given / When / Then, one behaviour per criterion, observable without reading source.

## Checklist
- [ ] New behaviour has a failing test first (or documented why not)
- [ ] Isolation + permission tests cover every new route
- [ ] Financial paths tested for rounding and immutability
- [ ] CI green before milestone is "done"
- [ ] Evidence recorded: test file names + counts in milestone report

## Common mistakes
- Tests that run as DB owner (RLS bypassed silently).
- Asserting on UI text instead of behaviour.
- Skipping the "second run" — idempotency only shows on retry.
