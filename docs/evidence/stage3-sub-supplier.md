# Stage-3 Subcontractor & Supplier — Acceptance Spec Evidence

Spec: `e2e/tests/j-stage3-subcontractor-supplier.spec.ts` (authored from the
stage-3 requirements — the auditor spec file was not delivered; contract block
maps to real routes, asserted behaviour unchanged).
Environment: real Fastify API + PostgreSQL (RLS, `db_app` non-superuser) +
Playwright API assertions. E2E DB: `construction_e2e` on disposable cluster
localhost:54329; API :4199.

## Result — OBSERVED
- `j-stage3-subcontractor-supplier.spec.ts`: **8/8 passed on chromium,
  8/8 on mobile-390** (16/16 total).
- Focused API vitest: external-portals 13/13, portal-hardening 14/14,
  commercial-operations-suite 11/11, lifecycle-money green, route-guard 8/8.

## Per-requirement coverage (all OBSERVED)
1. **Supplier record binding** — `POST /portals/links` refuses SUPPLIER links
   without `supplierId` (400); deliveries/POs are scoped by `supplier_id`
   record FK, never free-text `supplier_name`. Confirm/dispute verify the
   delivery belongs to the linked supplier. The old 30-day cap is removed;
   supplier deliveries paginate (`page`/`pageSize`).
2. **Subcontractor binding** — SUBCONTRACTOR links require
   `subcontractorPackageId`; portal data is limited to the bound package.
3. **TCC gate** — `APPROVED_FOR_PAYMENT` returns 409 `TCC_INVALID` without a
   valid (unexpired) TCC; COMPANY_ADMIN override requires a non-empty reason
   (empty → 400) and is written to the audit log.
4. **Payment integrity** — `PAID` requires `paymentReference` + `paidAt`;
   portal shows reference, paid date, retention/WHT breakdown
   (`grossWorkCertified`, `retention`, `withholdingTax`, `netPayable` aliases
   alongside `*Kes` fields) and a package summary (contract sum, certified,
   paid, remaining, retention held). Rejection reasons surface with a
   resubmit action via `replacesValuationId` (same-package, rejected-only);
   rejected claims are excluded from the certified-to-date cap.
5. **Single payment model** — ADR-008 records SubcontractorValuation as the
   sole subcontract payment model; only it posts to the cost ledger.
6. **Retention release** — portal exposes held/released/pending status.
7. **Procurement** — `purchase_orders` + `purchase_order_items` +
   `purchase_order_invoices` (migration `0012`, line link `0013`):
   DRAFT→ISSUED→ACCEPTED→PART_DELIVERED→DELIVERED→CLOSED(+CANCELLED);
   supplier accept with expected delivery date; supplier invoice with
   reference/amount/optional `purchaseOrderItemId`; diary deliveries link via
   `purchaseOrderId`/`purchaseOrderItemId`; match view returns per-line
   ordered/delivered/invoiced quantities+amounts and PO status
   MATCHED|PART_DELIVERED|OVER_INVOICED|MISMATCH; over-invoicing flagged to PM
   and blocks cost posting until reviewed; commitment posts on ISSUED,
   actuals post on invoice acceptance.
8. **Portal UX** — plain-language status labels (no raw enum names) in both
   portals; honest revoked/expired states; 390px no sideways scroll verified
   by the mobile-390 project run.
9. **Carry-overs** — stage-1 closures + stage-2 items verified in their own
   specs/evidence.

## Contract deviations (names only)
- Match-view line status uses `PENDING_DELIVERY`/`DELIVERED` per line while PO
  status is restricted to the four contract values.
- Invoices may be PO-level (unallocated) or line-allocated; unallocated amounts
  surface as `unallocatedInvoicedAmount`.

## Not finished / honest gaps
- Supplier/subcontractor portal *pages* (React) have no dedicated click tests;
  coverage is API-contract level plus the stage-2 client UI spec.
- PO match view is API-only — no web screen consumes it yet.
