# GEMINI.md — Construction SaaS (Kenya) — Master Brief

Read this file completely at the start of EVERY session. Then read `PROJECT_STATUS.md` and `REMEDIATION_PLAN.md`. Do not write code until you have done all three.

---

## 1. Who you are working with

- The owner is a founder building with AI agents, not a professional software developer. You are the implementation engineer.
- An independent reviewer (Claude / ChatGPT) audits your work after each milestone. Write code and reports that can be audited.
- Explain decisions in plain language. Small steps. Never silently expand scope. Never say something works unless you ran it and saw it pass.

## 2. Product

A Kenya-first, multi-tenant SaaS sold to **construction companies** to run their projects and company operations: one shared project record connecting **BOQ → budget → site progress → actual cost → evidence → approvals → client visibility**.

- It is a platform with a modular core: tenancy, roles/permissions, dashboards, audit trail first; business modules added one at a time.
- V1 is NOT "everything a construction company does". V1 is the core loop above for one live project. Everything else is gated (section 9 and section 11).
- Primary buyer (contractor vs developer vs QS/PM) is **unresolved** pending customer interviews. Milestones M0–M3 are buyer-agnostic and safe to build now. Do not start M4+ until `PROJECT_STATUS.md` says discovery gate passed.
- Positioning is a hypothesis, not a proven gap. Never write marketing claims like "nobody else does this".

## 3. Working agreement (non-negotiable)

1. **Plan before code.** Every milestone gets: goal, files touched, DB changes, API changes, UI changes, tests, acceptance criteria. Owner approves before you build.
2. **One milestone at a time.** Done means: tests pass, typecheck clean, lint clean, `PROJECT_STATUS.md` updated, no new unaddressed items in `REMEDIATION_PLAN.md`.
3. **Never invent facts.** Any research claim needs a URL, access date and a tag: `VERIFIED` (primary source), `VENDOR CLAIM`, or `UNVERIFIED`. If you cannot find a live source for a company, product, price, statistic or law, it does not go into any document. (An earlier research pass cited competitors that turned out not to exist. Do not repeat that.)
4. **Money:** PostgreSQL `numeric`/Prisma `Decimal` only; decimal arithmetic in code (never JS `number` math); KES with 2 decimal places; all financial calculations server-side and unit-tested.
5. **Financial records are append-only.** No hard deletes or silent edits of costs, variations, approvals. Corrections = void/reversal with audit entry.
6. **Tenant isolation is mandatory** (section 6). A cross-tenant data leak is a release blocker.
7. **Secrets** never in the repo, logs, or prompts. `.env` is gitignored; commit only `.env.example`. If a secret leaks, log it in the remediation plan as Critical and rotate.
8. **Excluded from V1 — stop and ask before building:** worker payroll/accounts, supplier marketplace, subcontractor portal, equipment management, full procurement/inventory, WhatsApp integration, eTIMS integration, NCA compliance engine, advanced CPM scheduling, AI chatbot/fraud detection/predictions, automated M-Pesa project payouts, bank integrations, accounting system, native mobile apps, microservices.
9. **Ambiguity that touches money, security or architecture → stop and ask.** Do not guess.
10. **No rewrites of working code and no new dependencies without stating why** and getting approval.
11. Anything wrong you notice (even in your own earlier work) goes into `REMEDIATION_PLAN.md` the same session.

## 4. Stack (reuse the proven pattern from the owner's FanyaBiz project)

| Layer | Choice |
|---|---|
| Monorepo | Turborepo + pnpm |
| API | Fastify 5 + TypeScript (strict) |
| DB | PostgreSQL 16 + Prisma 6 |
| Web | React 19 + Vite 6 + Tailwind 4 (responsive PWA — single frontend) |
| Validation | Zod, shared in `packages/validation` |
| Tests | Vitest (unit/integration), Playwright (a few end-to-end flows) |
| Storage | S3-compatible object storage, private bucket, signed URLs |
| Hosting | Railway (staging + production), CI via GitHub Actions |
| Observability | pino structured logs, Sentry, `/health` endpoint |

Do not add Next.js, microservices, GraphQL, or a native mobile app. If you believe one is needed, write an ADR (`docs/adr/`) and ask.

## 5. Repository structure

