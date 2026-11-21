# Stage-2 Client & Owner — Acceptance Spec Evidence

Spec: `e2e/tests/i-stage2-client-owner.spec.ts` (authored from the stage-2
requirements — the auditor spec file was not delivered; contract block maps to
real routes, asserted behaviour unchanged).
Environment: real Fastify API + PostgreSQL (RLS, `db_app` non-superuser) + real
React UI via Playwright. E2E DB: `construction_e2e` on disposable cluster
localhost:54329; API :4199, web :5180.

## Result — OBSERVED
- `i-stage2-client-owner.spec.ts`: **9/9 passed on chromium, 9/9 on mobile-390**
  (18/18 total, ~60s for both projects combined with stage-3).
- Focused API vitest after contract updates: external-portals 13/13,
  portal-hardening 14/14, m9-client-portal 13/13, operations-e2e 15/15,
  route-guard 8/8 — all green.
- Full API vitest suite: **61 files / 558 tests** — the only failures in the
  final full run were `route-guard` (new routes missing from the authz maps,
  fixed) and `m10-backup-restore` (missing `construction_test` DB on the
  disposable cluster, provisioned per `scripts/verify-local.sh` steps 2–6;
  re-run 4/4 green).

## Per-requirement coverage (all OBSERVED)
1. **Diary privacy** — CLIENT/OWNER receive a client-safe DTO from
   `GET /projects/:id/site-diaries` and `/:id`: internal notes stripped,
   non-client-visible photos excluded, direct `/uploads/...` URLs for hidden
   photos rejected. Staff DTO unchanged.
2. **Retention** — `PATCH /api/v1/company/settings` stores tenant
   `retention_terms`; `GET /projects/:id/client-portal` returns them (canonical
   snake_case normalisation for camelCase or snake_case stored JSON, standard
   Kenyan schedule only as a disclosed fallback). ClientDashboard renders the
   tenant values; remaining fallbacks render "Not specified by contractor" —
   no hard-coded percentages.
3. **FX** — `GET /api/v1/fx-rates` returns manual reference rates with `asOf`
   and `source`; UI shows "Rates as of <date> (source)".
4. **Client invoices** — `GET /api/v1/me/invoices` aggregates the caller's
   invoices with balances, payment history, payment notices and tenant
   `payment_instructions` (paybill/till/bank) inside the data payload;
   ClientDashboard renders them.
5. **Payment notice** — `POST /api/v1/client/invoices/:id/payment-notice`
   (amount/method/reference/note) notifies the contractor inbox, never mutates
   the invoice; notice flips to confirmed only when staff record the payment.
6. **Approvals** — `GET /api/v1/me/approvals` feeds a "Waiting for you" card on
   ClientDashboard and the new read-mostly OwnerDashboard.
7. **Owner screen** — `OwnerDashboard.tsx`: project summary, approvals,
   certificates, invoices, progress, shared photos; no contractor actions.
   OWNER blocked from certificate create/certify (403, OBSERVED).
8. **Project requests** — `POST/GET /api/v1/client/project-requests` persists
   requests that surface in the contractor inbox AND the staff list.
9. **Stage-1 carry-overs** — shipped in `4c5c8b5` (password reset +
   admin-assisted reset, verification gate, invite role limits, existing-account
   re-auth, font-mono 454→450); re-verified green in this run's affected specs.

## Not finished / honest gaps
- Stage-2 web coverage is API-contract deep but UI-click coverage exists only
  for the client dashboard happy path (invoices, instructions, approvals,
  390px no-h-scroll). Owner dashboard has no dedicated click test yet.
- FX rates are manual reference entries (dated + sourced), not a live provider
  feed — labelled as such.
- `verify-local.sh` full 6/6 turbo run pending on the final tree (focused
  suites + both Playwright specs are green; lint/typecheck clean on touched
  packages).
