# Phase 4 — Playwright workflow proof (real API + real DB)

## Setup
- New workspace package `e2e/` (`@construction/e2e`) with `@playwright/test`.
- `e2e/playwright.config.ts` starts the real Fastify API (`apps/api`, port 4199)
  and the real Vite web app (port 5180) via `webServer`; global setup runs
  `prisma migrate deploy` + `rls.sql` + `prisma/seed` against a dedicated
  `construction_e2e` database — no `page.route('**/api/**')` stubs anywhere.
- Runtime DB role is `db_app` (non-superuser, RLS enforced) — verified by the
  API's own security guard at boot.
- Traces/videos retained on failure; HTML + JSON reports published as CI
  artifacts (`.github/workflows/e2e.yml`).

## Coverage
| Workflow | Spec | Result |
|---|---|---|
| A. Quote → send → public link (real browser) → accept → convert → project + deposit invoice linked → invalid token rejected | `a-quote-to-cash.spec.ts` | PASS |
| B. Diary entry with Idempotency-Key replayed → exactly one record | `b-diary-sync.spec.ts` | PASS |
| C. Variation raised → submitted → internal review → OWNER_REVIEW → client approves via portal token → approved-variations total increases | `c-variation.spec.ts` | PASS |
| D. Payment certificate → action chain → retention computed → invoice created → sent → payment recorded → retention query | `d-certificate-payment.spec.ts` | PASS |
| E. Consultant (valid token render + RFI reply + invalid token), Supplier (valid + invalid), Subcontractor & Compliance (valid + invalid) | `e-portals.spec.ts` | PASS |
| F. Role-restricted actions 403, unauthenticated 401, cross-project/bogus project returns no rows | `f-authorization.spec.ts` | PASS |

## Evidence
Command:
```
cd e2e && E2E_DATABASE_URL=... E2E_MIGRATOR_DATABASE_URL=... pnpm exec playwright test
```
Output (chromium): `9 passed (30.8s)`; mobile-390 project: `9 passed (30.7s)`.
Traces: `e2e/test-results/*/trace.zip` (retained on failure); report:
`e2e/playwright-report/`.

## Honest gaps
- Workflow B tests idempotency at the API layer (the exact mechanism the
  offline queue uses); the IndexedDB queue UI itself is not driven in a
  browser.
- Workflow E covers valid/invalid tokens for all four token portals plus one
  real action each where the API supports it (consultant RFI reply); the
  "expired token" case asserts the validate endpoint shape — expiry is
  enforced by `expires_at` comparison in `resolvePortalLink`.
- Tenant-B isolation is proven via membership/RLS (bogus + non-member
  project → 403/404/empty), not a second seeded tenant.
