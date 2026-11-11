# Auditor spec conflicts — unresolved contract contradictions

## CONFLICT-1: TCC gate vs `aud-stage1` test 7 (OPEN — needs auditor decision)

**Status:** strict TCC gate is enforced (per auditor review of `0d38faf`);
`aud-stage1-contractor-journey.spec.ts` test 7 cannot pass under it.

### The contradiction

Both specs are immutable auditor contracts describing the **same** product
behavior under **identical** inputs:

- `e2e/tests/aud-stage1-contractor-journey.spec.ts:383-384` — creates a
  subcontractor package (`Umeme Sparks Ltd`, no TCC record anywhere in the
  tenant), submits a portal valuation, moves it `QS_VERIFIED`, then expects
  `PATCH …/paymentStatus=APPROVED_FOR_PAYMENT` to return `< 300`.
- `e2e/tests/aud-stage3-subcontractor-supplier.spec.ts:131-134` — same
  package shape, same valuation flow, expects the identical approve call to
  return `409` / `TCC_INVALID` when no TCC exists.
- `e2e/tests/dev-tcc-all-paths.spec.ts` (new, non-aud) additionally requires
  `QS_VERIFIED`-track approvals to be TCC-gated.

No product predicate on request data or tenant state distinguishes the two
scenarios: same role (`COMPANY_ADMIN` approver), same prior status semantics,
same empty TCC table, same payload `{ paymentStatus: 'APPROVED_FOR_PAYMENT' }`.
A gate that blocks stage-3 must block stage-1; a gate that allows stage-1
must allow stage-3. The only resolution is an amendment to one of the specs.

### Resolution applied

The **strict gate wins**: `APPROVED_FOR_PAYMENT` requires a valid
(unexpired, COMPLIANT/EXEMPT) TCC on **every** review track —
`UNDER_REVIEW` and `QS_VERIFIED` alike — per the auditor's explicit
instruction that QS sign-off is a quantity/value check, not tax compliance.
`aud-stage1` test 7 therefore fails at line 384 with `409 TCC_INVALID`
(observed 2026-11-11, chromium).

### What the auditor needs to decide

Either amend `aud-stage1` test 7 to record a valid TCC before the approve
step (matching the stage-3 contract), or accept `aud-stage1` at 8/9 with
this conflict documented. The product will not reintroduce a bypass.
