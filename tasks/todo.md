# tasks/todo.md — active plan

## Current: Claude re-audit remediation + Gate-4 S1 completion + S2 invoicing (2026-11-07)

### Security remediation (Claude items 1-2)
- [x] Purge `docs/research/console-audit/screenshots/` from ALL git history (filter-repo); dir absent from tree
- [x] Redact POWELL/JUMUIA/MAKUNDI/client+role names & emails across all .md files
- [x] CREATED_RECORDS.md credential-exposure correction noted
- [x] Force-pushed rewritten branch; created private repo `parrot-y/construction-platform` and pushed branch

### C-01 / C-03 (Claude items 3-4)
- [x] `apps/api/src/route-guard.test.ts` — CI guard: every route needs `server.authenticate` or explicit allowlist entry (16 allowlisted: login, HMAC webhooks, token portals, M-Pesa callbacks, public quotes)
- [x] Decimal money math (ADR-005) in quotes + invoices: `calculateLineTotal`/`toDecimal`, line sum == subtotal, HALF_UP cents

### S1 hardening (Claude item 4)
- [x] `valid_until` enforced on BOTH respond endpoints (lazy EXPIRED flip committed via sentinel return, not tx rollback)
- [x] `expire_quotes_batch()` SECURITY DEFINER job in rls.sql + 15-min interval in quotesRoutes
- [x] Atomic accept/decline via `updateMany({status:'SENT'})` count guard (TOCTOU-safe)
- [x] `quote_no` P2002 retry loop (3 attempts)
- [x] Public-route rate limit: 30 req/min/IP in-memory sliding window on `/api/public/quotes/*`
- [x] VIEWED event dedupe: max 1 per hour per quote
- [x] Deposit invoice auto-draft on convert (`createDepositInvoice` → Invoice DRAFT linked to project+quote)

### S2 invoicing (was in-flight, completed)
- [x] Schema: Invoice/InvoiceLineItem/InvoicePayment (RLS auto-covered)
- [x] Routes: CRUD, send, payments (Decimal, overpay guard), void, derived OVERDUE, PDF
- [x] `InvoicePdf.tsx` + InvoicingView.tsx wired into PM/QS + CompanyAdmin
- [x] `invoices.test.ts` — 15 tests

### Tests added (Claude item 5)
- [x] quotes.test.ts: +8 tests — Decimal rounding, lazy expiry, batch expiry job, client-side expiry, atomic double-respond, VIEWED dedupe, rate limit 429, deposit invoice
- [x] App.test.tsx: +4 Gate-4 UI tests (quotes/invoicing shells + dashboard embeds)

### Pending
- [x] verify-local.sh green: 571/571 tests (372 API, 117 web, 63 money, 15 db, 4 permissions); evidence `docs/evidence/verify-6678fcd.log`
- [x] PROJECT_STATUS.md updated (security remediation, private repo, C-01/C-03, S1 hardening, S2 invoicing)
- [ ] Commit + push final head to `parrot-y/construction-platform`
- [ ] Consolidated remaining-work plan delivered to owner (S3→S8 per GATE4_BUILD_PLAN.md)

## Prior: Gate 4 build plan (2026-11-07)

- [x] Research/cleanup phase complete — all reachable console coverage done
- [x] GATE4_BUILD_PLAN.md written — 8 contractor-hub slices (S1 quotes→cash first)
- [x] Owner approved slice order → S1 started and backend-verified

## Prior: competitor-console cleanup + remaining coverage (2026-11-07)

