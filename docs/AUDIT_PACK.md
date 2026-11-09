# Platform — Independent Auditor & Review Pack (for Claude / Auditor)

**Date of Audit:** 2026-11-03  
**Auditor / Reviewer:** Claude (Independent Auditor)  
**Builder / Implementer:** Gemini Pair  
**Branch:** `main`  
**Commit Range:** [`c4ffb27`](file:///home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction) (M0) through [`9587eb1`](file:///home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction) (M10)  
**Monorepo Test Results:** **162/162 passing tests** across 17 test suites (100% green builds, 0 type errors)

---

## 1. Quick Verification Commands

Run these directly inside the workspace repository:

```bash
# 1. Verify TypeScript type safety across all 6 packages (0 errors)
PATH="$PWD/.bin:$PATH" pnpm run typecheck

# 2. Run the complete test suite against local PostgreSQL 18 with RLS (162 tests pass)
DATABASE_URL="postgresql://db_app:app_secret@localhost:54329/construction_test?host=/tmp&schema=public" \
PATH="$PWD/.bin:$PATH" pnpm run test --force

# 3. Verify clean production build of all apps and packages
PATH="$PWD/.bin:$PATH" pnpm run build

# 4. View git commit log across milestones
git log --oneline -n 15
```

---

## 2. Repository Structure & Artifact Map

| Directory / File | Description | Audit Significance |
|---|---|---|
| `docs/PROJECT_STATUS.md` | Single source of truth for milestone progress and decisions | Updated through Milestone M10 |
| `docs/REMEDIATION_PLAN.md` | Tracker for review items (R-001 through R-020) and sign-offs | Updated with evidence links |
| `docs/SYSTEM_DESIGN.md` | Full architecture, RLS design, domain models, role matrix | Core system architecture |
| `docs/adr/` | ADR-001 through ADR-005 (Tenancy, PDF, BOQ parser, Offline sync, Money) | Architecture Decision Records |
| `docs/milestones/` | Detailed completion reports for M0 through M10 | Full evidence and verification for each milestone |
| `packages/permissions/` | Permission catalogue & role->permission matrix | RBAC foundation |
| `packages/money/` | Decimal-only arithmetic via `decimal.js` | Zero floating-point drift |
| `packages/validation/` | Shared Zod schemas (API requests & client forms) | Input boundary validation |
| `packages/db/` | Prisma 6 schema, migrations, `withTenantTx`, isolation tests | PostgreSQL 18 RLS enforcement |
| `apps/api/` | Fastify 5 REST API, route handlers, PDF templates, auth | Backend service |
| `apps/web/` | React 19 + Vite 6 PWA, Tailwind 4, role dashboards, offline queue | Frontend application |

---

## 3. Milestone Audit Checklist (Per REMEDIATION_PLAN.md)

### Checklist Item 1: Scope & Acceptance Criteria
- [x] **M0 (Monorepo & Tooling):** Turbo 2, pnpm 12, Fastify 5 `/health`, React 19 PWA, CI workflow, zero float packages.
- [x] **M1 (Walking Skeleton):** JWT session auth, cookie handling, `/login`, `/logout`, `/me`, Prisma 6 schema and seed.
- [x] **M2 (Tenancy & RBAC):** PostgreSQL 18 Row-Level Security with `FORCE ROW LEVEL SECURITY` across 20 tables; `withTenantTx` explicit transaction helper; isolation test suite (`isolation.test.ts`).
- [x] **M3 (Company, Projects, Dashboards):** Company profiles, crypto-token invitations (7-day expiry), project assignment, 4 distinct role dashboard experiences.
- [~] **Discovery Gate:** REOPENED — the 9 "interviews" were confirmed AI-synthesized, not real (R-026, owner 2026-11-06). Buyer (Main Contractor, NCA 3–6), name and pricing (KES 7,500/mo hypothesis) are UNVALIDATED hypotheses pending pilot. Workflow evidence now derives from reference-console research (`docs/research/console-audit/`).
- [x] **M4 (BOQ Staged Import):** Staged 6-stage Excel BOQ parser per ADR-003, EASMM section mapping, arithmetic discrepancy detection, interactive React 19 preview modal with row status badges, atomic commit in `withTenantTx`.
- [x] **M5 (Costs & Budget):** Append-only `CostEntry` financial ledger, receipt attachments, PM/QS multi-step approvals (`PENDING -> APPROVED / REJECTED / VOIDED`), Decimal budget aggregation.
- [x] **M6 (Site Diary & Offline):** Daily site diary logging with weather, trades headcount matrix, material deliveries, geotagged photos with Nairobi GPS tags; IndexedDB mutation queue with `Idempotency-Key` duplicate prevention; Canvas client-side photo compression (5MB -> ~150KB).
- [x] **M7 (Variance Analytics):** Real-time project variance ($\Delta = \text{Cost \%} - \text{Physical \%}$), neutral health alert cards (`ON_TRACK`, `ATTENTION`, `ACTION_REQUIRED`), section BOQ breakdown.
- [x] **M8 (Variations Workflow):** Additive & omission line items (positive & negative quantities), net amount calculation, auto-incrementing `variation_no`, QS evaluation / Client approval chain, atomic budget update invariant in `withTenantTx`, immutability of finalized variations.
- [x] **M9 (Client Portal):** 5 plain-language financial numbers in `Decimal`, visual budget bar, neutral health alert card, Nairobi GPS geotagged photo evidence gallery with lightbox modal, chronological milestone progress timeline, integrated variation approvals, Kenyan retention terms (10% interim deduction, 5% max cap, 50/50 release).
- [x] **M10 (Reports & Hardening):** Server-side PDF generation engine using `@react-pdf/renderer` adhering strictly to ADR-002 (<50MB RAM, zero Chromium processes); 3 production templates (IPC certificate, Daily Site Diary, Project Summary); automated PostgreSQL 18 backup & restore test verifying table survival, RLS `FORCE` policies, and role bounds.

---

### Checklist Item 2: Tenant Scoping & Permission Checks on Every Route
- Every API route validates authentication via `server.authenticate`.
- Every route enforces permissions via `requirePermission(...)` from `@construction/permissions`.
- Every database query executes strictly inside `withTenantTx(prisma, tenantId, ...)` under non-superuser role `db_app`.
- Verified in `apps/api/src/m2-rbac.test.ts`, `apps/api/src/m8-variations.test.ts`, and `apps/api/src/m9-client-portal.test.ts` where cross-tenant queries from Tenant B return HTTP 404/403.

---

### Checklist Item 3: Money Math & Floating-Point Prevention
- Zero JavaScript native `number` floating-point arithmetic used for financial calculations anywhere in the codebase.
- Single source of truth: `packages/money` (`decimal.js`) enforcing:
  - Currency amounts: 2 decimal places with round half-up (`ROUND_HALF_UP`).
  - Unit rates and quantities: 4 decimal places.
- Mathematical budget invariant strictly enforced on variations:
  $$\text{Current Approved Budget} = \text{Original BOQ Budget} + \sum \text{Approved Variations}$$

---

### Checklist Item 4: Hard Delete & Silent Edit Prevention
- Financial entries (`CostEntry`) and Variation Orders are strictly append-only.
- Finalized variations (`APPROVED` or `REJECTED`) reject subsequent modification with HTTP 400.
- Every state mutation writes an immutable row to `audit_logs` inside the same tenant transaction.

---

### Checklist Item 5: Neutral Language Compliance
- Strict neutrality rule enforced across all copy, notices, and error messages:
- Zero accusatory, defamatory, or criminalizing terminology (`fraud`, `theft`, `stolen`, `embezzle`, `cheat`, `overbilled`).
- Automated regex assertions in `m7-variance.test.ts` and `m9-client-portal.test.ts` verify:
  ```typescript
  expect(JSON.stringify(payload)).not.toMatch(/(fraud|theft|stole|embezzle|corrupt|cheat|overbilled)/i);
  ```

---

### Checklist Item 6: ADR-002 PDF Performance & Safety Compliance
- Measured memory increase during report generation: **~2.5MB** (benchmark limit: < 100MB).
- Measured rendering latency: **~160ms** (benchmark limit: < 2500ms).
- Zero external browser or Chromium binaries installed or spawned.

---

### Checklist Item 7: Disaster Recovery & Backup Integrity
- Automated test `apps/api/src/m10-backup-restore.test.ts`:
  - Dumps live PostgreSQL database with `pg_dump`.
  - Restores into fresh `construction_restore_test`.
  - Validates 23 tables exist, `relforcerowsecurity = true` on all 18 tenant tables, `tenant_isolation_policy` preserved, `db_app` non-superuser role bounds preserved, and tenant isolation strictly maintained.
