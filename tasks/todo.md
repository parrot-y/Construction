# tasks/todo.md — active plan

## Current: Round H (checklist 14/15 review, 28–32)

Rules: aud-* specs + sha256 immutable; tests first with RED RUN COMMITTED;
one item = one commit `H<n>: <what>`; evidence log named for final sha.

### H1 — one source of truth for retention money
- [ ] Decide: retention release pre-fills/locks `retention_released` on next
      payment certificate OR creates a retention-release invoice/credit line.
      Write choice in docs/decisions-needed.md.
- [ ] Remove the other typed path (or make read-only); ledger must never
      double-count (held already net of cert-level releases vs DLC releases).
- [ ] Test: PC half release → payment certificate → final release; reconcile
      held/released/outstanding to the cent; invoice/cert shows release once.
      Decimal edge values (half-cent splits).

### H2 — subcontractor retention request → paid
- [ ] E2E: PENDING_QS_REVIEW → QS recommends → director approves
      (maker-checker, requester cannot self-approve, admin override needs
      15-char reason) → payout recorded once with reference → portal shows
      PAID → package retention held falls → ledger reconciles → second
      request for same moiety refused.
- [ ] Console screen where QS reviews it, verified at 390px.

### H3 — retention rate + cap per project
- [ ] Project settings: retentionRatePct + retentionCapPct (default 5%),
      editable by admin/PM_QS before first certificate, audit-logged.
- [ ] Remove every hard-coded 5%/50% in retention path (certificates.ts
      preview math too); list each in PR.
- [ ] 10% project through certificate → invoice → release.

### H4 — wording/layout at 390px (auditor visual review)
- [ ] "Welcome,S6 CONSULTANT" missing space.
- [ ] Scope-derived "What you can do here" bullets (consultant: verify snags;
      client: practical completion + snags).
- [ ] Client portal: closeout card first, above empty change-orders.
- [ ] Subcontractor valuation table clipped — stacked cards or scroll shadow.
- [ ] Dead "Back to Project/Dashboard" buttons on link portals — remove or
      point to portal top.
- [ ] Consultant tab bar clips "Snag Verification (1)" — wrap or scroll cue.

### H5 — remaining portal screenshot journeys
- [ ] supplier (accept PO, confirm delivery, submit invoice), compliance
      (permit, visit), field roles (today's work, diary, offline incident +
      sync), owner (approve variation, dashboard), public quote (view,
      accept, deposit invoice).
- [ ] Clean seeded demo tenant, realistic names; chromium + mobile-390;
      docs/evidence/visual/<final-sha>/portal-flows/.

### H6 — PR pointers
- [ ] 1962c01 held-payment resolve screen + 0bf3592 clean-demo capture:
      exact files/tests + what each proves.

### Verify
- [ ] verify-local.sh on final commit; full Playwright matrix; evidence.

## H5 detail plan (2026-11-15)

Product gaps found while mapping journeys — fix inside H5:
- [ ] CompliancePortalView: `statutoryPermits` state never populated (permits
      table permanently empty) — wire `d.permits`; add VALID/EXPIRING_SOON/
      EXPIRED badge cases; add Site visits card (list `d.visits`) + Record
      visit form → POST /portals/compliance/:token/visits.
- [ ] OwnerDashboard: OWNER holds VARIATION_REVIEW+VARIATION_APPROVE but has
      no UI — embed VariationManagementView card (canApprove/canReview).

Spec: e2e/tests/h5-portal-journeys.spec.ts — dedicated demo tenant
(Nyota Construction Ltd, same provisioning pattern as capture-visual.mjs),
fixed realistic identities, fresh per-run fixtures (no timestamped names).
Journeys: supplier PO accept→delivery confirm→invoice; compliance permit +
record visit; field foreman today→diary→offline incident→sync; owner
dashboard→approve CO; public quote view→accept→deposit invoice via client
portal. Screenshots → docs/evidence/visual/<sha>/portal-flows/.

## H5 progress

- [x] CompliancePortalView: permits wired from `d.permits` (was permanently
      empty state), VALID/EXPIRING_SOON/EXPIRED badges, visits card +
      record-visit form → POST /portals/compliance/:token/visits.