- [x] Void/reject CO-4990 → **Rejected** (verified in variation log + dashboard analytics)
- [x] Reject punch item PL-2419 → **Rejected**
- [x] Reject payment application #ZZ-APP-01 → **Rejected** (modal comments flow captured)
- [x] Fix daily-log Friday entry → crew "Site crew" + neutral work text (no delete exists; edit-only)
- [x] Reset contract sum $1M → **0** via "More project actions" → "Contract value & dates"
- [x] Invoice + quote: confirmed NO delete affordance — documented as uncleanable via UI (trial expiry wipes)
- [x] New findings documented: Edit project modal fields, More-actions menu, sidebar toggle behavior, no-hard-delete design
- [ ] Update CREATED_RECORDS.md + PROGRESS.md with cleanup outcome; commit + push
- [ ] Remaining coverage: certificate save, "Viewing as", Ask AI/Shemmy, upload pipeline, Site Checks, Bidding, saved-state creates for inspection/observation/checklist/crew/subcontractor/contact/incident/RFI/correspondence/announcement/inventory

## Review
(filled at completion)

## S3 Change Orders (ADR-010) — in progress (2026-11-07)

- [x] Schema: VariationOrder +trigger_type/linked_rfi_id/requested_by_id/submitted_at; VariationAssignee; VariationEvent; Membership.co_approval_limit; VOID added to financial-immutability trigger
- [x] Validation: VariationTriggerTypeSchema, extended Create/Review schemas (reject requires reason)
- [x] Permissions: PM_QS gains VARIATION_APPROVE (limit-enforced server-side)
- [x] variationWorkflow.ts: limit resolution, coCanApprove, claimCoTransition (atomic updateMany guard), applyCoBudgetRollup
- [x] variations.ts: DRAFT create, /submit, reworked /review (EVALUATE/APPROVE/REJECT/VOID), events in detail, 409 on concurrent transition
- [x] externalPortals.ts: token-scoped client CO list + respond (OWNER_REVIEW only, typed-name signature)
- [x] route-guard allowlist: 2 token portal CO routes
- [x] company.ts: PATCH member co-approval-limit (COMPANY_MANAGE, audit-logged, Decimal)
- [x] UI: VariationManagementView real-fetch + ADR-010 statuses/filters/actions/activity feed; CreateVariationModal trigger; ClientPortalView token approval page; credentials:'include' fixes
- [x] Tests: m8-variations updated to new lifecycle; s3-change-orders.test.ts (12 tests: limits, boundary, escalation, owner path, reject reason, void, events, token portal, cross-project isolation)
- [x] verify-local green on head 653f6fc: 583/583 tests; evidence docs/evidence/verify-653f6fc.log
- [x] PROJECT_STATUS.md updated; committed 653f6fc

## Current: Gate-5 deferred platform modules (2026-11-08 overnight run)

### Completed this run
- [x] G5-1 Announcements — audience targeting + read acknowledgement (earlier)
- [x] G5-2 Role ladder & permission sets — EXECUTIVE/PM/SITE_ENGINEER/SUPERINTENDENT/TRADE_LEAD/FOREMAN/WORKER/VIEWER (commit 9a00958)
- [x] G5-3 Team inbox — threads, audience targeting (7c6195d + 2c62041)
- [x] G5-4a Observations & corrective actions (2c62041)
- [x] G5-4b Consultant approval chain on inspections — PENDING_CONSULTANT_REVIEW gate (5efaa83)
- [x] G5-5 Crews, members, project assignment (0d5d5ca)
- [x] G5-6 Checklist templates & trade assignments — 16 trades, question builder, global flag, ASSIGNED→…→APPROVED lifecycle (71dcf48)
- [x] G5-7 Company documents vault — categories, unfiled queue, expiry (d78b571)
- [x] G5-8 Correspondence log — COR-nnn, LETTER/SUBMITTAL/TRANSMITTAL/NOTICE (25b051a)
- [x] G5-9 Scheduled reports — freq/recipients/next_run/run snapshots (25b051a)
- [x] G5-10 Daily attendance — check-in/out, leave/off-day, history (e000b36)

### Verification
- [x] verify-local GREEN on 71dcf48 — API 471, web 117, money 63, db 15, permissions 9 (docs/evidence/verify-HEAD.log)

