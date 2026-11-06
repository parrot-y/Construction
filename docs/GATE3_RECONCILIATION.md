# GATE 3 — Design reconciliation: existing SYSTEM_DESIGN vs new MVP scope

**Date:** 2026-11-06 · **Reviewer:** Devin (CTO) · **Status:** DRAFT for owner + Claude audit
**Inputs:** `docs/MVP_SCOPE.md`, `docs/research/console-audit/` (Buildsasa study), existing `docs/SYSTEM_DESIGN.md` + ADR-001…006, current Prisma schema (70+ models).

## Verdict
The existing design already covers ~80% of the new MUST scope — the earlier M11–M30 build went deep (tenders, valuations, retention, eTIMS model, portals, telematics, materials testing). Gate 3 does NOT need a rewrite; it needs **delta ADRs** for 4 real gaps and a sequencing plan.

## Coverage matrix (MVP MUST → existing assets)

| MVP MUST item | Existing asset | Gap |
|---|---|---|
| Auth/tenancy/RBAC/audit | M1–M3, RLS FORCE, withTenantTx, audit_logs | None |
| Projects/invites/dashboards | M3 | None |
| BOQ import (EASMM) | M4 + ADR-003 | None |
| Budget/costs/approvals | M5 CostEntry ledger | None |
| Site diary/photos/progress/offline | M6 + ADR-004 | **Photo client-visibility toggle missing** |
| Variance/dashboard | M7 | None |
| Variations | M8 VariationOrder/Item | CO semantics differ: ours = contract variations; theirs = change orders w/ trigger+approval chain. **Map VariationOrder as our CO engine; add trigger/assignee/approval-limit fields** |
| Client portal | M9 + PortalAccessLink | **No structured Client entity; photos lack client_visible flag** |
| PDF reports (IPC/diary/summary) | M10 + ADR-002 | IPC is generated on-the-fly — **no persisted certificate entity** |
| Change orders w/ approval limits | VariationOrder (SUBMITTED→QS_EVALUATED→APPROVED→REJECTED) | **No per-role approval limit, no PM→Owner two-step** |
| Quotes→project→deposit invoice | — | **MISSING entirely** |
| Invoicing AR | ETimsInvoice (own tax invoices) | **No client AR invoice entity** |
| Commitments→claims→payment apps→retention→certificates | SubcontractorValuation (retention+WHT+pay status), SubcontractorRetentionRelease, DefectsLiabilityCertificate | Sub-side chain exists; **client-side certificate/payment-application chain missing as entities** |
| Punch/snags | SnagItem + SnagPhoto | Equivalent — rename/extend UI only |
| KES-first + M-Pesa billing | ADR-006, SubscriptionPlan, MpesaSubscriptionTransaction | Currency display default needs KES check |
| eTIMS | ETimsInvoice model + StatutoryTaxCertificate | Real VSCU integration deferred post-pilot (C2 disclaimers already fixed) |

## SHOULD items — existing partial coverage
Checklists→InspectionChecklist; Inspections→IndependentSiteInspection+Checklist; Observations/RFI→RFI+SnagItem; Safety→SafetyIncident+SafetyAuditRecord; Schedule→ProjectScheduleTask; Drawings→ProjectDocument (partial — no viewer/revisions/pin-punch); Attendance→LaborMusterRoll+WorkerClockEvent; Crews→SiteLaborer (no Crew entity); Correspondence/Announcements/Inbox→**missing** (defer); Inventory→SiteInventoryItem+InventoryMovement; Reports→M10 PDFs (scheduled reports missing); Directory/Subcontractors→SubcontractorPackage (no generic Contact); Role manager→permissions package (14-role presets = config).

## LATER — confirm deferred
Bidding→ProjectTender/TenderBid already built (bonus); AI credits; self-host; SMS gateway; accounting integrations.

## Delta ADRs required before slice planning
- **ADR-007** Quotes-to-cash chain (Quote, QuoteLine, Invoice, InvoiceLine, project conversion, deposit invoice)
- **ADR-008** Client payment certificates & retention ledger (persist IPCs; submit→approve→mark-paid; unify with SubcontractorValuation pattern)
- **ADR-009** Client visibility controls (ProjectClient entity, SitePhoto.client_visible, notes-never-shared rule)
- **ADR-010** Change-order/variation upgrade (trigger types, assignees, PM→Owner chain, per-role approval_limit_minor)

## Design-pass checklist (self-review vs skills/system-design-review)
- Tenant isolation: all new tables get RLS FORCE + isolation tests — YES by convention
- Payments idempotent: M-Pesa callbacks already hardened (R-021) — YES
- Server-side RBAC on every route — YES (requirePermission pattern)
- Audit trail complete — YES (append-only audit_logs)
- Weak networks — offline queue exists; extend to new field forms — YES
- Backups restorable — verified (M10 suite green)
- One-person ops — monolith + Postgres + PWA, managed Postgres later — YES
- Over-engineering check — 70 models already built is arguably AHEAD of MVP; new slices must not widen scope beyond MUST list — FLAG for Critic

## Recommendation
Approve Gate 3 conditionally: adopt the 4 delta ADRs, then Gate 4 build plan re-sequences remaining work as: (1) quotes-to-cash slice, (2) client certificates/retention slice, (3) client-visibility + CO-upgrade slice, (4) punch/checklist polish — all on top of the frozen-but-remediated M0–M10 base. Everything M11+ stays frozen until owner + Claude sign off.
