# Stage-1 Contractor Journey — Auditor Acceptance Spec Evidence

Spec: `e2e/tests/h-stage1-journey.spec.ts` (auditor-written, run verbatim).
Environment: real Fastify API + PostgreSQL (RLS, `db_app` non-superuser) + real React UI via Playwright.
E2E DB: `construction_e2e` on the disposable cluster (port 55432); API :5180, web :5173.

## Contract deviations (names only — asserted behaviour unchanged)
Documented in the spec header:
- `certificateToInvoice` → `POST .../payment-certificates/:certId/create-invoice` (existing route)
- `notifications` → `GET /api/v1/inbox` (existing real inbox feed)
- `register-company` payload uses canonical `RegisterCompanySchema` field names
  (`adminFullName`/`email`/`phone`) instead of the draft's `adminName`/`adminEmail`/`adminPhone`.

## Result — OBSERVED
- `h-stage1-journey.spec.ts`: **9/9 passed on chromium, 9/9 on mobile-390** (18/18 total, ~30s per project)
- Full API vitest suite on fresh migrated cluster: **60 files / 549 tests passed**
  (includes m10 backup/restore — earlier failures were the missing 54329 cluster, now provisioned)
- Focused suites: lifecycle-money 6/6, s4-certificates, notifications 5/5,
  projects-visibility 2/2, portal-hardening 14/14, commercial-operations 11/11,
  m8-variations, s3-change-orders, quotes 24/24 — all green

## What the spec caught (failing test first → fix)
1. `AcceptInvitationSchema.email` was required — invitees had to re-type the invited
   address. Now optional; a supplied mismatched email still returns 403.
2. Certificate create with no amount produced KES 0.00. Now DERIVES the amount from
   real BoQ progress (completion% × qty × rate − previously certified) via the same
   `deriveProgressCertificate` helper as `/preview`; derived lines are persisted.
3. Invoice-from-certificate billed gross while retention was only memo'd. Now:
   invoice `subtotal` = this-period net of retention, retention appears as an
   explicit negative line, VAT/WHT recomputed on the same net base (cert tax base
   aligned so cert and invoice agree). `clientName` optional (quote client → project).
4. Deposit invoice on quote convert silently carried `tax_pct=0`. Now splits the
   VAT-inclusive deposit into net + VAT at the quote's tax rate.
5. Valuation segregation only checked `prepared_by_id`; portal-submitted valuations
   have none, so the reviewer could self-approve. Added `reviewed_by_id`/`reviewed_at`
   (migration `0010_valuation_reviewer`); approver must differ from BOTH preparer and reviewer.
6. Client portal CO respond only accepted `OWNER_REVIEW`; a PM-evaluated CO stuck at
   `PM_REVIEW` could never be client-approved. Portal now accepts `PM_REVIEW` or
   `OWNER_REVIEW` (the client IS the owner-side authority); atomic claim unchanged.
7. `GET /api/v1/projects/:id/checklist` did not exist — added: 7 steps computed from
   real data (accepted/converted quote, active BoQ, ≥2 members, diary, certified cert,
   paid invoice, closeout stage) with deep-link hrefs.
8. Variation payload rejected numeric `quantity`/`unitRate` and `CLIENT_REQUEST`
   trigger — schema now coerces numbers and the enum gained `CLIENT_REQUEST`
   (labels added in web).

## Per-step coverage (all OBSERVED green)
1. register-company 201 → duplicate refused → login → zero projects → tenant isolation
2. 3 invites created/listed; 390px invite page shows company+role, no h-scroll;
   accept+login per role; used token refused
3. quote→send→public accept→convert+deposit invoice (tax_pct=16); budget = quote total;
   PM+sup assigned as members
4. BoQ confirm by PM; items addressable; foreman denied (401/403)
5. diary idempotency-key replay → exactly 1 row; progress 45% of BoQ item;
   390px offline/online no crash, no h-scroll
6. variation CLIENT_REQUEST → submit → EVALUATE → client portal APPROVE →
   contract sum +300,000 exactly; second decision refused
7. subcontractor package + portal valuation 300k (over-claim 900k → 400);
   SUBMITTED→PAID jump ≥400; QS_VERIFIED→UNDER_REVIEW; self-approve ≥400;
   admin approve → budget/summary approvedCost increases
8. cert auto-derived 81,000 (45% × 180,000); SUBMIT/REVIEW/ CERTIFY;
   create-invoice → subtotal 76,950, VAT 12,312; M-Pesa payment → cert PAID;
   overpay refused; retention_held 4,050
9. inbox contains diary/valuation/certificate/variation bodies; checklist
   boq/diary/certificate done, closeout not; 3 report exports 200;
   cross-tenant project read → 403/404

## Honestly not covered by this spec
- UI clicks for cert/invoice/valuation flows (API-level assertions only; the
  contractor-journey spec covers UI paths separately)
- WhatsApp "Copy" buttons (clipboard requires permissions; covered by component tests)
- Live provider keys (Daraja/eTIMS/WhatsApp/LLM) — still simulated and labelled