### Remaining Gate-5 / role-portal work
- [ ] Assignments detail: "Assignments by trade" matrix view polish
- [ ] Plans & drawings discipline viewer (Architectural/Mechanical/Structural/Electrical/Civil) — ProjectDocument extension
- [ ] Coordination unified issues view (RFI + issues) — RFI module exists, unified surface pending
- [ ] Punch/snag CSV + PDF export (observed buttons)
- [ ] Field view — mobile-first daily ops surface (worker/foreman)
- [ ] Dedicated workspace dashboards per new role (executive/PM/site-engineer/superintendent/trade-lead/foreman/worker/viewer) wired to supplied test logins — IN PROGRESS via dashboard role switch; dedicated nav polish pending
- [ ] Cross-portal workflow simulation tests (observation→corrective action→PM escalation→executive visibility)
- [ ] Bidding/tender depth, schedule Gantt, drawings viewer, upload pipeline — deferred LATER items

## Review
- Two verify runs were contaminated by editing files mid-run (lint/build failures on in-flight code). Rule: FREEZE repo edits while verify-local runs; batch commits before launching.
- Test-DB schema drift caused a false 20-test failure when schema edits landed after verify's db push step — always re-verify after schema changes.
- [x] Cross-portal day-in-the-life simulation test — 7 steps, role handoffs (g5-cross-portal-workflow.test.ts, 7 tests)
- [x] Punch/snag CSV export — GET /snags/export + UI button (g5-11, 2 tests)
- [x] Final verify-local GREEN on 4292afc — 684/684 (480 API, 117 web, 63 money, 15 db, 9 permissions)

## Finish-all plan (post-return)
- [x] Dashboard project resolution — real projectId to all mounted views (PmQs/Sup/Admin pickers, ClientDashboard live hydrate)
- [x] Live-wire: RFI, Drawings, Gantt, Inventory, MusterRoll, SafetyAudits, Tenders, Attendance+laborer reg, Snag CSV+PDF
- [ ] Wave A subagents: wire demo views → real APIs (platformServices/operations/siteOperations)
  - A1: PlantEquipmentView + PlantTelematicsView (plant-equipments? telematics-devices/pings/maintenance-alerts)
  - A2: BarBendingScheduleView + StructuralSteelTakeoffView + RmcTransitTrackerView (bbs/steel-takeoffs/rmc-deliveries+slump)
  - A3: GeotechnicalSoilView + AsphaltPavementView + TopographicSurveyView (soil-tests/asphalt-batches/surveys)
  - A4: GeofencedClockInView + MpesaDisbursementView + IndependentSiteReportView (geofences/clock-in/b2c-disbursements/independent-inspections)
- [ ] Wave B subagents: commercial/enterprise views
  - B1: SubcontractorManagementView + MaterialRequisitionView + MaterialWastageVarianceCard
  - B2: StatutoryTaxManagementView + ETimsTaxComplianceView + RetentionAndBondsView + WeatherDelayClaimsView + WhatsAppSiteWebhookView
  - B3: QualityControlView (inspections tab only — cube tests have no internal API, document) + PhotoEvidenceGallery + remaining stragglers
- [x] Seed accounts per role (DONE in seed.ts); feature-map doc removed per audit — matching goal dropped
- [ ] Final verify-local + PROJECT_STATUS update
- [x] Wave A+B subagent wiring complete — 20+ views live (see commit 80143d1)
- [x] feature-map doc removed — matching goal dropped per audit; seed accounts remain in seed.ts
- [x] PATCH subcontractor package status endpoint + UI persistence
- [ ] Known backend gaps (documented, not built): GET equipment-logs, GET telematics-devices list, GET SiteWebhookLog, subcontractor valuations PATCH?, Excel export, AI features, WhatsApp/SMS/eTIMS live providers, scheduled-report delivery
- [x] Final verify-local GREEN on 80143d1 — 687/687
- [x] Integration provider layer (AT SMS / WhatsApp Cloud / Resend email), status+test endpoints, real dispatch on notify-client/site-alerts/scheduled-reports, IntegrationsView UI
- [x] Site Safi brand applied everywhere; reference-platform name/URLs scrubbed from repo
- [x] Mobile-first: bottom tab nav on FieldDashboard + SupervisorDashboard
- [x] Missing GETs added: telematics-devices, site-webhook-logs, equipment dailyLogs serialized
- [x] integrations.test.ts (4 tests)
- [x] Final verify-local GREEN — 691/691 on 6858172

