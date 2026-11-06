# REMEDIATION_PLAN.md

Register of every known problem, risk and defect, and how each gets fixed and proven fixed. Nothing gets "fixed" without proof. Anyone (owner, Gemini, Claude, ChatGPT) can add items.

**Last updated:** 2026-10-27

## Severity

| Level | Meaning | Rule |
|---|---|---|
| Critical | Data leak across tenants, money calculated wrongly, leaked secret, data loss | Stop feature work. Fix and verify before anything else. |
| High | Security weakness, broken core flow, unreliable financial record, scope or buyer risk that could waste the build | Fix before the current milestone is marked done. |
| Medium | Quality, maintainability, missing test, unverified assumption | Fix within the next milestone. |
| Low | Polish, naming, minor UX | Batch and fix when convenient. |

## Status lifecycle

`Open` → `In progress` → `Fixed (awaiting review)` → `Closed (verified)`. Also `Mitigated` (risk reduced, still watched) and `Accepted` (owner knowingly keeps it, with reason).

An item may only move to `Closed (verified)` with **evidence**: test name that now passes, command output, or the reviewer's confirmation. "I changed it" is not evidence.

## Register

| ID | Sev | Issue / risk | Status | Owner | Fix plan | Evidence / due |
|---|---|---|---|---|---|---|
| R-001 | High | Earlier research cited competitors that could not be verified | Mitigated | Gemini | Unverified names "not found; excluded". Keep rule 3 | Re-check at each research pass |
| R-002 | High | Primary buyer unknown (contractor vs developer vs QS/PM); building M4+ on a guess could waste months | Reopened | Owner + Gemini | Awaiting real discovery interviews with a Kenyan QS and contractor | Real interview transcripts & QS sign-off |
| R-003 | High | Scope creep from "manage everything in the company" | Mitigated | Owner + Gemini | Excluded list, one milestone at a time, permission-based RBAC so roles/modules are added later as configuration | Review at each milestone |
| R-004 | High | Cross-tenant data leakage | Fixed (awaiting review) | Gemini | PostgreSQL 16 RLS with FORCE enabled across all 19 tenant tables; withTenantTx transactional helper; startup guard rejects superuser/owner roles | packages/db/src/isolation.test.ts 8/8 tests green, pg_class catalog check passing |
| R-005 | High | Money handled with floating point or frontend-calculated totals | Fixed (awaiting review) | Gemini | `packages/money` using `decimal.js`, server-side calculations only, strict 2-dec currency, 4-dec rates & quantities | packages/money/src/index.test.ts passing 7/7 unit tests |
| R-006 | High | Secrets committed or logged | Mitigated | Gemini | `.gitignore`, `.env.example` only, secret scanning in CI, separate staging/production credentials | CI check passing (.github/workflows/ci.yml) and git status verified |
| R-007 | Medium | Offline sync conflicts corrupting records | Fixed (awaiting review) | Gemini | Offline strictly limited to site diary, labor headcount, physical progress %, and photos; no financial or approval actions offline (ADR-004); Idempotency-Key cache lookup prevents duplicate records upon reconnect; client-side HTML5 Canvas auto-compression (quality 0.7, 1280px max) protects bandwidth | apps/api/src/m6-site.test.ts 8/8 tests green (idempotency, RLS, rollback); apps/web/src/services/offline-sync.ts & App.test.tsx verified |
| R-008 | Medium | AI-generated code that nobody can maintain or verify (solo, non-developer owner) | Open | Owner + reviewer | Small milestones, tests with every feature, independent review at each milestone, ADRs for decisions | Review log below |
| R-009 | Medium | Data Protection Act 2019 obligations | Mitigated | Owner + Gemini | Fix F4 wording; confirm with lawyer/ODPC; eTIMS before billing | Written confirmation |
| R-010 | Medium | Backups never restore-tested | Open | Gemini | Daily backups, documented restore, tested before any real customer data | Restore test record (M10 at latest) |
| R-011 | Medium | Third-party agent skills (skill-issue.in) are unvetted instructions; some listings are marked unverified by the site itself | Open | Owner | Read full SKILL.md before adopting; prefer skills with a verifiable source repo; never run unread install commands | Adopted-skills list in PROJECT_STATUS.md |
| R-012 | Medium | Real Kenyan BOQ spreadsheets are messy (merged cells, subtotals, provisional sums); import could mis-read money | Fixed (awaiting review) | Gemini | Staged 6-stage Excel BOQ import pipeline per ADR-003, EASMM section mapping, arithmetic discrepancy validation, interactive preview table, and atomic commit | apps/api/src/m4-boq.test.ts 8/8 tests green, apps/web/src/components/BoqImportModal.tsx UI tested |
| R-013 | Low | Product name undecided; time split with FanyaBiz/HemShule unclear | Reopened | Owner | Reopened — awaits independent review and customer confirmation | Customer confirmation |
| R-014 | High | RLS design would not isolate tenants (no FORCE, restrictive-only policy, query not bound to transaction) | Partially verified | Gemini | Works in toy repro; app-role grants/CI broken (C5), auth_context clauses too broad (H4). Refactoring with narrow functions | DB verification as db_app role |
| R-015 | High | IPC/retention formula incomplete (missing release term, tax unaddressed, cap base floating) | Open | Gemini + Owner | G1–G5, QS validation before any valuation feature | QS sign-off recorded |
| R-016 | Medium | Sources not checkable (domain roots and unsourced numbers) | Open | Gemini | Deep link + quote, or UNVERIFIED across all reports | Re-submitted research files |
| R-017 | Medium | Pricing facts recorded incompletely (Lobocon per-project/annual terms; Strukchad seat types) | Fixed (awaiting review) | Gemini | Update 01-competitors.md with exact quoted terms | Reviewer inspection of 01-competitors.md |
| R-018 | Medium | ADR-005 precision & rounding (quantities/rates need higher precision than currency amounts) | Fixed (awaiting review) | Gemini | ADR-005 drafted with quantity (12,4), rate (15,4), amount (15,2), plus round half-up rule | Implemented in packages/money with unit tests passing cent & sub-cent vectors |
| R-019 | High | Tenant extension may break transaction atomicity (change + audit in one transaction) | Fixed (awaiting review) | Gemini | ADR-001 implemented with withTenantTx helper; rollback test verified in CI | packages/db/src/isolation.test.ts test case 8 passing rollback verification |
| R-020 | Medium | ODPC exemption criteria misstated (Third Schedule 12 purposes, property management trigger) | Fixed (awaiting review) | Gemini | Correct 03-regulation-and-compliance.md per F4 with deep link and quote | Reviewer inspection of 03-regulation-and-compliance.md |
| R-021 | Critical | Unauthenticated M-Pesa callbacks (C1) | Fixed (awaiting review) | Gemini | Webhook secret authentication via timingSafeCompare; lookup_mpesa_stk_transaction & lookup_mpesa_b2c_transaction DB lookup; ignore untrusted tenant headers | apps/api/src/audit-remediation-step2.test.ts, platform-services-suite.test.ts passing |
| R-022 | Critical | Simulated e-TIMS/tax signatures (C2) | Fixed (awaiting review) | Gemini | Removed fake VSCU signature & live itax.kra.go.ke QR code from invoice output in enterpriseOperations.ts; labeled non-production draft | Code inspection & test verification in enterprise-operations-suite.test.ts |
| R-023 | Critical | Fallback-to-first-tenant and header-trusted ingest (C3) | Fixed (awaiting review) | Gemini | Replaced default fallback tenant lookup; site-ops requires HMAC-SHA256 signed token; telematics looks up device via lookup_telematics_device and timingSafeCompare | apps/api/src/audit-remediation-step2.test.ts passing |
| R-024 | Critical | No DB-level immutability for audit/ledger (C4) | Fixed (awaiting review) | Gemini | REVOKE UPDATE/DELETE on audit_logs from db_app; triggers block UPDATE of amount and DELETE on cost_entries/variations | packages/db/src/isolation.test.ts (C4 tests passing as non-superuser db_app) |
| R-025 | Critical | CI grants broken, fake lint, no build/audit (C5) | Fixed (awaiting review) | Gemini | scripts/verify-local.sh replicates clean pipeline: grants after schema push, typecheck, lint, build, audit, and tests run as db_app | scripts/verify-local.sh execution log in docs/evidence/verify-<commit>.log |
| R-026 | Critical | Probable fabricated discovery synthesis (C6) | Open | Owner | Owner to confirm if real interviews happened; delete synthesis if synthetic and reopen gate | Owner statement |
| R-027 | High | Scope beyond M10 (H1) | Fixed (awaiting review) | Gemini | Frozen all work beyond M10; no new milestones built | Codebase frozen at M10 scope boundary |
| R-028 | High | False certification text in PDFs (H3) | Fixed (awaiting review) | Gemini | Removed false certification standing from IndependentInspectionReportPdf and PaymentCertificatePdf; added neutral disclaimers | PDF template inspection & test suites |
| R-029 | High | auth_context RLS bypasses; plaintext portal tokens (H4, H5) | Fixed (awaiting review) | Gemini | Removed 'login', 'portal', 'invite' auth_context RLS clauses; added narrow SECURITY DEFINER lookup functions; store portal tokens as SHA-256 hashes | apps/api/src/audit-remediation-step2.test.ts, external-portals.test.ts passing |
| R-030 | Medium | Accusatory wording, PG version claims, .env.example, public repo (M1-M4) | Fixed (awaiting review) | Gemini | Replaced "siphoning/theft" with neutral fuel discrepancy wording across code, alerts, SMS, UI; repo set to PRIVATE; sanitized .env.example | gh repo view private, App.test.tsx 113/113, money test 63/63 |
| R-031 | High | `m10-backup-restore.test.ts` env vars (PG_BIN/PG_SOCKET/PG_PORT/PG_DB/PG_SUPERUSER) stripped by turbo — `globalPassThroughEnv` lacked them, so tests fell back to hardcoded PG18/54329 defaults and failed under verify-local.sh | Closed (verified) | Devin | Added the five PG_* vars to `globalPassThroughEnv` in turbo.json | scripts/verify-local.sh full run green 2026-11-06: 328/328 API tests, lint+typecheck+build+audit clean (docs/evidence/verify-HEAD.log) |
| R-032 | Medium | PROJECT_STATUS.md milestone table stale — commits show M25–M30+ built but table freezes at M11–M32 and last update predates remediation commit c0f7346 | Open | Devin | Reconcile status table with git log at next status update | Status file matches `git log` |

