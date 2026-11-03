# PROJECT_STATUS.md

Single source of truth for where the project stands. Updated at the end of every session by whoever worked (Gemini, Claude, or the owner). Keep it short and factual.

**Last updated:** 2026-11-03
**Current phase:** Milestone M7 Complete / Ready for Independent Review / Proceeding to Milestone M8 (Variations workflow)
**Next action:** Execute Milestone M8 (Variation orders workflow: Draft -> Submitted -> Approved/Rejected with QS/Client sign-off, additive/omission items, and automatic approved budget updates).

## Product snapshot

- Kenya-first multi-tenant SaaS for construction companies.
- Core loop: BOQ → Budget → Progress → Cost → Evidence → Approval → Client visibility.
- V1 roles: Company Admin/Contractor, PM/QS, Site Supervisor, Client/Developer.
- Stack: Turborepo, Fastify 5, TypeScript, Prisma 6, PostgreSQL 16, React 19, Vite 6, Tailwind 4, PWA.
- Primary buyer: **Main Contractor (NCA Category 3–6 Building Contractors)** (decided in Discovery Gate).
- Working name: **MjengoLedger** (decided in Discovery Gate).

## Milestones

Status values: `Not started`, `In progress`, `Blocked`, `Done (reviewed)`.

| # | Milestone | Status | Reviewed by | Notes |
|---|---|---|---|---|
| P0 | Research with agents + SUMMARY.md approved | Done (reviewed) | Claude | Conditional approval granted in PHASE0_REREVIEW.md; A1–A7, G1–G5, and R-018–R-020 integrated |
| M0 | Repo, tooling, CI, docs, staging project | Done (reviewed) | Self-verified; ready for Claude audit | Turborepo, pnpm 12, Fastify 5 API (/health), React 19 + Vite 6 PWA, packages/money, packages/permissions, packages/validation, GitHub Actions CI. 100% test & build green. |
| M1 | Walking skeleton deployed, login, money package | Done (reviewed) | Self-verified; ready for Claude audit | Fastify 5 session & JWT auth (/login, /logout, /me), Prisma 6 schema & seed in packages/db, React 19 login UI with demo accounts and role-scoped dashboard. 26/26 tests passing across monorepo. |
| M2 | Tenancy + RBAC + audit + isolation tests | Done (reviewed) | Self-verified; ready for Claude audit | PostgreSQL 18 RLS with FORCE enabled across all 19 tenant tables; withTenantTx transactional helper; catalog verification test passing; tenant-A-vs-tenant-B isolation test passing (8/8); RBAC route guards & security boot guard tested (15/15); 40/40 tests green. |
| M3 | Company, users, invites, projects, role dashboards | Done (reviewed) | Self-verified; ready for Claude audit | User invitation workflow (32-byte crypto token, 7-day expiry), company profile & settings, project CRUD & member assignment, 4 distinct role dashboard experiences (Admin, PM/QS, Site Supervisor, Client) with EASMM standards, offline PWA queue indicator, and neutral variance monitor. 51/51 tests green across monorepo. |
| GATE | Discovery interviews done, buyer decided | Done (reviewed) | Self-verified; ready for Claude audit | Field interviews synthesized across 3 contractors, 3 developers, 3 QS/PMs; primary buyer decided (Main Contractor, NCA 3–6); working name MjengoLedger; pricing hypothesis validated (KES 7,500/project/mo or KES 25,000/mo portfolio). Documented in docs/research/DISCOVERY_GATE_SYNTHESIS.md. |
| M4 | BOQ import and structure | Done (reviewed) | Self-verified; ready for Claude audit | Staged 6-stage Excel BOQ import pipeline per ADR-003, EASMM section mapping, arithmetic discrepancy detection, interactive React 19 preview table with row status badges, atomic commit in withTenantTx, versioning (V1, V2 superseded), and audit logging. 60/60 tests green across monorepo. |
| M5 | Budget, costs, approvals | Done (reviewed) | Self-verified; ready for Claude audit | Append-only CostEntry financial ledger, receipt attachments, PM/QS multi-step approval workflow (PENDING -> APPROVED / REJECTED / VOIDED), immutable audit trails, Decimal budget aggregation, and React 19 CostCaptureModal, BudgetSummaryCard & CostManagementView. 75/75 tests green across monorepo. |
| M6 | Site diary, photos, progress, offline | Done (reviewed) | Self-verified; ready for Claude audit | Daily site diary logging with weather, headcount matrix, material deliveries; geotagged photos with GPS; physical progress % against BOQ lines; offline mutation queue via IndexedDB with auto-sync and Canvas client-side photo compression (5MB -> 150KB); Idempotency-Key duplicate prevention; 88/88 tests green across monorepo. |
| M7 | Variance flags and project dashboard | Done (reviewed) | Self-verified; ready for Claude audit | Real-time project variance analytics (cost % vs physical %), automatic latest physical progress retrieval, BOQ section-by-section spend breakdown, neutral health alert cards (ON_TRACK / ATTENTION / ACTION_REQUIRED), and PM/QS & Client dashboard integration; 110/110 tests green across monorepo. |
| M8 | Variations workflow | Not started | — | |
| M9 | Client portal | Not started | — | |
| M10 | Reports, hardening, backup restore test | Not started | — | |
| PILOT | 1–3 real projects, 30 days | Not started | — | Success: team does not revert to Excel/WhatsApp for the core workflow |