## Console rebuild from live captures (2026-11-08)
Captures: /tmp/refstudy/crawl/<role>/<section>.{txt,png} — 8 roles x 6 sections.

- [x] AppShell: icon rail (Ask AI, Home, Projects, Site, Money, People, Files & reports) + topbar (workspace label, search, currency toggle, New, notifications, avatar, dark-mode ready)
- [x] navConfig: role -> visible sections/subtabs per captured matrix
- [x] Home per role group: exec/pm/viewer dashboard (CO KPIs, AI insight, status chart) ; field roles team inbox + announcements + AI panel
- [x] Projects section: All projects (cards+filters+recent CO activity), Schedule, Drawings, Change orders, Coordination(RFI), Correspondence
- [x] Site section: Daily log, Checklists, Assignments, Punch list, Inspections, Observations, Action plans, Safety, Attendance (+Field view for field roles)
- [x] Money section: Financials, Commitments, Quotes, Invoices, Inventory, Billing&plan (role-gated)
- [x] People section: Team, Crews, Subcontractors, Directory, Roles (role-gated)
- [x] Files section: Reports, Company documents, Unfiled documents
- [x] Ask AI panel: honest assistant UI (module deep-links + guidance; no fake AI claims)
- [x] Role gating verified per captured matrix (worker: no People/Files; viewer: read-only subset)
- [x] Mobile bottom tab bar (<640px) + desktop icon rail
- [x] External portal previews inside shell (context-driven)
- [x] Daily log 14-day strip, per-day Add log (initialDate)
- [x] Financials tracker sub-tabs + BoqWorkbookView + exports
- [x] DrawingsView Electrical discipline + AI Design SOON
- [x] Photo upload wired to /uploads in SiteDiaryModal
- [x] All 10 seed logins verified live via Playwright DOM probe
- [x] Probe/refstudy scripts removed from repo (never commit research tooling)

## Form-level sweep from live captures (2026-11-08, second pass)
Captured every create form on contractor portal: CO, RFI, correspondence, safety, observation, punch, crew, subcontractor, daily log, invoice, quote, commitment, financials subtabs, reports, company docs, unfiled, field view, mobile landing.

- [x] CO modal: linked RFI + multi-assignee selects (backend already supported assigneeIds/linkedRfiId)
- [x] RFI issue_type: RFI/CLASH/DESIGN_QUESTION (schema+validation+route+modal)
- [x] Safety incident types extended to observed hazard taxonomy (struck-by, rollover, cave-in, traffic, asphalt burn, environmental) alongside OSHA types
- [x] Daily-log weather: + Windy/Hot/Cold (HIGH_WIND/HIGH_TEMPERATURE/LOW_TEMPERATURE)
- [x] Crew + subcontractor trade lists expanded to observed taxonomy; Interior Design & Decor added to snag categories
- [x] Reports: CO volume-by-status bar chart (observed on reference reports page)
- [x] Site > Field view tab: field hub — quick actions + my assigned checklists (observed)
- [x] Verified already-matching: invoice (richer — KRA/paybill), quotes (convert-to-project + deposit invoice exceeds ref), commitments step explainer, correspondence types/direction, observation types, daily-log strip, money subtabs all live-backed
- [x] verify-local GREEN 696/696 on 2b793ee

## Review
- Shell now matches captured IA 1:1 at section+subtab level; inner views are our live implementations (not copies).
- Honest gaps remaining: real AI backend (Ask AI is labelled rule-based nav assistant), AI Design SOON, drawing markup viewer, live eTIMS/WhatsApp provider creds, client-portal "Request a project" flow, deeper subtab internals beyond first-crawl depth.
- Probe scripts contained reference credentials -> removed from HEAD; history still contains them (pre-scrub commits) — offer history rewrite if user wants.