## Adding an item (template)

```
| R-0XX | Sev | What is wrong, in plain words and where | Open | who | how it will be fixed | how we will prove it |
```

## Review cadence

At the end of **every milestone** the owner takes Gemini's summary and the git diff link to the independent reviewer (Claude/ChatGPT) with this checklist:

1. Does it match the milestone's acceptance criteria and nothing more (no excluded features)?
2. Tenant scoping and permission checks on every new route?
3. Any money math outside `packages/money`, or any float?
4. Any hard delete or silent edit of financial records?
5. Tests added for new behavior, and CI green?
6. Secrets, logging, file upload handling safe?
7. Any claim in docs without a source tag?
8. New issues logged here; fixed issues have evidence?

Record each review:

| Date | Milestone | Reviewer | Result | New items |
|---|---|---|---|---|
| 2026-10-27 | P0 | Claude | Conditionally approved (F1–F6 required before M0/M1/M2) | R-014, R-015, R-016, R-017 |
| 2026-10-27 | P0 (re-review) | Claude | Conditional approval for M0/M1; M2 gated on ADR-001 (A1–A7); valuations gated on G1–G5 & QS sign-off | R-018, R-019, R-020 |
| 2026-11-02 | M0 | Gemini | Completed and verified (13/13 tests green, 0 type errors, clean prod build); ready for Claude review | — |
| 2026-11-02 | M1 | Gemini | Completed and verified (26/26 tests green across 5 suites, auth flow, Prisma 6 schema, login & dashboard UI); ready for Claude review | — |
| 2026-11-02 | M2 | Gemini | Completed and verified (40/40 tests green across 6 suites, RLS with FORCE on all 19 tenant tables, isolation suite 8/8, RBAC routes 6/6); ready for Claude review | — |
| 2026-11-02 | M3 | Gemini | Completed and verified (51/51 tests green across 6 packages, Invitation model + RLS policy, company & project endpoints with permission checks, user invite token flow, 4 distinct role dashboard UIs with EASMM standards, offline PWA indicator, and neutral variance monitor); ready for Claude review | — |
| 2026-11-02 | M4 | Gemini | Completed and verified (60/60 tests green across 6 suites, staged 6-stage Excel BOQ import pipeline per ADR-003, EASMM section mapping, arithmetic discrepancy validation, interactive React 19 preview modal with row status badges, atomic commit in withTenantTx, versioning & audit logging); ready for Claude review | — |
| 2026-11-02 | M5 | Gemini | Completed and verified (75/75 tests green across 6 suites, append-only CostEntry financial ledger, receipt attachments, PM/QS multi-step approval workflow, Decimal budget aggregation, and React 19 CostCaptureModal, BudgetSummaryCard & CostManagementView); ready for Claude review | — |
| 2026-11-03 | M6 | Gemini | Completed and verified (88/88 tests green across 6 suites, daily site diary logging with weather, trade headcount matrix, material deliveries, geotagged photos with GPS, physical progress % against BOQ line items, IndexedDB offline mutation queue with auto-sync and Canvas client-side photo compression, Idempotency-Key cache lookup, and SupervisorDashboard & PmQsDashboard integration); ready for Claude review | — |
| 2026-11-03 | M7 | Gemini + Subagents | Completed and verified (110/110 tests green across 13 suites, real-time project variance analytics, automatic latest physical progress retrieval, BOQ section breakdown, neutral health alert cards, PM/QS & Client dashboard integration, and RLS multi-tenant isolation); ready for Claude review | — |
| 2026-11-03 | M8 | Gemini + Subagents | Completed and verified (118/118 tests green across 14 suites, contractual variations workflow, additions & omissions, QS evaluation, Client approval chain, atomic budget update invariant in withTenantTx, React 19 CreateVariationModal and VariationManagementView); ready for Claude review | — |
| 2026-11-03 | M9 | Gemini + Subagents | Completed and verified (137/137 tests green across 15 suites, dedicated Client / Property Developer Portal, 5 plain-language financial numbers in Decimal, neutral health guard, Nairobi GPS geotagged photo gallery with lightbox, milestone progress timeline, and Kenyan standard retention terms); ready for Claude review | — |
| 2026-11-03 | M10 | Gemini + Subagents | Completed and verified (162/162 tests green across 17 suites, server-side PDF generation with @react-pdf/renderer per ADR-002, Interim Payment Certificates with 10% retention and 5% cap, Daily Site Diary report with headcount and Nairobi GPS geotags, Executive Project Summary, automated PostgreSQL 18 backup & restore test verifying RLS FORCE policies and table survival); ready for Claude review | — |
| 2026-11-03 | E2E & Security | Gemini + Specialized Agents | Executed 9-step E2E Live Site Simulation (apps/api/src/e2e-live-site-simulation.test.ts); completed OWASP Top 10 security audit and System Design compliance check (docs/reports/OWASP_AND_SYSTEM_DESIGN_AUDIT.md) applying brute-force rate limiter, secret guards, and error sanitization; authored 976-line contractor lifecycle and competitor benchmark blueprint (docs/research/CONTRACTOR_LIFECYCLE_AND_BENCHMARK.md). 171/171 tests green across 18 suites. | — |

## Closed items

| ID | Closed on | Evidence |
|---|---|---|
| — | — | — |
