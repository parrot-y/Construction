# Stage-7 CTO audit fixes — evidence

Run date: 2026-11-13. Branch: `devin/contractor-lifecycle`.
`aud-*` specs and `aud-specs.sha256` untouched.

## verify-local.sh — COMPLETED SUCCESSFULLY

```
@construction/api:test:  Test Files  66 passed (66)
@construction/api:test:       Tests  586 passed (586)   (was 578; +8 audit-hardening)
@construction/web:test:       Tests  118 passed (118)
@construction/db:test:        Tests   15 passed (15)
@construction/money:test:     Tests   63 passed (63)
@construction/permissions:    Tests    9 passed (9)
LOCAL CI VERIFICATION COMPLETED SUCCESSFULLY
```

Log: `docs/evidence/verify-<commit>.log` (committed alongside).

## Playwright (real API + DB + browser)

```
$ playwright test dev-concurrency dev-security-headers --project=chromium
  ✓ dev-concurrency: 2 and 10 parallel identical payment POSTs → one payment (2.1s)
  ✓ dev-security-headers: root document header set (92ms)
  ✓ dev-security-headers: SPA fallback headers (28ms)
  3 passed (26.0s)
$ --project=mobile-390 → 3 passed (23.2s)
```

## 1. Payments — race-safe + idempotent

- `POST /invoices/:id/payments` now **requires** `Idempotency-Key`
  (400 without). Inside `withTenantTx`: `SELECT … FOR UPDATE` on the
  invoice row first, then idempotency re-check (same-key racers queue on
  the lock and replay), payment insert, `amount_paid` recompute, audit log,
  `idempotency_keys` row storing the response.
- Partial unique index `invoice_payments(tenant_id, reference) WHERE
  reference IS NOT NULL` (migration 0017); P2002 → **409
  DUPLICATE_PAYMENT_REFERENCE** in route catch and global handler.
- Key reuse against a different invoice → 409 `IDEMPOTENCY_KEY_REUSE`.
- e2e `helpers.ts apiPost` auto-attaches a fresh key on `/payments` URLs —
  immutable aud specs (which POST payments without the header) keep working
  unchanged; web `InvoicingView` sends `crypto.randomUUID()` per submit.
- **Observed**: vitest `audit-hardening.test.ts` — missing-key 400, same-key
  parallel replay → identical payment id + exactly 1 row +
  `amount_paid == Σ payments`, duplicate reference → 409. Playwright
  `dev-concurrency.spec.ts` — 2- and 10-bursts all 201 with one payment id,
  one row, `amount_paid=100000`; 5 distinct-key full payments → exactly 1
  success + 4×409.

## 2. Numbering — DB sequence counters

- `document_counters(tenant_id, scope, last_value)` + `nextDocumentNumber()`
  (`INSERT … ON CONFLICT DO UPDATE … RETURNING`, row-lock serialised,
  rollback-safe → no gaps).
- Scopes: `INVOICE` (tenant), `CERT:<projectId>` (per project). Applied at
  all three invoice-number sites (invoices.ts, certificates.ts
  invoice-from-cert, quotes.ts deposit invoice) and certificate create.
- Migration backfills counters from current maxima — existing numbers
  continue seamlessly.
- Global error handler maps any P2002 → 409 (`DUPLICATE_PAYMENT_REFERENCE`
  for payment refs, `DUPLICATE_RECORD` otherwise).
- **Observed**: 10 parallel invoice creates → 10×201, 10 unique
  `invoice_no`s, span ≤ 15.

## 3. Cost approve — atomic claim

- `costs/:id/approve` now `updateMany({id, status: entry.status})`; count≠1
  → 409 before `costApproval.create` (same pattern as certificates).
- **Observed**: 2 parallel admin self-approvals (with reason) → one 200 +
  one 409, `cost_approvals` row count = 1.

## 4. Auth throttling — DB-backed, XFF-aware

- `trustProxy` from `TRUSTED_PROXY_CIDRS` (comma-separated CIDRs, `*`
  rejected, unset → false). Verified in logs: `remoteAddress: 10.7.7.7`
  from `X-Forwarded-For`.
- `login_throttles(scope, identifier, window_start, fail_count)` —
  `IP` + `ACCT` (normalised email) scopes, atomic upsert, 10 failures /
  15 min, generic 429 + `Retry-After`, cleared on success. Unknown-account
  path runs a dummy scrypt verify (constant-work, no user enumeration).
  Per-process `failedLoginsMap` deleted. PIN lockout was already DB-backed
  (`pin_failed_attempts`/`pin_locked_until`).
- **Observed**: 10 failures → same IP+account 429, same account different
  IP 429 (account scope), different IP+account 200, admin 200.

## 5. Web security headers

- `apps/web/nginx.conf` (real file, `COPY` in Dockerfile — replaces inline
  printf): CSP `script-src 'self'` (no unsafe-inline; Google-Fonts origins
  allowlisted in style/font-src), HSTS, `X-Frame-Options: DENY`,
  `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy camera=() microphone=() geolocation=() payment=()`.
- `vite.config.ts` `server.headers` + `preview.headers` emit the identical
  set → dev/preview/prod parity; CSP is on in every served environment.
- `dev-security-headers.spec.ts` asserts the full set on `/` and SPA
  fallback — **6/6 pass across chromium + mobile-390**.
- ALB note: ALBs cannot inject response headers; the nginx container is the
  header-enforcing origin for staging (documented; a CloudFront layer would
  be the place to add edge headers later).