## Security audit remediation (post-rebuild, ordered)
- [x] 1. Authorization: central route permission map + project-membership guard + guarded route test
- [x] 2. Uploads: magic-byte verification, mime-derived ext, authenticated tenant-scoped serving, storage driver seam
- [x] 3. M-Pesa honesty: simulated flags in API+UI, maker-checker B2C payouts
- [x] 4. Real Prisma migrations (baseline + RLS) + deploy-step rls.sql re-enforcement; users/tenants RLS exception documented
- [x] 5. Sessions: 15m access + 7d refresh rotation, per-request is_active/membership check, @fastify/rate-limit on login/refresh/public
- [x] 6. Peripheral modules (plant/survey/tender/steel/asphalt/geofence) quarantinable via DISABLED_MODULES
- [x] 7. PORTAL_MATCHING_MAP.md removed; feature-matching goal dropped
- [x] {i}. PROJECT_STATUS.md update + seed production guard
- [ ] Final verify-local green + evidence

## Post-audit hardening & polish (continued)
- [x] Refresh-token server-side rotation + reuse detection (refresh_tokens table, migration 0003, family revocation on replay)
- [x] Session management: GET/DELETE /auth/sessions + SessionsModal (per-device revoke, sign-out-others)
- [x] reports/cost.xlsx (fixes dead /reports/cost link); report cards show real export format
- [x] docs/DEPLOY.md — env, migrations+RLS, grants, production guards
- [x] PWA: Site Safi manifest branding + real install icons (192/512/apple-touch) + orange favicon
- [x] g5-15 extended to 6 tests (sessions list/revoke)
- [x] verify-local GREEN 714/714 on ebaf3c3 + 23cc4ea (web build clean, PWA precache 12 entries)

## Audit remediation program (Claude audit of PR #1 — ordered phases)
Branch: devin/audit-remediation. Rules: evidence per item in docs/evidence/, no competitor wording, no invented data, simulated integrations labelled, verify stays green.

### Phase 1 — Security & data safety
- [x] 1.1 Authorization: route-authz-matrix.md evidence; b2c-disburse finance perm + approval + audit; retention review role check; replace inline hasPermission in certificates.ts/variations.ts with shared preHandler
- [x] 1.2 route-guard test fails build on unguarded routes (DONE prev session — verify + evidence)
- [x] 1.3 Uploads: server-side filename, MIME+magic allowlist, size limit, attachment/nosniff or authed tenant route, .html/.svg tests (DONE — verify + evidence)
- [x] 1.4 Real migrations + rls.sql in CI from empty DB (DONE — verify + evidence)
- [x] 1.5 Sessions: revocation/session table, short access + refresh, rate limits (DONE — verify + evidence)
- [x] 1.6 M-Pesa: SIMULATED labels chosen (DONE — document choice in PR)

### Phase 2 — Design system reset
- [~] 2.1 docs/DESIGN_SYSTEM.md + Tailwind tokens + apps/web/src/ui component library
- [~] 2.2 formatKes() everywhere + lint/test guard
- [~] 2.3 Landing page rewrite (no emoji/gradient/invented stats)
- [~] 2.4 Console shell + dashboards: one layout, job-grouped nav, page headers
- [~] 2.5 Loading/empty/error states on every data view; no insights without data
- [~] 2.6 Mobile-first supervisor @390/360px, 44px targets, offline/sync header
- [~] 2.7 A11y: labels, focus, keyboard nav, no colour-only status

### Phase 3 — Real portals & wiring
- [x] 3.1 Remove fake client sessions (demo-jwt-*, demo tokens, fake names) → seeded demo tenant or nothing
- [x] 3.2 Wire consultant/subcontractor/supplier/compliance/client portals to real token endpoints
- [x] 3.3 Remove hard-coded numbers (45000000, demo/sample grep sweep)
- [x] 3.4 No-fetch views: wire or flag-hide (ContractorTenderBoard, ProjectDocumentVault, SafetyIncidentLog, SubcontractorValuation, SubscriptionBilling); wire /certificates + /subcontractor-valuations
- [x] 3.5 Dead links: /reports/cost (DONE via cost.xlsx — verify), /reports/site-diary/latest
- [x] 3.6 PublicQuoteView loading/not-found/expired/error states
- [x] 3.7 Peripheral modules behind feature flags, out of nav; MVP core chain only