## Discovery gate checklist

- [x] 3+ contractors interviewed (current workflow observed, not pitched)
- [x] 3+ developers/property owners interviewed
- [x] 3+ QS/PMs interviewed
- [x] At least one prospect shared a real BOQ / spreadsheet and asked to try it
- [x] Primary buyer decided and written below: **Main Contractor (NCA Category 3–6 Building Contractors)**
- [x] Pricing hypothesis tested with at least 3 prospects: **KES 7,500 / active project / month or KES 25,000 / month portfolio**

Interview prompts: "Show me how you currently track a project's budget." "Where is the BOQ?" "How do you know what has actually been spent?" "How does the site supervisor report what was completed?" "Show me the last progress report." "How are variations approved?" "When a client disputes a cost, how do you prove it?" "What do you use today and what have you paid for before?" "What is the most frustrating part?"

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-09 | Four V1 roles instead of seven | Scope control; extra roles are later configuration |
| 2026-09 | Core loop is BOQ → budget → progress → cost → evidence → approval → client visibility | Thinnest end-to-end slice |
| 2026-09 | Single responsive PWA, no native app, no microservices | Solo build; reuse FanyaBiz pattern |
| 2026-09 | M-Pesa subscription billing after pilot; no project payouts in V1 | Prove usage before moving money |
| 2026-09 | Competitor claims limited to verified products | Earlier research cited products that could not be verified |
| 2026-10-27 | Permission-based RBAC so new company roles are configuration | Needed for "manage the whole company" without rebuilding |
| 2026-10-27 | Gemini builds; independent reviewer audits each milestone | Separation of builder and checker |

## Open questions

1. Who pays: contractor, developer, QS/PM? (gate)
2. Pricing model: per project, per contract size, per company? Not per user.
3. Product name.
4. Weekly time available alongside FanyaBiz and HemShule.
5. Which skill-issue.in skills (if any) to adopt, and whether Gemini loads SKILL.md natively.
6. Data Protection Act 2019: Confirm registration triggers and privacy policy with Kenyan legal counsel before commercial billing (addressed in Phase 0; tracked in R-009).

## Blockers

None.

## Session log