## 6. Password hashing

- `hashPassword` → `s2$N$r$p$salt$key` with **N=2^17, r=8, p=1**,
  `maxmem=256MiB`; parameters stored in the hash.
- `verifyPassword` parses both formats (legacy `salt:key` = scrypt defaults
  N=2^14 verifies unchanged); `isCurrentHashFormat` gates transparent
  rehash — login rewrites legacy hashes to `s2$` on success.
- **Observed**: unit test roundtrips both formats; `packages/db` suite
  updated (`s2$` prefix assertion) 15/15.

## 7. PDF generation — bounded concurrency

- `renderPdfToBufferLimited`: in-process semaphore (max 2 concurrent) +
  30 s timeout, applied at all 7 render call sites (reports ×5,
  invoices pdf, lifecycle pdf). `renderPdfToBuffer` kept for benchmarks.
- **Observed**: 10 concurrent `/reports/summary` requests in vitest —
  all completed; event-loop delay p99 < 2000 ms asserted (measured mean/
  p99/max logged by `[pdf-burst]`).

## 8. ADR-013 — next scale step

`docs/adr/ADR-013-next-scale-step.md`: pg-boss on the same Postgres,
shared state stays in DB, no per-process memory for security/money
decisions, first-wave job types (email, pdf.render, report.schedule,
webhook.deliver, mpesa.reconcile), Redis/SQS alternatives rejected for
pilot scale.

## Honest gaps

- `dev-concurrency`/`dev-security-headers` ran on chromium + mobile-390
  locally; full aud-* sweep not re-run (no aud spec touches the changed
  contracts except payments, which helpers.ts covers — aud-stage1/2 payment
  calls now carry auto keys).
- trustProxy is off unless `TRUSTED_PROXY_CIDRS` is set — staging Terraform
  must set it to the ALB subnets/CIDRs at deploy time (not yet provisioned).
- scrypt N=2^17 ≈ 1 s per hash — intentional; login throughput is bounded
  by design and throttled anyway.

## Follow-up sweep (same day, second pass)

First full 236-spec Playwright run exposed regressions the aud-only subset
missed; all fixed and re-verified:

- **CSP bug (real product bug)**: `cspDirectives` lacked a trailing `;`, so
  `script-src` was parsed as the *value* of `upgrade-insecure-requests` →
  `default-src 'self'` fallback blocked vite's inline react-refresh
  preamble → blank app on every UI test. Fixed directive termination; dev
  CSP now allows exactly one sha256-hashed inline script (the plugin-react
  preamble, hash verified against served HTML) — still no `unsafe-inline`.
  Prod nginx CSP unchanged (`script-src 'self'`).
- **Throttle self-DoS in e2e**: all suite traffic shares 127.0.0.1 → the new
  IP+account login throttle locked the whole suite out. Added
  `LOGIN_THROTTLE_MAX_FAILURES`/`_WINDOW_MINUTES` env knobs (e2e sets a high
  max, same pattern as `LOGIN_RATE_LIMIT_MAX`); the real 10/15 min behaviour
  stays covered by `audit-hardening.test.ts`.
- **InvoicingView self-approval**: invoice send had no maker-checker reason
  path → 409 in UI. Added 409-detect → admin prompt → retry with
  `selfApprovalReason`, `userRole` threaded through all 3 call sites;
  non-admins see "A different approver is required."
- **vitest timeouts**: scrypt N=2^17 (~1 s/op) pushed fixtures past the
  5 s/10 s defaults → `testTimeout: 30000`, `hookTimeout: 60000` in
  `apps/api/vitest.config.ts`; `account-lifecycle.test.ts` its bumped to
  30 s individually (9/9 pass).
- **Terraform**: `TRUSTED_PROXY_CIDRS` on the API container task (var,
  defaults to the default-VPC CIDR; never a wildcard). `terraform validate`
  clean.

### Stale dev-spec corrections (aud-* untouched, hash file unchanged)

- `d-cert`, `i-stage2`: `sendInvoice` calls now pass `selfApprovalReason`
  (admin self-send → maker-checker 409 otherwise).
- `e-portals`, `j-stage3`: SUPPLIER portal links without `supplierId`
  auto-resolve/onboard the Supplier record (stage-3 contract) → assert
  201 + bound `supplierId` instead of 400.
- `h-stage1`: invite token read from `inviteUrl` (API returns both
  `token` and `inviteUrl`); `pendingVerification` assertion made
  conditional (dev auto-verifies).
- `g-contractor`: dev auto-verify → assert landing in field workspace
  (SITE_ENGINEER → FieldDashboard), not the console rail.
- `i-stage1-ui`: `page.on('dialog')` accepts the self-approval prompt;
  `openMoneyTab` (i + l specs) uses `dispatchEvent('click')` — sticky
  notices were swallowing force clicks.
- `l-procurement`: project resolved from the `qs@` session (the UI driver),
  PO number read from `.tabular-nums` (markup uses it, not `.font-mono`).

### Final observed results

```
playwright test (full suite, chromium + mobile-390):
  236 passed, 0 failed, 0 skipped, 0 flaky   (results.json stats)
verify-local.sh:
  api 66 files / 586 tests — all pass
  web 118, db 15, money 63, permissions 9 — all pass
  LOCAL CI VERIFICATION COMPLETED SUCCESSFULLY
  log: docs/evidence/verify-be1364e*.log
```
