# ADR-008: Client payment certificates & retention ledger

**Status:** proposed · **Date:** 2026-11-06 · **Deciders:** owner + CTO

## Context
Buildsasa's money spine: commitments → claims → payment applications (submit/approve/reject/mark-paid) → certificates → retention release. Ours generates IPC PDFs on the fly (M10) with no persisted entity, and SubcontractorValuation covers only the sub-contract direction. Client-facing certificates need durable state, approval chain and audit.

## Options
- **A. New `payment_applications` + `certificates` + `retention_ledger` entities** for the client (employer) direction, mirroring the proven SubcontractorValuation shape.
- **B. Extend VariationOrder/CostEntry** — rejected: wrong lifecycle (variations ≠ valuations).
- **C. PDFs only** — rejected: no approval state, no reconciliation, audit gap.

## Decision
Option A.
- `payment_applications`: project, period, gross certified, retention deducted, previous payments, WHT, net payable, status (`DRAFT→SUBMITTED→QS_VERIFIED→APPROVED→PAID` / `REJECTED`), payment_reference, approved_by — same pattern as SubcontractorValuation.
- `certificates`: issued IPC entity (number, period, amounts, PDF storage_key, status) — PDF regenerates from entity, never the reverse.
- `retention_ledger`: append-only entries (hold/release) per project — reuse logic from SubcontractorRetentionRelease but employer-side (10% interim, 5% cap, 50/50 release per JBC terms already in M9).
- All money Decimal via packages/money; RLS FORCE; isolation + immutability tests.

## Consequences
- Client portal gains "Valuations" tab showing certificates + retention balance.
- M-Pesa/B2C disbursement hooks later via existing MpesaDisbursementTransaction.
- Unifies terminology: our "IPC" = their "certificate/application".
