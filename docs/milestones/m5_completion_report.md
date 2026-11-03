# Milestone M5 Completion Report — Budget, Costs & Multi-Step Approvals

**Author:** Antigravity (Builder)  
**Date:** 2026-11-03  
**Status:** Complete & Self-Verified (Ready for Independent Audit)  
**Applicable Documents:** [`docs/GEMINI.md`](file:///home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/docs/GEMINI.md), [`docs/SYSTEM_DESIGN.md`](file:///home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/docs/SYSTEM_DESIGN.md), [`docs/decisions/001-multi-tenant-isolation-and-rls.md`](file:///home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/docs/decisions/001-multi-tenant-isolation-and-rls.md), [`docs/decisions/005-precision-and-rounding.md`](file:///home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/docs/decisions/005-precision-and-rounding.md)

---

## 1. Executive Summary

Milestone **M5 (Budget, Costs, Approvals)** has been completed and verified end-to-end. Connecting the committed BOQ baseline directly to on-site expense tracking, M5 enforces strict financial invariants:
1. **Append-Only Invariant:** Financial records are immutable. No hard deletion (`DELETE`) is permitted. Corrections or cancellations are executed strictly via status transitions to `VOIDED` with required reasoning and atomic audit logging.
2. **Decimal Precision Math:** All monetary operations execute server-side using `@construction/money` (`Decimal.js`, 28-digit precision, ROUND_HALF_UP).
3. **Fail-Closed Tenancy & Permissions:** All runtime operations run inside `withTenantTx` under non-owner role `db_app`. PostgreSQL 18 Row-Level Security (`FORCE ROW LEVEL SECURITY`) isolates all cost, receipt, and approval records. Least-privilege RBAC ensures site supervisors can draft costs but cannot approve them; clients cannot create internal contractor costs.

The entire monorepo test suite passes **75/75 tests green**, TypeScript emits 0 errors, and the production build completes cleanly.

---

## 2. Technical Deliverables

### A. Validation Schemas (`packages/validation/src/index.ts`)
- `CostCategoryEnum`: `MATERIAL`, `LABOR`, `PLANT`, `SUBCONTRACT`, `PRELIMINARY`.
- `CostStatusEnum`: `PENDING`, `APPROVED`, `REJECTED`, `VOIDED`.
- `CreateCostEntrySchema`: Validates amount (2-decimal positive KES amount), category, mandatory description, optional vendor name, invoice reference, linked BOQ item ID, and receipt file metadata.
- `ApproveCostEntrySchema`: Validates approval action (`APPROVED` | `REJECTED`) and reviewer comments.
- `VoidCostEntrySchema`: Requires clear, audited justification for voiding an entry.

### B. Fastify REST Endpoints (`apps/api/src/routes/costs.ts`)
- `POST /api/v1/projects/:projectId/costs`: Creates append-only cost entry in `PENDING` status, linking to BOQ item and receipt files if provided, with atomic `AuditLog` entry.
- `GET /api/v1/projects/:projectId/costs`: Paginated and filterable list of cost entries by status (`ALL`, `PENDING`, `APPROVED`, `REJECTED`, `VOIDED`), category, and BOQ item.
- `GET /api/v1/projects/:projectId/costs/:costId`: Retrieves complete cost detail with approval history, receipts, author, and BOQ item details.
- `POST /api/v1/projects/:projectId/costs/:costId/approve`: Multi-step approval hook. PM/QS reviews and transitions status to `APPROVED` or `REJECTED` with comments. Writes to `CostApproval` and `AuditLog` atomically.
- `POST /api/v1/projects/:projectId/costs/:costId/void`: Voids an entry with mandatory reason. Guards against double-voiding or approving voided records.
- `POST /api/v1/projects/:projectId/costs/:costId/receipts`: Attaches photo/PDF vouchers with storage keys.
- `GET /api/v1/projects/:projectId/budget/summary`: Calculates live project budget metrics:
  - Approved Budget ($B_{proj}$)
  - Approved Costs ($C_{approved}$)
  - Pending Costs ($C_{pending}$)
  - Remaining Budget ($B_{rem} = B_{proj} - C_{approved}$)
  - Consumption Ratio & Percentage
  - Category Breakdown (Material, Labor, Plant, Subcontract, Preliminary)
  - Neutral variance alert banner when consumption exceeds progress by $\ge 15\%$.

### C. React 19 UI Components (`apps/web/src/components/`)
- `CostCaptureModal.tsx`: Accessible dialog for site supervisors and PMs to log site expenses, select categories, input vendor details, link BOQ items, and attach receipt photos with preview.
- `BudgetSummaryCard.tsx`: Real-time financial KPI dashboard showing budget consumption bar, category distribution pills, and factual neutral variance alert banners.
- `CostManagementView.tsx`: Filterable table with status badges (🟡 Pending, 🟢 Approved, 🔴 Rejected, ⚪ Voided), inline action buttons ("Approve", "Reject", "Void"), and attached receipt indicators.
- Embedded into `PmQsDashboard.tsx` and `SupervisorDashboard.tsx`.

---

## 3. Test & Verification Matrix

### Monorepo Vitest Suite (75/75 Green)
| Package | Tests | Status | Scope |
|---|---|---|---|
| `@construction/money` | 7 | ✅ Passed | Decimal arithmetic, half-up rounding, variance alert guard |
| `@construction/permissions` | 3 | ✅ Passed | Role-to-permission mapping, RBAC least-privilege matrix |
| `@construction/db` | 11 | ✅ Passed | PostgreSQL 18 RLS with `FORCE`, `withTenantTx` atomicity, rollback verification |
| `@construction/web` | 10 | ✅ Passed | Login, role dashboards, PWA offline banner, BOQ modal, CostCaptureModal, BudgetSummaryCard, CostManagementView |
| `@construction/api` | 44 | ✅ Passed | Auth, RBAC guards, M3 company/invites, M4 BOQ import, M5 costs suite (12 tests) |
| **Total** | **75** | **100% Green** | Zero failures, zero skipped |

### M5 Dedicated Test Suite (`apps/api/src/m5-costs.test.ts`)
1. **Cost Logging with Decimal Precision**: Site Supervisor logs cost entry in `PENDING` status with Decimal amount (`45000.50`), category `MATERIAL`, vendor, invoice ref, and receipt scan.
2. **BOQ Item Linking**: Verifies cost entry successfully associates with specific active BOQ line item.
3. **Negative/Zero Rejection**: Rejects negative or zero amounts fail-closed (`HTTP 400`).
4. **Receipt Attachment**: Verifies additional receipts can be attached to existing cost entries.
5. **PM/QS Approval**: Transitions entry from `PENDING` to `APPROVED`, creates `CostApproval` record with comments, writes atomic `AuditLog`.
6. **PM/QS Rejection**: Rejects cost entry with reason, recording `REJECTED` status and approval trail.
7. **Strict Append-Only Invariant (Voiding)**: Voids entry with reason. Verifies row is NOT deleted from DB, and attempts to re-approve voided entries are rejected (`HTTP 400`).
8. **RBAC Least-Privilege Guard**: Site Supervisor cannot approve costs (`HTTP 403`).
9. **Role Boundary Enforcement**: Client role cannot create internal cost entries (`HTTP 403`).
10. **PostgreSQL RLS Cross-Tenant Isolation**: Tenant B cannot view (`HTTP 404`), approve (`HTTP 404`), or list Tenant A costs (0 rows returned via API and direct DB query).
11. **Decimal Budget vs Actual Calculation**: Verifies exact mathematical aggregation of approved budget, approved cost, pending cost, remaining balance, category sums, and neutral variance alert.
12. **Atomic Rollback Verification**: Injected failure halfway through transaction verifies neither cost status nor orphan approval records are committed.

---

## 4. Next Milestone: M6 (Site Diary, Photos, Progress & Offline Sync)
With M5 budget and cost ledger complete, we proceed to **Milestone M6**:
1. Dexie IndexedDB client-side offline storage queue for site supervisors.
2. Daily site diary capturing weather, headcount (masons, carpenters, steel fixers, casuals), and notes.
3. Geotagged photo capture with SHA-256 evidence hashing.
4. Idempotent background synchronization queue with exponential retry.
