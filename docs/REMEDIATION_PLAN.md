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
| R-002 | High | Primary buyer unknown (contractor vs developer vs QS/PM); building M4+ on a guess could waste months | Closed (verified) | Owner + Gemini | Discovery gate synthesized across 3 contractors, 3 developers, 3 QS/PMs; Main Contractor (NCA 3–6) chosen with project SaaS model (KES 7,500/mo) | docs/research/DISCOVERY_GATE_SYNTHESIS.md approved and checklist completed |
| R-003 | High | Scope creep from "manage everything in the company" | Mitigated | Owner + Gemini | Excluded list, one milestone at a time, permission-based RBAC so roles/modules are added later as configuration | Review at each milestone |
| R-004 | High | Cross-tenant data leakage | Fixed (awaiting review) | Gemini | PostgreSQL 18 RLS with FORCE enabled across all 19 tenant tables; withTenantTx transactional helper; startup guard rejects superuser/owner roles | packages/db/src/isolation.test.ts 8/8 tests green, pg_class catalog check passing |
| R-005 | High | Money handled with floating point or frontend-calculated totals | Fixed (awaiting review) | Gemini | `packages/money` using `decimal.js`, server-side calculations only, strict 2-dec currency, 4-dec rates & quantities | packages/money/src/index.test.ts passing 7/7 unit tests |
| R-006 | High | Secrets committed or logged | Mitigated | Gemini | `.gitignore`, `.env.example` only, secret scanning in CI, separate staging/production credentials | CI check passing (.github/workflows/ci.yml) and git status verified |
| R-007 | Medium | Offline sync conflicts corrupting records | Open | Gemini | Offline limited to diary/progress/photos; idempotency keys; no last-write-wins on money | Sync tests in M6 |
| R-008 | Medium | AI-generated code that nobody can maintain or verify (solo, non-developer owner) | Open | Owner + reviewer | Small milestones, tests with every feature, independent review at each milestone, ADRs for decisions | Review log below |
| R-009 | Medium | Data Protection Act 2019 obligations | Mitigated | Owner + Gemini | Fix F4 wording; confirm with lawyer/ODPC; eTIMS before billing | Written confirmation |
| R-010 | Medium | Backups never restore-tested | Open | Gemini | Daily backups, documented restore, tested before any real customer data | Restore test record (M10 at latest) |
| R-011 | Medium | Third-party agent skills (skill-issue.in) are unvetted instructions; some listings are marked unverified by the site itself | Open | Owner | Read full SKILL.md before adopting; prefer skills with a verifiable source repo; never run unread install commands | Adopted-skills list in PROJECT_STATUS.md |
| R-012 | Medium | Real Kenyan BOQ spreadsheets are messy (merged cells, subtotals, provisional sums); import could mis-read money | Fixed (awaiting review) | Gemini | Staged 6-stage Excel BOQ import pipeline per ADR-003, EASMM section mapping, arithmetic discrepancy validation, interactive preview table, and atomic commit | apps/api/src/m4-boq.test.ts 8/8 tests green, apps/web/src/components/BoqImportModal.tsx UI tested |
| R-013 | Low | Product name undecided; time split with FanyaBiz/HemShule unclear | Closed (verified) | Owner | Decided in Discovery Gate: MjengoLedger; focus dedicated to NCA 3–6 contractor SaaS | docs/research/DISCOVERY_GATE_SYNTHESIS.md |
| R-014 | High | RLS design would not isolate tenants (no FORCE, restrictive-only policy, query not bound to transaction) | Fixed (awaiting review) | Gemini | ADR-001 implemented with FORCE RLS, permissive policy with USING & WITH CHECK, NULLIF fail-closed, db_app non-owner role | packages/db/src/isolation.test.ts passing all catalog, role & cross-tenant tests |
| R-015 | High | IPC/retention formula incomplete (missing release term, tax unaddressed, cap base floating) | Open | Gemini + Owner | G1–G5, QS validation before any valuation feature | QS sign-off recorded |
| R-016 | Medium | Sources not checkable (domain roots and unsourced numbers) | Open | Gemini | Deep link + quote, or UNVERIFIED across all reports | Re-submitted research files |
| R-017 | Medium | Pricing facts recorded incompletely (Lobocon per-project/annual terms; Strukchad seat types) | Fixed (awaiting review) | Gemini | Update 01-competitors.md with exact quoted terms | Reviewer inspection of 01-competitors.md |
| R-018 | Medium | ADR-005 precision & rounding (quantities/rates need higher precision than currency amounts) | Fixed (awaiting review) | Gemini | ADR-005 drafted with quantity (12,4), rate (15,4), amount (15,2), plus round half-up rule | Implemented in packages/money with unit tests passing cent & sub-cent vectors |
| R-019 | High | Tenant extension may break transaction atomicity (change + audit in one transaction) | Fixed (awaiting review) | Gemini | ADR-001 implemented with withTenantTx helper; rollback test verified in CI | packages/db/src/isolation.test.ts test case 8 passing rollback verification |
| R-020 | Medium | ODPC exemption criteria misstated (Third Schedule 12 purposes, property management trigger) | Fixed (awaiting review) | Gemini | Correct 03-regulation-and-compliance.md per F4 with deep link and quote | Reviewer inspection of 03-regulation-and-compliance.md |

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

## Closed items

| ID | Closed on | Evidence |
|---|---|---|
| — | — | — |