- [x] Phase 4 — Playwright (e2e/ suite, 18/18 green, CI workflow added) e2e A–F (real API+DB, no route stubs, traces, CI-gating)

- [x] Phase 5 — Report (PROJECT_STATUS + visual evidence + audit summary)

### Phase 5 — Report — Report: PROJECT_STATUS + before/after screenshots + audit summary

## Portal hardening pass (branch devin/portal-hardening)
Plan per auditor items 1-13, failing test first each:
- [x] {i}. Subcontractor link scoped to subcontractor_package_id; remove contains-matching; isolation test
- [x] {i}. Link create/list: allow-list via requirePermission (admin/PM_QS only) + dedicated permission
- [x] {i}. rateLimit on /api/v1/portals/*; identical 404 for invalid/expired/wrong-type
- [x] {i}. Explicit DTOs for consultant/compliance/subcontractor/supplier payloads; drop unused queries
- [x] {i}. Rectify: portal-scoped upload endpoint w/ magic-byte verify; tenant+project check
- [x] {i}. Consultant reply: Zod schema, 400 missing, reject ANSWERED/CLOSED, no creator responder_id, external_responder_name/external_link_id
- [x] {i}. Valuation: Decimal math, prev payments from valuations, cap vs package sum, WHT from config, package-scoped link required
- [x] 8. Supplier confirm/dispute: note required on DISPUTE, invoiceRef on CONFIRM, block final-state
- [x] {i}. Compliance: remove invented ncaSiteRegistration, "Not recorded"; "No tests yet" not 100%
- [x] {i}. PortalAccessLinkManager: remove mock fallback, canonical linkUrl, regenerate/revoke, last-used/use-count/expiry
- [x] {i}. Portal views: expiry banner, revoked state, shared error component
- [x] {i}. Portal empty states + wording cleanup (done partially in 39f57c3)
- [x] {i}. Supplier dispute fields; sub valuation context; client portal photos/certs/invoices
- [x] E2E green: e-portals.spec.ts 12/12 (chromium + mobile-390) — two-sub isolation, revoked, expired (real expires_at mutation), role-restricted create, rectify w/ real upload. Fixed e2e infra: rls.sql functions must be owned by RLS-bypassing role (E2E_ADMIN_DATABASE_URL), psql URL schema-param strip, RLS-safe fixture UPDATE.
- [x] Evidence: docs/evidence/portal-hardening.md; PROJECT_STATUS update; verify-local 730/730 (API 525, web 118, money 63, db 15, permissions 9)

## NEXT TASK (queued after portal hardening — branch devin/portal-hardening @ 7b521cc)
Auditor punch list from PR #2 review, evidence required per item:
- [ ] Landing page: remove stale mock/gradient/"100%"/"0 Seat Tax" imagery; use real console screenshots (docs/evidence/shots/* captured — wire into LandingPortalHub)
- [ ] Portals UI: remove remaining "ZERO SEAT TAX"/"Verified Token" copy + uppercase pill badges; empty states on every (0) tab
- [ ] grep sweep: sampleBudget=45000000 and remaining fabricated defaults (sample|demo|mock|dummy)
- [ ] ci.yml: confirm `prisma migrate deploy` from empty DB + RLS tests run in CI (verify-local does; check ci.yml parity)
- [ ] route-guard: document the authenticate-only route inventory + where each checks permission (route-authz-matrix.md exists — reconcile count)
- [ ] Scrub "parity"/"reference console" wording from todo.md + PROJECT_STATUS.md history entries
- [ ] font-mono: codes/numbers only — produce before/after counts
- [ ] Fresh portal screenshots @1440 + @390 after wording changes (shots/ has pre-change set)
