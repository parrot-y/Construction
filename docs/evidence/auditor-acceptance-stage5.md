# Stage 5 — internal roles auditor acceptance

Date: 2026-11-12 · Branch: `devin/contractor-lifecycle` · Spec: `e2e/tests/aud-stage5-internal-roles.spec.ts` (immutable, sha256 `491070f7a6f468bea3504da7852431d6ef6bfd50ee91f9983170c769fa200235`)

## Result

| Spec | chromium | mobile-390 |
|---|---|---|
| aud-stage1 contractor journey | 9/9 | 9/9 |
| aud-stage2 client/owner | 10/10 | 10/10 |
| aud-stage3 subcontractor/supplier | 9/9 | 9/9 |
| aud-stage4 consultant/compliance/field | 8/8 | 8/8 |
| **aud-stage5 internal roles** | **11/11** | **11/11** |
| dev-tcc-all-paths (non-aud regression) | 5/5 | 5/5 |

**Combined run: 104/104 tests passed, zero skips** (single `playwright test`
invocation covering all six spec files on both projects).

## Product work the spec forced

1. **Per-request role refresh** (`apps/api/src/plugins/auth.ts`): the JWT
   role claim is now overwritten from the live `memberships.role` row on
   every authenticated request. Demotion (SUPERINTENDENT→VIEWER) and removal
   take effect on already-issued access tokens immediately — no token-lifetime
   workaround. Removed members also fail fresh login (membership lookup
   returns none).
2. **Maker-checker on costs** (`apps/api/src/routes/costs.ts`): the user who
   created a `CostEntry` cannot approve/reject it (409); an already
   APPROVED/REJECTED entry cannot be decided again (409).
3. **Numeric cost amounts** (`packages/validation`): `CreateCostEntrySchema.amount`
   accepts JSON numbers as well as decimal strings (normalised to the
   canonical 2-dp string).
4. **Cross-tenant 404s**: `GET /projects/:id/costs` and
   `GET /projects/:id/site-diaries` now verify the project exists inside the
   caller's tenant before listing — previously they returned `200 []` for a
   foreign project id (silent probe surface).
5. **Bodiless DELETE** (`apps/api/src/index.ts`): tolerant JSON parser treats
   `Content-Type: application/json` with an empty body as no body instead of
   Fastify's default 400 — required for `DELETE /company/members/:id`.
6. **E2E rate-limit knob**: `REGISTER_COMPANY_RATE_LIMIT_MAX` env var
   (production default stays 5/min; Playwright config sets 1000) — the
   combined-suite run exceeded the register limit mid-run.

Already-correct behaviour confirmed by the spec (no changes needed):
project scoping per role, VIEWER read-only + no money, invite hierarchy
(EXECUTIVE→PM_QS ok, →ADMIN/COMPANY_ADMIN/EXECUTIVE refused), QA/QC
inspection create + item FAIL, SITE_ENGINEER blocked from inspections and
announcement posting, cross-company isolation on projects/costs/
inspections/diaries/members/cost-approval.

## Verify-local

`verify-local.sh` → **LOCAL CI VERIFICATION COMPLETED SUCCESSFULLY**
(561/561 API, 118/118 web, lint/typecheck/build/audit clean) —
`docs/evidence/verify-9fb784d.log`.

---

## Follow-up (2026-11-12): maker-checker self-approval rule — auditor decision

Auditor refined the Stage-5 maker-checker rule: creator cannot approve own
cost/certificate/invoice **except** COMPANY_ADMIN/ADMIN with a non-empty
`selfApprovalReason` (stored on the row, audit-logged, flagged in response).

### Implementation

- Migration `0016_maker_checker_self_approval`: `self_approved` +
  `self_approval_reason` on `cost_entries`, `payment_certificates`, `invoices`.
- `apps/api/src/plugins/makerChecker.ts`: shared `evaluateSelfApproval` —
  409 for non-admin creators; 409 for admin without reason; `{selfApproved,
  reason}` otherwise.
- Costs approve: applies to `APPROVED` decisions (creator may still reject own
  pending entry); response returns `selfApproved`.
- Certificates: applies to `CERTIFY` and `MARK_PAID` (creator = `submitted_by_id`).
- Invoices: applies to `POST /invoices/:id/send` (creator = `created_by`).
- Web: `CostManagementView` shows a "Self-approved" badge; on a 409
  self-approval response it prompts for the reason and retries.

### Runs (real output)

- `dev-maker-checker.spec.ts` (new, non-aud): **4/4 chromium, 4/4 mobile-390**
  — PM self-approve 409; admin no-reason 409; admin with-reason 200 +
  `selfApproved`/`self_approved` + persisted reason; second decision refused;
  same matrix for certificates (CERTIFY) and invoices (/send).
- Full auditor+dev sweep, single invocation both projects:
  **112/112 passed** (aud-stage1–5 = 47 tests, dev-tcc 5, dev-maker-checker 4,
  ×2 viewports).
- `verify-local.sh` → **LOCAL CI VERIFICATION COMPLETED SUCCESSFULLY**
  (561/561 API, 118/118 web) — `docs/evidence/verify-86e86ac.log`.
  `invoices.test.ts` updated to send admin-created invoices with
  `selfApprovalReason` (the new required admin path).
- aud-* specs and `aud-specs.sha256` untouched.

### Auditor re-review fixes (commit 87f0c0b)

- `selfApprovalReason` now requires **≥15 non-space characters** (409
  otherwise) on costs, certificates and invoices — covered by new short-
  reason cases in `dev-maker-checker.spec.ts` for all three entities.
- `CostManagementView`: the reason prompt appears only for
  COMPANY_ADMIN/ADMIN; other roles see "A different approver is required."
  (`userRole` threaded from `useConsole()` in MoneySection and
  `session.user.role` in PmQsDashboard).
- `dev-maker-checker.spec.ts`: **8/8** across chromium + mobile-390.
- `verify-local.sh` on `87f0c0b` → **COMPLETED SUCCESSFULLY**:
  API **561/561**, web **118/118**, db 15/15, money 63/63, permissions 9/9 —
  log: `docs/evidence/verify-87f0c0b.log`.
- aud-* specs and `aud-specs.sha256` untouched.
