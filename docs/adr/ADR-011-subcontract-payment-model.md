# ADR-011: Single subcontract payment model for the pilot

**Status:** accepted · **Date:** 2026-11-10 · **Deciders:** owner + CTO · **Evidence:** `docs/evidence/stage3-sub-supplier.md`, `apps/api/src/routes/commitments.ts`, `apps/api/src/routes/commercialOperations.ts`

## Context

Two parallel mechanisms can certify and pay subcontractor progress:

- **`SubcontractorValuation`** (`commercialOperations.ts`) — work-package-bound
  progress claims with the full state machine
  (`SUBMITTED → UNDER_REVIEW → APPROVED_FOR_PAYMENT → PAID`), TCC compliance
  gate with audited admin override, `paymentReference`/`paidAt` requirements,
  rejection reasons + `replacesValuationId` resubmission, certified-to-date cap
  excluding rejected claims, retention/WHT breakdown, and **posts to the cost
  ledger** (`cost_entries`) exactly once on `APPROVED_FOR_PAYMENT`.
- **`Commitment` + `PaymentApplication`** (`commitments.ts`) — vendor commitments
  with gross claim → retention → advance recovery → WHT → net payable math and
  `SUBMITTED → APPROVED → PAID` transitions. It has **no** TCC gate, no
  portal-submitted claims, no package binding enforcement, and **does not post
  to the cost ledger** (verified: `commitments.ts` contains no `costEntry`
  writes).

Running both as subcontract payment paths would split the ledger, double-count
certified amounts, and give subs two inconsistent claim routes.

## Decision

**`SubcontractorValuation` is the sole subcontract payment model for the
pilot.** All subcontractor progress claims, certifications, retention
withholding, WHT, and payment recording go through it — including claims
submitted via the token-scoped subcontractor portal.

`Commitment`/`PaymentApplication` is retained **only** for `SUPPLIER`,
`CONSULTANT`, and `OTHER` vendor commitments (procurement advances, retention
schedules, consultant fee applications). It must not be used to certify
subcontractor progress payments; the `SUBCONTRACTOR` vendor type is removed
from the commitment creation UI and new subcontract commitments are created
through the subcontractor package flow instead.

## Consequences

- Only `SubcontractorValuation` posts to `cost_entries` for subcontract
  work — the ledger stays single-sourced (enforced by the TCC gate + cap +
  idempotent `cost_entry_id` link).
- Existing `SUBCONTRACTOR`-typed commitments remain readable for historical
  advance/retention tracking but are deprecated for new progress claims.
- The Money console "Sub valuations" tab is the subcontract payment surface;
  "Commitments" no longer offers subcontractor claims.
- If a future need arises for unified progress claims across vendor types,
  revisit with a dedicated ADR — do not silently reactivate PaymentApplication
  for subs.
