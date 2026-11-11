# Evidence — Procurement UI (PO create / issue / match / invoice review)

Date: 2026-11-11 · Commit: pending · Branch: `devin/contractor-lifecycle`

Closes the stage-3 carry-over gap: purchase orders were API-complete but had
no web surface, and the supplier portal told suppliers POs were "managed by
the contractor's finance team" despite accept/invoice endpoints existing.

## What was built

- `apps/web/src/components/ProcurementView.tsx` — new console view:
  - PO list with plain-language status badges (`statusLabel` from API),
    supplier, item-count + line preview, expected/issued dates, totals.
  - Create-draft-PO form: supplier select (`GET /suppliers`), dynamic line
    rows (description/unit/qty/rate), live total via `formatKes`.
  - "Issue to supplier" on DRAFT → commitment + PENDING cost entry post
    server-side (API unchanged).
  - "Three-way match" expander → `GET .../match`: per-line ordered /
    delivered / invoiced quantities and amounts, PO-level status badge
    (MATCHED | PART_DELIVERED | OVER_INVOICED | MISMATCH), unallocated
    invoiced amount, supplier-invoice list.
  - Invoice review (COST_APPROVE holders only, `canManage`): accept /
    reject with reason, explicit "approve over-invoice" checkbox required
    when the invoice exceeds the PO total. Accept posts the actual cost
    entry server-side. Match panel refreshes in place after review.
- `apps/web/src/components/console/sections/MoneySection.tsx` +
  `navConfig.ts` — new `procurement` money sub-tab for roles whose nav
  already included commitments (admins, exec, PM_QS, superintendent,
  architect, owner read-mostly). Viewer money tabs unchanged.
- `apps/web/src/components/portals/SupplierPortalView.tsx` — real PO
  section replacing the "managed by finance" placeholder:
  - Own POs from the portal payload (`purchaseOrders` was already
    returned by `GET /portals/supplier/:token` but never rendered).
  - ISSUED → accept with required expected-delivery date.
  - ISSUED/ACCEPTED/PART_DELIVERED/DELIVERED → submit invoice
    (reference, amount, optional PO-line allocation, note).
  - Existing invoices with plain-language status.
  - All money rendered via `formatKes` (currency-guard clean).

## Tests

`e2e/tests/l-procurement-ui.spec.ts` — authored spec (no auditor file was
provided for this gap); real browser clicks on both Playwright projects.

| # | Step | Coverage |
|---|------|----------|
| 1 | PM creates draft PO via console UI (supplier select, line, submit) | ProcurementView create flow |
| 2 | PM clicks "Issue to supplier"; PO flips to Issued; API confirms ISSUED | issue endpoint + ledger post path |
| 3 | "Three-way match" panel renders status + ordered/delivered/invoiced columns | match DTO rendering |
| 4 | Supplier portal API: accept PO (expected date) + submit invoice | portal accept/invoice endpoints |
| 5 | PM reviews invoice in UI (reason + accept) → Accepted; API confirms | review endpoint + actuals post |

## Results

- `l-procurement-ui.spec.ts` — **10/10 passed** (5 tests × chromium + mobile-390)
- `apps/web` vitest — **118/118** (currency-guard clean after `formatKes` migration)
- `apps/web` `tsc --noEmit` — clean; `e2e` `tsc --noEmit` — clean

## Real bugs caught by the new coverage

1. Match panel stayed stale after invoice review — `openMatch` toggled the
   panel closed instead of refreshing; now re-fetches in place.
2. Currency guard flagged `toLocaleString`/`toFixed` in the new components —
   migrated to `formatKes`.
3. PO card didn't render line descriptions — added a truncated item preview
   so created POs are identifiable in the list.

## Honestly remaining

- Subcontractor portal page coverage unchanged (valuations API-complete;
  portal UI exists but has no dedicated click spec for the new
  package-summary/retention/resubmit fields).
- Consultant drawings/acknowledgement and compliance permits/visits UI
  controls exist only as API + portal payloads — no dedicated click spec.
- FieldDashboard offline-queue paths are unit/API-covered; no 390px click
  spec for the field-role screens yet.
