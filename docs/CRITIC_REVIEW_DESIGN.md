# CRITIC_REVIEW_DESIGN.md — Red-Team Critic review of Gate 3 design

**Date:** 2026-11-06 · **Reviewer:** Critic hat (independent of author) · **Scope:** `docs/SYSTEM_DESIGN.md`, `docs/GATE3_RECONCILIATION.md`, ADR-001…010, current Prisma schema (70+ models), `docs/MVP_SCOPE.md`
**Verdict:** ⚠️ **CONDITIONAL — Gate 3 is NOT passed.** Design direction is sound, but several checklist items are asserted rather than proven, and the delta ADRs were thin until this remediation. Awaiting owner + Claude audit.

## Design pass/fail checklist (explicit answers required)

| # | Question | Answer | Evidence / gap |
|---|---|---|---|
| 1 | Tenant isolation proven? | **PARTIAL** | RLS FORCE + `withTenantTx` + isolation tests exist and pass for built tables (M2, verified 328/328). BUT the 4 delta ADRs add ~10 new tables — isolation tests for them don't exist yet (they're designs, not code). PASS conditional on slice tests. |
| 2 | Payments idempotent? | **PARTIAL** | M-Pesa subscription callbacks hardened (R-021) + `IdempotencyKey` table exists. Project-side payments (invoices, certificates, M-Pesa project collections) are unbuilt — idempotency design exists in ADRs but is unproven. FAIL until slice tests land. |
| 3 | Every action permission-checked server-side? | **PARTIAL** | `requirePermission` preHandler pattern is consistent in built routes. The console research mapped ~250 competitor endpoints; our new slices must not introduce routes without the guard. Needs a route-audit lint/test in CI to *keep* this true — currently convention-only. FINDING C-01. |
| 4 | Audit trail complete? | **PARTIAL** | Append-only `audit_logs` + DB immutability (C4 fix). New state machines (quotes, applications, COs) specify AuditLog in ADRs — must be enforced in tests, not just documented. |
| 5 | Works on weak networks? | **PARTIAL** | Offline queue exists for site diary (M6, IndexedDB). New field-facing slices (checklists, punch, attendance) don't exist yet; offline coverage for them is a design intention, not a capability. |
| 6 | Backups restorable? | **PASS (scoped)** | M10 backup/restore suite green under `db_app` after R-031 fix. Real-world DR (managed Postgres, PITR) is post-pilot. |
| 7 | Can one person operate it? | **PASS (with risk)** | Monolith + Postgres + PWA = low ops burden. RISK: 70+ models already built exceeds MVP — operational surface (migrations, RLS policies, seeds) grows faster than a solo founder can hold. FINDING C-02. |
| 8 | Simplest thing that works? | **FAIL-ish** | The frozen M11–M30 scope (tenders, telematics, materials testing, geofencing) is well beyond the MUST list in MVP_SCOPE. Building it isn't wrong if it works, but it IS scope debt: unvalidated buyer, unvalidated pricing, and no customer has touched it. Recommendation stands: freeze M11+, ship MUST slices first. |
| 9 | Anything over-engineered? | **YES — flagged** | See C-02/C-03. |

## Findings

- **C-01 (Medium): Permission-guard enforcement is convention, not mechanism.** No CI check proves every new route uses `requirePermission`/tenant scoping. Recommend a route-registration test that fails if a route lacks auth preHandler — cheap, high value. Owner: Backend Lead. Slice: first implementation slice.
- **C-02 (High): Scope debt.** ~55 tables built for modules that are LATER/SHOULD in MVP_SCOPE (PlantTelematics, AsphaltPavementBatch, TopographicSurvey, BarBendingSchedule…). Every one needs RLS policies, seeds, tests, UI — maintenance the founder pays forever. Mitigation: keep frozen (already policy), do not extend; consider whether pilot needs any of it at all.
- **C-03 (Medium): Money precision consistency.** ADRs mix `Decimal` columns and `approval_limit_minor` BigInt/integer-minor-units language (ADR-010 open question). ADR-005 must be the single source — resolve before implementation, not during.
- **C-04 (Medium): Evidence quality of "not observed" claims.** Differentiators (eTIMS, SMS, offline) are labelled not-observed, good — but MVP_SCOPE still ranks them Must/Should as if validated. They are hypotheses until role-account research (`ROLE_SIMULATION_PROTOCOL.md`) or pilot confirms them.
- **C-05 (Low): ADR-008 retention figures** tagged UNVERIFIED pending practicing Kenyan QS — correct; do not ship defaults as fact.
- **C-06 (Low): Status/doc drift.** R-032 still open; PROJECT_STATUS milestone table lags git history by ~20 milestones. Fixed-format status updates needed per slice.

## What would flip this to PASS

1. Route-auth CI guard (C-01).
2. ADR-005 money-unit decision recorded in ADR-010 (C-03).
3. First slice lands with its isolation + permission + audit tests green (items 1–4 proven on new tables).
4. Owner explicitly accepts the scope-debt position (C-02) — freeze M11+, pilot on MUST slices only.

## Recommendation to owner

Do **not** approve Gate 3 yet. Approve the *direction* (delta ADRs 007–010 are now substantive), require C-01 + C-03 resolved before the first build slice, and keep Gate 4 sequencing as: quotes-to-cash → certificates/retention → client-visibility + CO limits → punch/checklist polish.
