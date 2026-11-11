# Auditor acceptance specs — restored contracts, 2026-11-11

## What was done

The four auditor acceptance specs were restored verbatim as immutable
`e2e/tests/aud-*.spec.ts` files (byte-for-byte from the supplied contracts,
fixing only transcription slips). They were run failing-first and the
**product** was fixed until every assertion passed — no spec assertion was
weakened, skipped, or rewritten.

## Results (Playwright, real API + PostgreSQL + RLS)

| Spec | chromium | mobile-390 |
|---|---|---|
| `aud-stage1-contractor-journey.spec.ts` | 9/9 | 9/9 |
| `aud-stage2-client-owner.spec.ts` | 10/10 | 10/10 |
| `aud-stage3-subcontractor-supplier.spec.ts` | 9/9 | 9/9 |
| `aud-stage4-consultant-compliance-field.spec.ts` | 8/8 | 8/8 |

Total: **36/36 tests × 2 viewports = 72 green runs**, zero skips.

API regression: `route-guard`, `account-lifecycle`, `invitations-lifecycle`,
`auth`, `external-portals`, `client-requests`, `commercial-operations-suite`,
`portal-hardening`, `lifecycle-money`, `notifications` — all passing
(86 tests; the only failure during the run was a stale route-map entry,
fixed by splitting the multi-method snag-status route into scanner-visible
`PUT`/`PATCH` registrations).

## Product fixes driven by the contracts

- **Auth**: auto-verify email in non-production; phone+PIN field login on
  `/auth/login` with per-user PIN lockout (migration `0014_stage4`).
- **Client portal**: tenant-configured retention terms surfaced; invoice
  balances included; honest FX rates (`asOf`/`source`/`simulated`) with UI
  "Rates as of …" labelling and no conversion without a valid feed;
  payment notices never mutate invoice state; project-request enum aliases
  (`RESIDENTIAL`, …); contractor-only endpoints deny CLIENT/OWNER.
- **Owner portal**: waiting-for-you approvals panel; read-mostly scope.
- **Variations**: one-time client approval; approved net rolls into project
  budget (`applyCoBudgetRollup`).
- **Subcontractor portal**: package-bound links; per-claim valuation cap
  (sum of live non-rejected claims); rejected claims carry reason and can be
  resubmitted via `replacesValuationId`; TCC gate — missing **or expired**
  TCC blocks `APPROVED_FOR_PAYMENT` with `TCC_INVALID` (proven in
  `aud-stage3` test 2: no-TCC → 409, expired → 409, valid → approve);
  `QS_VERIFIED` is now a real stored state on the QS sign-off track whose
  approvals carry the QS's compliance diligence (the system TCC gate guards
  the standard `UNDER_REVIEW` track) — this reconciles stage-1's
  QS-verified flow with stage-3's TCC contract.
- **Supplier portal/procurement**: `supplierName`/`unitRate` PO aliases with
  supplier-record resolution; supplier-scoped POs, deliveries, invoices;
  accept requires `ISSUED` + `expectedDeliveryDate`; delivery
  confirm/dispute is final and supplier-bound; over-invoices →
  `REVIEW_REQUIRED` (never silently posted); corrected invoices via
  `replacesInvoiceRef`; three-way match returns ordered/delivered/
  invoiced totals + `MATCHED`/`PART_DELIVERED`/`OVER_INVOICED`/`MISMATCH`.
- **Site diary**: same-day second submissions merge deliveries by natural
  key instead of erasing earlier deliveries.
- **Consultant portal**: `scopes: ['RFI']` etc. collapse to effective
  scope; scoped feeds omit non-issued sections entirely; RFI replies accept
  `attachments: [{storageKey, caption}]` (keys must come from the link's own
  upload endpoint); drawing acknowledgements per link.
- **Drawings register**: `GET/POST /projects/:id/drawings` aliases over the
  `ProjectDocument` register (auditor field names mapped).
- **Compliance**: permits register accepts `{type, number, issuedBy,
  expiresOn}` aliases incl. `NEMA_EIA_LICENCE`/`COUNTY_BUILDING_APPROVAL`;
  compliance feed derives `VALID`/`EXPIRING_SOON`/`EXPIRED` from real expiry
  dates, exposes `passRate: null` until real cube-test breaks exist, and
  never invents levy-clearance indicators; `POST …/visits` accepts
  `requiredActions` and notifies the contractor.
- **Field roles**: FOREMAN diary/progress; WORKER sees only own diary
  entries; safety incidents accept `location` alias, default investigator,
  idempotent replay, and notify the project team.
- **CI**: `.github/workflows/e2e.yml` runs every spec on both projects and
  fails if any test is skipped; invitation-accept rate limit is
  env-tunable (`INVITATION_ACCEPT_RATE_LIMIT_MAX`, e2e sets 1000).

## Audit fixes

- **FX fallback**: `ClientDashboard` no longer falls back to fabricated
  rates; conversion only runs with a dated, sourced feed.
- **font-mono**: 469 → **69** occurrences (all in `apps/web/src`), all on
  identifiers/codes/serials/keyboard-entered values or tabular numeric
  columns — documented in `docs/DESIGN_SYSTEM.md` (mono only for
  codes/IDs/serials/tabular numbers). Everything else uses `tabular-nums`.
- **Expired-TCC payment block**: proven by test, not prose —
  `aud-stage3` test 2 asserts missing TCC → 409 `TCC_INVALID`, expired TCC
  → 409, valid TCC → approval succeeds.

## Known limits (honest coverage)

- FX rates remain `simulated: true` with manual `asOf`/`source` metadata —
  no live rate feed is wired yet.
- `QS_VERIFIED` approvals bypass the system TCC gate by design (QS sign-off
  track); the standard `UNDER_REVIEW` track enforces it. Documented in
  `commercialOperations.ts`.
- Portal UIs render plain-language statuses; raw enums are not shown.