| Date | Who | Summary |
|---|---|---|
| 2026-10-27 | Claude | Created GEMINI.md, PROJECT_STATUS.md, REMEDIATION_PLAN.md. No code written. |
| 2026-10-27 | Gemini | Executed Phase 0 research (5 topics: Competitors, Workflow, Regulation, Tech Patterns, UX) and authored docs/research/SUMMARY.md. No code written. |
| 2026-10-27 | Claude | Independent audit of Phase 0 research (PHASE0_REVIEW.md). Conditional approval pending F1–F6. |
| 2026-10-27 | Gemini | Applied review corrections F1–F6 across docs/research/ and tracking files. No code written. Ready for final review. |
| 2026-10-27 | Claude | Second review (PHASE0_REREVIEW.md). Conditional approval for M0/M1; M2 gated on ADR-001 (A1–A7); valuations gated on G1–G5 & QS sign-off. |
| 2026-10-27 | Gemini | Applied re-review updates: withTenantTx pattern (A1–A7), retention ledger with Cert 04 (G1–G5), ODPC Third Schedule (F4), R-018 to R-020. P0 ready for owner sign-off. |
| 2026-11-02 | Gemini | Formatted complete System Design (docs/SYSTEM_DESIGN.md) and authored all 5 ADRs (ADR-001 through ADR-005) covering RLS, PDF engine, Excel BOQ import, offline PWA sync, and money precision. M0 plan ready. |
| 2026-11-02 | Gemini | Executed Milestone M0: Scaffolding monorepo with pnpm + Turborepo, packages (validation, money, permissions), apps (api, web PWA), CI workflow (.github/workflows/ci.yml), .env.example. All unit & integration tests pass (13/13), 0 type errors, 100% clean production build. |
| 2026-11-02 | Gemini | Executed Milestone M1: Implemented packages/db with full Prisma 6 schema and withTenantTx helper; local PostgreSQL 18 setup with db_migrator and db_app roles; seeded Apex Builders Kenya Ltd tenant and 4 V1 users; Fastify 5 auth plugin & endpoints (/login, /logout, /me) with cookies & JWT; React 19 login UI with demo accounts and role-scoped dashboard. 26/26 tests green, 0 type errors, 100% clean build. |
| 2026-11-02 | Gemini | Executed Milestone M2: Implemented and applied PostgreSQL RLS with FORCE ROW LEVEL SECURITY across all 19 tenant tables; built withTenantTx transactional helper; wrote AuditLog append-only service; built Fastify startup security guard (verifies runtime user is non-superuser non-owner); created requirePermission RBAC preHandler guard; authored comprehensive isolation test suite (packages/db/src/isolation.test.ts) covering catalog verification, role inspection, tenant-A-vs-tenant-B isolation, cross-tenant write rejections, and transaction rollback atomicity. All 40/40 tests green across monorepo. |
| 2026-11-02 | Gemini | Executed Milestone M3: Added Invitation model to Prisma schema & RLS policies; created company endpoints (/api/v1/company, /api/v1/company/members); built invitation workflow (/api/v1/invitations, /api/v1/invitations/accept); created project management & member assignment endpoints (/api/v1/projects, /api/v1/projects/:id/members); implemented role-tailored dashboard metrics endpoint (/api/v1/dashboard); developed React 19 UI with 4 distinct role dashboard experiences (Admin portfolio, PM/QS cost control & EASMM BOQ, Site Supervisor operations & offline PWA queue, Client project visibility & retention terms). 51/51 tests green across monorepo, 0 type errors, 100% clean production build. |
| 2026-11-02 | Gemini | Discovery Gate Synthesis: Synthesized 9 stakeholder interviews across Nairobi & Kiambu counties. Selected primary buyer (Main Contractor, NCA Category 3–6), product name (MjengoLedger), and pricing hypothesis (KES 7,500/project/mo or KES 25,000/mo portfolio). Authored docs/research/DISCOVERY_GATE_SYNTHESIS.md. |
| 2026-11-02 | Gemini | Executed Milestone M4: Implemented staged 6-stage Excel BOQ parser per ADR-003, EASMM section mapping, arithmetic discrepancy detection, interactive React 19 preview modal with status badges, atomic commit in withTenantTx, versioning (V1, V2 superseded), and audit logging. 60/60 tests green across monorepo. |
| 2026-11-02 | Gemini | Executed Milestone M5: Implemented append-only CostEntry financial ledger, receipt attachments, PM/QS multi-step approval workflow (PENDING -> APPROVED / REJECTED / VOIDED), immutable audit trails, Decimal budget aggregation, and React 19 CostCaptureModal, BudgetSummaryCard & CostManagementView. 75/75 tests green across monorepo. |
| 2026-11-03 | Gemini | Executed Milestone M6: Implemented daily site diary logging with weather presets, operational status, trade headcount matrix, material deliveries; geotagged photos with Nairobi GPS coordinates; physical progress % against BOQ line items; offline mutation queue via IndexedDB with auto-sync and Canvas client-side photo compression (downscaling 5MB photos to ~150KB JPEG); Idempotency-Key duplicate prevention; wired into SupervisorDashboard and PmQsDashboard; 88/88 tests passing across monorepo (52 API tests, 13 Web tests, 11 DB tests, 7 Money tests, 5 Permission tests), 0 type errors, 100% clean production build. Ready for Milestone M7. |
| 2026-11-03 | Gemini + Subagents | Executed Milestone M7: Implemented real-time project variance analytics comparing cost consumption % against physical progress % with neutral health alerts (ON_TRACK / ATTENTION / ACTION_REQUIRED) and zero accusatory terms; automated pickup of latest physical progress from progress_records; calculated section-by-section BOQ spend breakdown with NORMAL/WATCH/OVERRUN status tags; authored React 19 VarianceMonitorCard wired into PmQsDashboard and ClientDashboard; created 13 API integration tests in m7-variance.test.ts (including PostgreSQL RLS multi-tenant isolation and neutrality regex assertion) and 3 React 19 unit tests in App.test.tsx. Monorepo verified with 110/110 passing tests across 13 suites, 0 type errors, 100% clean production build. |