- [x] OwnerDashboard: embedded VariationManagementView (canApprove/canReview)
      so OWNER can decide pending change orders — OWNER holds
      VARIATION_REVIEW+APPROVE but had no UI surface.
- [x] FieldDashboard: mounted OfflineSyncBanner (field roles had NO sync
      flush — queued mutations would never replay) AND fixed permission
      check bug: can() compared enum KEYS ('SITE_DIARY_CREATE') instead of
      VALUES ('site.diary_create') — 'Record diary' never rendered for
      FOREMAN/WORKER/SITE_ENGINEER/TRADE_LEAD.
- [x] e2e/tests/h5-portal-journeys.spec.ts — 6 tests × 2 viewports, all
      green (12/12). Dedicated Nyota tenant, fresh fixtures per run.
      Journeys: supplier PO accept→delivery confirm→invoice; compliance
      permits+visit; foreman diary+offline incident→exactly-once sync;
      owner CO approve; public quote accept→deposit invoice.

## H5 result (commit 473341a + spec fix)

- [x] h5-portal-journeys.spec.ts: 6 tests × chromium + mobile-390 = 12/12 green.
      Journeys: supplier PO accept→delivery confirm→invoice; compliance
      permits+record visit; foreman diary+offline incident→exactly-once sync;
      owner dashboard→approve CO; public quote view→accept→deposit invoice.
- [x] Product gaps fixed: CompliancePortalView permits/visits wiring,
      OwnerDashboard VariationManagementView embed, FieldDashboard
      OfflineSyncBanner + permission-value bug (enum key vs value),
      mobile search icon fix carried from H4.
- [x] Evidence: docs/evidence/visual/473341a/portal-flows/ (15 PNGs).
- [x] Regression: b-diary-sync.spec.ts green; web+api typecheck clean.

## H6 — review pointers (checklist 14/15)

### 1962c01 — held provider-payment resolve screen (G1)

Backend (`apps/api/src/routes/payments.ts`):
- L370 `GET /api/v1/payments/charges/review` — NEEDS_REVIEW charges not yet
  resolved; money-approval roles only.
- L407 `POST /api/v1/payments/charges/:id/resolve` — single-use resolve:
  APPLY (row-locked post to another same-tenant invoice + payment
  transaction), REFUNDED (≥15-char note + refund reference), KEEP (flagged).
  Second attempt → 409; cross-tenant → 404 via RLS. All audit-logged.
- Migration: `packages/db/prisma/migrations/0020_provider_charge_resolution/`.

Tests — `apps/api/src/payment-charge-review.test.ts` (6 tests):
1. lists NEEDS_REVIEW charges with invoice no/amount/reference/reason.
2. REFUNDED requires note+reference; resolves once (second → 409).
3. APPLY posts held amount to another invoice exactly once under
   concurrent resolve clicks (row lock).
4. APPLY rejects amount exceeding target invoice balance.
5. KEEP marks reviewed while flagged; second attempt 409s.
6. Cross-tenant charge invisible/unresolvable (404).

Frontend:
- `apps/web/src/components/PaymentReviewPanel.tsx` — APPLY/REFUNDED/KEEP UI.
- `apps/web/src/components/InvoicingView.tsx` L334 — panel mounted.
- `apps/web/src/components/console/AppShell.tsx` L240-262 — Money-rail badge
  counts pending reviews for cost.approve roles.

### 0bf3592 — clean demo-data capture (G2)

- `e2e/capture-visual.mjs` — provisions dedicated tenant
  "Nyota Construction Ltd" via `/api/v1/auth/register-company` +
  invitations + one project (Kileleshwa Residential Villas, KIL-RES-01);
  captures never see API-suite fixture rows.
- `docs/evidence/visual/0bf3592/SEED.txt` — records tenant, project, seed
  method, commit per run. CAPTURE.md + 20 console/portal PNGs (desktop
  1440 + mobile 390).
- Stale `docs/evidence/visual/90ba399/` removed in the same commit.
- UI fixes in the same commit: ClientPortalView Back → real button;
  390px header search → icon that expands the real input (Escape/result
  collapses).