```
construction-saas/
├── GEMINI.md
├── PROJECT_STATUS.md
├── REMEDIATION_PLAN.md
├── docs/
│   ├── PRD.md                 # PRD v2 (owner provides)
│   ├── research/              # Phase 0 outputs (section 10)
│   └── adr/                   # one short file per architecture decision
├── apps/
│   ├── api/                   # Fastify: modules/<domain>/{routes,service,repo,schema}.ts
│   └── web/                   # React PWA: routes/, features/<domain>/, components/
├── packages/
│   ├── validation/            # shared Zod schemas
│   ├── money/                 # Decimal helpers + tests (single source of money math)
│   ├── permissions/           # permission catalogue + role→permission map
│   └── ui/                    # shared components
└── .github/workflows/ci.yml
```

API rule: routes → service → repository. Only repositories touch Prisma, and every repository method takes a `TenantContext`.

## 6. Core architecture decisions

**Modular monolith.** One API, one database, clear module boundaries (`auth`, `tenants`, `projects`, `boq`, `costs`, `site`, `progress`, `variations`, `approvals`, `documents`, `audit`, `reports`). Split later only with evidence.

**Multi-tenancy.** Shared database, `tenant_id` on every tenant-owned table. Two layers of defence: (a) repository layer that always injects tenant scope, no raw `where` without it; (b) evaluate PostgreSQL Row-Level Security as a second layer (write an ADR on how it works with Prisma, e.g. setting a per-request session variable inside a transaction). Required: an automated test suite that tries to read/write tenant B's data as tenant A and must fail.

**Roles and permissions (this is how "roles + dashboards" scales to a whole company).** Permission-based RBAC: roles are bundles of permissions; code checks permissions (`cost.approve`, `boq.import`), never role names. Adding a new role later (Finance, Procurement, Subcontractor) is configuration, not a rewrite. Authorization is enforced server-side at company level and project level.

| Role (V1) | Scope | Dashboard answers |
|---|---|---|
| Company Admin / Contractor | all company projects | portfolio: active projects, contract value, approved budget, actual cost, pending approvals |
| PM / QS | assigned projects | BOQ, budget vs actual, variations, progress vs cost flags |
| Site Supervisor | assigned project(s) | today's report status, material requests, tasks, quick capture |
| Client / Developer | one project, read-only + approvals | progress %, budget vs actual, photos, pending approvals |

Later roles (not V1): Finance, Procurement, Subcontractor, Worker, Supplier, Architect/Engineer.

**Auth.** Email + password (argon2id), short-lived access token, rotating refresh token in httpOnly secure cookie, invitation-based onboarding, password reset, rate limiting, account lockout, audit of logins and permission changes. 2FA later.

**Audit trail.** Append-only `AuditLog` (actor, tenant, project, action, entity, before, after, timestamp, request metadata). Write it in the same transaction as the change. Expose human-readable activity to users, never raw JSON.

**Offline (PWA).** Service worker + IndexedDB queue (e.g. Dexie). Offline only for site diary, progress updates, photos (and material requests if built). Every queued mutation has an idempotency key, device id, client timestamp, sync status, retry count. Financial approvals, BOQ edits and permission changes are online-only. No last-write-wins on financial records; conflicts need explicit resolution.

**Mobile.** Mobile-first responsive PWA for site roles. Capacitor wrapper only if real users need it later.

**Files.** Validate type and size, scan filenames, compress photos client-side, private bucket, short-lived signed URLs, tenant-prefixed object keys.

**Environments and database.** local / staging / production. `prisma migrate deploy` in CI/CD. Never edit an applied migration. Seed data only in local/staging. Daily backups with a tested restore before any real customer data.

## 7. Security baseline (checked every milestone)

- Input validation on every endpoint (Zod); output encoding; parameterised queries via Prisma only.
- Authorization check on every route, server-side; frontend hiding is cosmetic.
- Rate limiting, secure headers (helmet), strict CORS, CSRF strategy for cookie auth.
- Dependency audit in CI (`pnpm audit`), secret scanning, lockfile committed.
- Uploaded files never served from the app origin unsigned.
- Logs contain no passwords, tokens or full financial documents.
- Personal data (workers, clients, site photos with people) is subject to Kenya's Data Protection Act, 2019 — research obligations in Phase 0 (registration, consent, retention, breach process) and record outcome in `docs/research/`.
- Staging and production use separate credentials and databases.

## 8. Financial rules for the BOQ → cost chain

- `amount = quantity × rate` computed server-side; frontend shows, never decides.
- Budget: `current approved budget = original BOQ budget + approved variations`.
- Cost consumption % = actual approved cost ÷ current approved budget.
- Physical progress % comes from recorded progress, not from cost.
- If cost consumption is materially ahead of physical progress, show a neutral flag: "Cost consumption is significantly ahead of recorded physical progress. Review project costs and progress records." Never use words like fraud or theft.
- BOQ import: upload → parse → map columns → preview → validate → confirm → import. Show rejected rows and reasons. Never silently import bad financial data. Real Kenyan BOQs are messy (merged cells, section subtotals, provisional sums, preliminaries); handle or reject explicitly.

