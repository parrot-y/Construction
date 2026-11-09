# Phase 5 — Audit summary for re-review

Branch: `devin/audit-remediation` (base `devin/gate1-2-research-and-design`).

| Phase | PR / commits | Evidence | Unfinished |
|---|---|---|---|
| 1 Security & data safety | `a55318b`, `ffacfe4`, `fc6273e` | `docs/evidence/phase-1-security.md`, `route-authz-matrix.md`, `verify-*.log` | None known |
| 2 Design system | partial (tokens, `ui/` kit, `formatKes`) | `docs/DESIGN_SYSTEM.md` | Full legacy-view migration; landing stats sweep |
| 3 Real portals & wiring | `74e1666`, `5ba011c`, `96bc970` | `docs/evidence/phase-3-portals.md`, web suite 118/118 | Peripheral components retain dev-only fixture defaults (flag-gated) |
| 4 Workflow proof | `2ee5cab` | `docs/evidence/phase-4-e2e.md`, `e2e/playwright-report/`, CI `e2e.yml` | IndexedDB offline queue not browser-driven; expired-token case asserts validate endpoint |
| 5 Reporting | this commit | `docs/PROJECT_STATUS.md`, `docs/evidence/visual/*.png` (18 shots) | — |

## Commands run (real output)
- `pnpm --filter @construction/web vitest run` → `Tests 118 passed (118)`
- `cd e2e && pnpm exec playwright test` → `9 passed` ×2 projects (chromium, mobile-390) = 18/18
- `scripts/verify-local.sh` → green on prior heads; re-run pending on final head
- Typecheck: `tsc --noEmit` clean in `apps/web`, `apps/api`, `e2e`

## Honest unfinished list
1. Phase 2 is partial — the design system exists and new surfaces use it, but not every legacy view has been migrated; an exhaustive mono/uppercase/emoji sweep has not been re-run since the console rebuild.
2. E2E expired-token coverage asserts the validate endpoint contract rather than waiting 30 days — expiry logic itself is `expires_at < now()` in `resolvePortalLink`, covered by unit tests.
3. Tenant isolation e2e uses membership/RLS denial on nonexistent and non-member projects; a second fully-seeded tenant would make it airtight.
4. All external integrations remain SIMULATED until provider keys are supplied.