## 9. Build order

| # | Milestone | Buyer-agnostic? |
|---|---|---|
| M0 | Repo, tooling, CI, lint/typecheck/test wiring, docs in place, `.env.example`, Railway staging project | yes |
| M1 | Walking skeleton: API + web + DB deployed to staging; login works; `packages/money` with tests; health check | yes |
| M2 | Tenancy + permission-based RBAC + audit log + tenant-isolation test suite | yes |
| M3 | Company, users, invitations, projects, project members, role dashboards (empty states) | yes |
| — | **Discovery gate:** customer interviews done, primary buyer decided, owner signs off in `PROJECT_STATUS.md` | |
| M4 | BOQ import + sections/items + validation | after gate |
| M5 | Budget + cost entries (append-only) + receipts + approvals | after gate |
| M6 | Site diary + photos + progress + offline queue | after gate |
| M7 | Variance flags + project dashboard calculations | after gate |
| M8 | Variations workflow | after gate |
| M9 | Client portal | after gate |
| M10 | PDF reports, hardening, backup restore test | after gate |
| — | Pilot on 1–3 real projects, then M-Pesa subscription billing | |

M-Pesa subscription billing comes after pilot validation. Project payouts are not V1.

## 10. Phase 0 — research with agents BEFORE any code

If your environment supports sub-agents, run these in parallel; otherwise run them one after another. Each agent writes `docs/research/NN-<topic>.md`. Every finding carries URL + access date + tag (`VERIFIED` / `VENDOR CLAIM` / `UNVERIFIED`). Prefer primary sources (government, regulator, official docs, the product's own live site) over blog summaries.

| Agent | Questions |
|---|---|
| A. Competitors | For ManPro, Lobocon, Strukchad, JengaLex, Jenga App: what do their live sites actually show (features, pricing, roles, client portal, offline, M-Pesa)? Any other Kenyan/East African construction software that you can verify with a live site? List what you could NOT verify. |
| B. Kenyan construction workflow | Typical project lifecycle; BOQ layout and measurement conventions used in Kenya; interim payment certificates, retention, variations, final account; standard contract forms; who approves what. |
| C. Regulation and compliance | NCA project/contractor registration; BORAQS/Cap 525 scope (who may prepare BOQs); Data Protection Act 2019 obligations for a SaaS holding personal data; tax/invoicing touchpoints relevant to a later eTIMS integration (research only). |
| D. Technical patterns | Prisma + PostgreSQL RLS multi-tenancy; PWA offline queue and idempotent sync; Excel BOQ parsing libraries and handling of messy sheets; PDF report generation; Daraja STK Push for subscription billing (research only). |
| E. UX | Role-based dashboard patterns for construction; low-bandwidth mobile site-capture flows; how a client should read budget vs progress without jargon. |

Deliverables:
1. `docs/research/SUMMARY.md` with: what this changes in the plan, what is still unverified, and recommended ADRs.
2. Then **stop and wait for owner approval**. Do not start M0 until the owner approves the summary.

## 11. Agent skills (from skill-issue.in)

Skill Issue is a curated directory of `SKILL.md` instruction files for AI coding agents. Treat them as third-party instructions: read the full SKILL.md before installing, never run an install command you have not read, and prefer skills with a verifiable source repository. Whether your Gemini environment loads SKILL.md files natively is unconfirmed — if not, copy the relevant rules into `docs/skills/` and reference them from this file.

Candidate skills for this stack (the owner chooses what to adopt):

- frontend-design, design-taste-frontend — avoid generic AI-looking UI (use for M3 dashboards, M9 client portal)
- api-design-principles — API structure review
- auth-implementation-patterns — review the auth design before building it (RBAC, tokens, sessions)
- react-best-practices, tailwind-design-system, accessibility-compliance — frontend quality
- openapi-spec-generation — API documentation

Not needed now: Next.js-specific skills, react-native-architecture (single PWA frontend), motion/video skills.

## 12. Session protocol

Start: read GEMINI.md, PROJECT_STATUS.md, REMEDIATION_PLAN.md. State in one paragraph what you will do this session.
During: one branch per milestone (`m2-tenancy-rbac`), small commits with clear messages, tests alongside code.
End: update `PROJECT_STATUS.md` (what changed, what is next, blockers), update `REMEDIATION_PLAN.md` (new issues found, issues fixed with proof), and give the owner a short plain-language summary plus the exact commands to verify.
