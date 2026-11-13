# tasks/todo.md — active plan

#### Current: Procurement UI gap closure — 2026-11-11

Stage-4 verified. Remaining honest gaps (PROJECT_STATUS): PO match view +
supplier/sub portal pages API-only; FieldDashboard no click spec.

### Procurement UI — DONE
- [x] ProcurementView + Money 'procurement' tab (create/issue/match/review)
- [x] SupplierPortalView PO section (accept + invoice submit)
- [x] e2e/tests/l-procurement-ui.spec.ts — 10/10 (chromium + mobile-390)

### Verify — DONE
- [x] web vitest 118/118, tsc clean; evidence/procurement-ui.md;
      PROJECT_STATUS updated

## Prior: Stage 2 (client/owner) + Stage 3 (subcontractor/supplier) — 2026-11-10 (DONE — see docs/evidence/)

Auditor specs were never provided; user directed "work on all above requests" → authoring
`e2e/tests/i-stage2-client-owner.spec.ts` and `e2e/tests/j-stage3-subcontractor-supplier.spec.ts`
from the numbered requirements, failing-first, then implementing.

### Stage 2
- [ ] Spec: client diary/photo privacy (notes redacted, hidden photos blocked on list/detail/`/uploads`), tenant retention_terms + payment instructions, `GET /api/v1/fx-rates` (asOf+source), client invoices/balance/payment-history via `/api/v1/me/invoices`, `POST /api/v1/client/invoices/:id/payment-notice` (non-mutating, notifies contractor inbox), `GET /api/v1/me/approvals` + "Waiting for you" cards, read-mostly OWNER dashboard (no CERTIFICATE_MANAGE create/certify), client project requests → contractor inbox, 390px no sideways scroll
- [ ] Schema: Tenant.retention_terms + payment_instructions; ClientPaymentNotice model
- [ ] API: client-safe site-diary DTO for CLIENT/OWNER, files.ts client_visible gate, company settings fields, fx-rates, me/invoices, payment-notice, me/approvals, request→inbox notify
- [ ] Web: ClientDashboard retention/FX/invoices/notice/approvals, OwnerDashboard read-mostly, plain-language statuses
- [ ] Evidence: docs/evidence/stage2-client-owner.md

### Stage 3
- [ ] Spec: Supplier record required on supplier links + deliveries (no free-text match), pagination (no 30-day cap), sub link requires package, TCC gate on APPROVED_FOR_PAYMENT (409 TCC_INVALID + admin override w/ reason → audit), PAID requires paymentReference+paidAt, portal payment/package summary + rejection reasons + resubmit (replacesValuationId) + rejected excluded from cap, retention release status, PO lifecycle + supplier accept/invoice + delivery↔PO-line links + match view + over-invoice block + ledger posting, plain statuses, 390px, honest revoked/expired
- [ ] Schema: Supplier, PurchaseOrder/PurchaseOrderItem/PurchaseOrderInvoice, MaterialDelivery.supplier_id + purchaseOrderItemId, PortalAccessLink.supplier_id, SubcontractorValuation.replaces_valuation_id
- [ ] API: suppliers CRUD, portal link supplierId enforcement, supplier portal scoping+pagination+PO actions, diary delivery supplierId, TCC gate + override audit, PAID guards, resubmit, retention status, PO routes + match + ledger posting, rejected-excluded aggregates
- [ ] ADR: sole subcontract payment model = SubcontractorValuation; PaymentApplication stays client-direction; hide duplicate from nav
- [ ] Web: supplier/sub portal UX (POs, breakdowns, plain statuses, pagination, revoked/expired), PO management screens
- [ ] Update existing specs broken by new contracts (e-portals supplier link, h-stage1 TCC/PAID)
- [ ] Evidence: docs/evidence/stage3-sub-supplier.md, PROJECT_STATUS.md

### Verify
- [ ] Both new specs green on chromium + mobile-390
- [ ] Full API vitest + web tests + scripts/verify-local.sh


## Prior: Claude re-audit remediation + Gate-4 S1 completion + S2 invoicing (2026-11-07)

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

## Auditor punch list (PR #2 review) — DONE, evidence: docs/evidence/auditor-punch-list.md
- [x] Landing page verified clean; real console screenshots wired
- [x] Portals UI: ZERO SEAT TAX/Verified Token/uppercase pills removed; next-step empty states on every (0) tab; fabricated NCA badge + hardcoded 5% retention math fixed
- [x] Fabricated defaults: all initialX fixture fallbacks DEV-gated; sim-success fallbacks removed (variation/cost/inspection booking); fake project/equipment IDs removed
- [x] ci.yml confirmed: migrate deploy from empty DB + rls.sql + RLS tests as db_app
- [x] route-authz-matrix.md regenerated: 279 routes, 255 authenticated all permission-guarded, 24 allowlisted, 0 violations
- [x] External-product wording scrubbed from todo/STATUS/research summary
- [x] font-mono: 472 uses, codes/numbers only (unchanged — prior pass already cleaned)
- [x] Fresh screenshots: 16 files @1440+@390 via real seeded stack + UI login

## Auditor re-review round 2 — DONE (evidence: docs/evidence/auditor-punch-list.md)
- [x] console-desktop/mobile.png replaced with real admin-console captures; stale landing.png deleted
- [x] font-mono 472→458: prose/status/unit/free-text usages removed; remainder codes/numbers/dates/coords/PINs/phones/numeric inputs
- [x] Portal headers: dark bands → light console-style cards on all 5 portals; "What you can do here" card added; all-zero tiles hidden; "5% Retention" label now uses real rate
- [x] "Shot SUBCONTRACTOR"/"Screenshot Stakeholder": zero hits in source — e2e fixtures only ("E2E <TYPE>")
- [x] parity/reference-console wording: zero hits in todo.md + PROJECT_STATUS.md
- [x] Fresh portal screenshots @1440+@390 post-change; PR #3 updated
- [x] Bonus: fake SHA-256 seal removed, Daraja-verified claim → simulated label, eTIMS modal SIMULATED banner

## NEXT TASK
- Live provider credentials (Daraja, Africa's Talking, Meta WhatsApp, Resend, eTIMS, LLM) → wire real integrations
- Production deploy per docs/DEPLOY.md (DISABLED_MODULES, object storage, domain/TLS)

## Contractor-lifecycle gaps (branch devin/contractor-lifecycle) — auditor walkthrough
Failing test first → fix → evidence per item. verify-local green at end.
- [x] 1. POST /auth/register-company: tenant + first COMPANY_ADMIN + membership in one tx; email/phone verification placeholder; rate limit; audit log; seed stays prod-disabled; signup page; test: new company signs up → logs in → empty console (onboarding.test.ts 4/4; journey step 1 green both viewports)
- [x] 2. /?invite=<token> acceptance (company+role shown, name+password, login); expired/used/wrong-email handled; admin list pending/accepted/revoked + regenerate + revoke; 390px test (invitations-lifecycle.test.ts; journey step 2 green)
- [x] 3. Certificate built from BoQ progress % × rate − previous certified, editable review; CERTIFY → "Create invoice" linked both ways (invoice.certificate_id); paid status derives from linked invoice payments (MARK_PAID → 409); VAT (config, default 16%) + client WHT lines on cert + invoice (lifecycle-money.test.ts; journey steps 3-6 green)
- [x] 4. Valuation state machine SUBMITTED→UNDER_REVIEW→APPROVED_FOR_PAYMENT→PAID (+REJECTED); illegal → 409; approver ≠ preparer; who/when recorded (lifecycle-money + commercial-operations-suite green)
- [x] 5. Approved valuations post to cost ledger (commitment-linked, append-only trigger respected); certified/paid/outstanding per package; budget summary reflects ledger amount (tested delta)
- [x] 6. Tenant tax settings via GET/PUT /api/v1/company/tax-settings + TenantTaxSetting; defaults VAT16/WHT3/WHVAT2; no hard-coded rates in cert/invoice/valuation math; eTIMS stays simulated+labelled
- [x] 7. Real inbox notifications via notifyTeam() in same tx (diary/progress, cert certified, valuation submitted/approved, portal actions: RFI reply, delivery confirm/dispute, snag rectify, CO respond); CopyWhatsAppButton on portal links + certificates (notifications.test.ts 5/5)
- [x] 8. ProjectChecklist on project overview — 7 steps from real API data, done/Go states, deep links (journey step 8 green)
- [x] 9. mjengo_offline_queue/mjengo_offline_db → sitesafi_offline_queue/sitesafi_offline_db w/ one-time migration of existing queue data; flushSyncQueue sends credentials:'include' + idempotency key; font-mono limited to codes/numbers
- [x] EVIDENCE: Playwright g-contractor-journey.spec.ts — 14/14 (7 scenarios × chromium + mobile-390); full suite 38/38; docs/evidence/contractor-journey.md

### Bugs found & fixed during journey verification
- [x] flushSyncQueue missing credentials:'include' → queued mutations could never authenticate (offline-sync.ts)
- [x] Portal link create/regenerate responses omitted isActive → fresh rows rendered "Revoked" (externalPortals.ts)
- [x] GET /api/v1/projects listed ALL tenant projects to restricted roles while requireProjectMembership 403s non-member project routes → console picker defaulted to an inaccessible project; now membership-filtered for non-tenant-wide roles (projects-visibility.test.ts 2/2)
- [x] lifecycle-money.test.ts mutated shared tenant tax settings without restoring → portal-hardening WHT assertion polluted; afterAll restores documented defaults
- [x] Login rate limit (30/min/IP) 429'd the E2E suite's real logins → LOGIN_RATE_LIMIT_MAX env knob, E2E sets 1000 (production default unchanged)

## Review
- API lifecycle suites: onboarding 4/4, invitations 24/24 (incl. regressions), lifecycle-money 6/6, notifications 5/5, projects-visibility 2/2, portal-hardening 14/14
- Full API vitest: 544/549 — 4 failures are m10-backup-restore hardcoded port 54329 (env mismatch, pre-existing; verify-local cluster passes them), 1 was the tax-settings pollution now fixed
- Web: 118/118; E2E: 38/38 (chromium + mobile-390)
- Honestly unfinished: mobile diary modal submit hit-target quirk worked around via requestSubmit (real layout fix still open); live provider keys + production deploy remain owner-gated

## Auditor stage-1 acceptance spec (e2e/tests/h-stage1-journey.spec.ts) — DONE
Auditor-written 9-step contract spec run verbatim (CONTRACT constants adjusted for
route names only: create-invoice + /api/v1/inbox; payload field names aligned to
RegisterCompanySchema — documented in spec header). Failing test first → fix → evidence.

- [x] Run 1 baseline: register-company 400 (field names), then per-step failures collected
- [x] AcceptInvitationSchema.email → optional (invitee need not re-type invited email; wrong-email still 403)
- [x] Cert create with no amount/lines → DERIVES from BoQ progress (deriveProgressCertificate shared with /preview)
- [x] Cert VAT/WHT base → this-period net of retention (matches invoiced amount); PATCH path same
- [x] create-invoice: clientName optional (falls back to converted quote client → project name); invoice subtotal = net-of-retention; retention shown as explicit negative line; snake_case aliases added to response
- [x] Deposit invoice on quote convert now carries real VAT split (was silent tax_pct=0)
- [x] Valuation segregation: reviewed_by_id/reviewed_at columns (migration 0010); approver must differ from preparer AND reviewer
- [x] Client portal CO respond accepts PM_REVIEW or OWNER_REVIEW (client IS owner-side authority)
- [x] VariationItemInputSchema quantity/unitRate accept numbers; triggerType + CLIENT_REQUEST
- [x] GET /api/v1/projects/:id/checklist — 7 steps from real data (quote/BoQ/team/diary/cert/paid invoice/closeout)
- [x] Result: 9/9 chromium + 9/9 mobile-390; focused API suites green; quotes.test.ts updated for VAT deposit

## Review (stage-1 spec)
- OBSERVED: h-stage1-journey 18/18 (9 tests × 2 viewports) on real API+DB
- OBSERVED: lifecycle-money 6/6, s4-certificates, notifications 5/5, projects-visibility 2/2,
  portal-hardening 14/14, commercial-operations 11/11, m8-variations, s3-change-orders, quotes 24/24
- Contract deviations documented in spec header (route names + register payload field names only)

## Mobile diary modal hit-target — FIXED (was test workaround)
- [x] SiteDiaryModal: card now scrolls internally (max-h-90vh overflow-y-auto), header sticky top, action bar sticky bottom → submit always reachable at 390px
- [x] g-contractor-journey test 9 back to a REAL .click() (requestSubmit workaround removed) — 14/14 green both viewports
- [x] verify-local.sh GREEN 6/6 on fresh ephemeral cluster (commit 83d8665): lint 6/6, typecheck 8/8, build 3/3, tests 6/6 — API 549/549 → docs/evidence/verify-83d8665.log

## Stage-1 closure punch list (auditor-requested, failing tests first) — IN PROGRESS
- [x] 1. Password reset: POST /auth/request-password-reset (non-enumerating, rate-limited) + POST /auth/reset-password (single-use, expiring, hashed tokens in accountTokens.ts); admin-assisted one-time reset link POST /company/members/:id/reset-link; "Forgot password?" on LoginForm + PasswordResetViews
- [x] 2. Account verification gate: register-company + invite-accept accounts cannot log in until email_verified/phone_verified/admin-activated; POST /auth/verify-email; admin activation endpoint; invite token no longer returned to inviter — inviteUrl copy-and-send only; invitee must set own password at accept
- [x] 3. Invite role limits: packages/permissions role-hierarchy — only COMPANY_ADMIN invites ADMIN/COMPANY_ADMIN; others only below own role; tested per role in account-lifecycle.test.ts
- [x] 4. Existing-account invite: requires account password confirm before membership; response reports company+role; existing password untouched
- [x] 5. font-mono audit: before 454 → after 450 (4 prose usages removed; remainder are codes/numbers/data values per audit)
- [x] 6. UI click tests: e2e/tests/i-stage1-ui-clicks.spec.ts — cert builder→draft→submit, invoice create→send→record payment, valuation claim — real .click() on chromium + mobile-390 (2/2 green)
- [x] Real bug found by click tests: InvoicingView row "Record payment" set showPayForm(true) then openDetail() reset it to false → payment form never opened; fixed by awaiting openDetail then setting flag
- [ ] Full API vitest + verify-local.sh + evidence refresh — running
- [ ] Stage 2 (client/owner): WAIT for auditor spec — do not build

## Review (stage-1 closure punch list)
- OBSERVED: account-lifecycle.test.ts 9/9 — reset non-enumeration/single-use/expiry/rate-limit, admin reset link, register+invite verification gate, verify-email, admin activation, per-role invite limits, existing-account password confirm
- OBSERVED: 11 tenant-isolation suites regressed by verification gate → fixture tenant-B users now email_verified_at (they model pre-existing accounts, not the verification flow); 171/171 re-run green
- OBSERVED: i-stage1-ui-clicks.spec.ts 2/2 (chromium + mobile-390) — real clicks: IPC builder→draft→submit, invoice create→send→record payment, valuation claim; no sideways scroll
- OBSERVED: real bug fixed — InvoicingView row "Record payment" never opened pay form (openDetail reset showPayForm); g-spec stale net-of-retention expectation corrected to read cert's actual retention_deduction (cap exhaustion made it order-dependent/flaky)
- OBSERVED: font-mono 454 → 450 (4 prose removals; remainder codes/numbers/data values)
- OBSERVED: verify-local GREEN — API 558/558 (61 files), lint/typecheck/build/tests 6/6 → docs/evidence/verify-4e948b7.log (pre-commit hash; re-run after commit for final evidence)
- OBSERVED: full Playwright suite 57/58 then g-spec fix → chromium g 7/7; mobile g was already green
- Stage 2 (client/owner): NOT STARTED — awaiting auditor spec

## Stage-2 client/owner + Stage-3 subcontractor/supplier (auditor specs authored from requirements) — DONE pending commit
Auditor spec files were never delivered; authored `i-stage2-client-owner.spec.ts`
(9 tests) and `j-stage3-subcontractor-supplier.spec.ts` (8 tests) from the numbered
requirements, failing-test-first, then built.

- [x] Stage-2 API: client-safe diary DTO + photo gating (site.ts), PATCH /company/settings,
      /me/invoices + payment-notice + /me/approvals + /fx-rates (me.ts), client-portal
      retention_terms normalisation, OWNER cert restrictions
- [x] Stage-2 web: ClientDashboard (tenant retention/FX/invoices/notices/approvals card,
      no hard-coded %), OwnerDashboard.tsx read-mostly
- [x] Stage-3 API: supplier-record binding + pagination (externalPortals.ts), supplier PO
      accept/invoice portal routes, subcontractor package binding, TCC gate + audited
      admin override, PAID ref/paidAt, rejection/resubmit + cap exclusion, retention
      release status, plain-language labels
- [x] Stage-3 procurement: purchase_orders/items/invoices (procurement.ts), PO lifecycle,
      commitment-on-issue + actuals-on-accept, three-way match view with per-line
      invoiced qty/amount (purchase_order_item_id link, migration 0013), over-invoice
      PM flag + cost-posting block
- [x] Migration 0012_stage2_stage3 + 0013_po_invoice_item_link applied; RLS auto-covers
- [x] Stale-contract test updates: e-portals, g/h specs, commercial-operations,
      lifecycle-money (TCC + paidAt), external-portals/portal-hardening/operations-e2e
      (supplierId), m9 (retention reset), route-guard maps, ClientDashboard fallback copy
- [x] Result: stage-2 18/18 + stage-3 16/16 (chromium + mobile-390); API vitest 558/558
      (route-guard + m10 env fixed and re-verified)

## Review (stage-2/3)
- OBSERVED: i-stage2 9/9 ×2 viewports; j-stage3 8/8 ×2 viewports — docs/evidence/stage2-client-owner.md, stage3-sub-supplier.md
- OBSERVED: full API vitest 552+6 fixed → route-guard 8/8, m10 4/4 after provisioning construction_test
- Honestly unfinished: supplier/subcontractor portal pages + PO match view are API-only (no web screen/click tests); FX is manual dated rates not a live feed; verify-local.sh full run pending on final tree

## Stage-3 req-5 completion (ADR-011 + nav hiding) — DONE
- [x] docs/adr/ADR-011-subcontract-payment-model.md: SubcontractorValuation = sole
      subcontract payment model; Commitment/PaymentApplication retained for
      SUPPLIER/CONSULTANT/OTHER only; verified commitments.ts has no costEntry writes
- [x] CommitmentsView: SUBCONTRACTOR removed from vendor-type select + ADR-011 pointer
- [x] j-stage3 ADR test re-run green; web tsc clean

## Auditor acceptance specs restored (aud-*) — DONE 2026-11-11
- [x] 4 immutable aud-* specs written byte-for-byte; run failing-first; product fixed only
- [x] aud-stage1 9/9, aud-stage2 10/10, aud-stage3 9/9, aud-stage4 8/8 — chromium AND mobile-390 (72 green runs, 0 skips)
- [x] Contract fixes: phone+PIN auth, TCC gate + QS_VERIFIED track reconciliation, per-claim valuation caps/resubmit, supplier-bound procurement + three-way match, consultant scopes/drawings acks, compliance permits/visits, field role scoping, diary delivery merge, drawings aliases, incident idempotency+notify
- [x] Audit fixes: ClientDashboard FX fallback removed; font-mono 469→69; e2e.yml all-specs both viewports + fail-on-skip; expired-TCC proven in aud-stage3 test 2
- [x] Evidence: docs/evidence/auditor-acceptance-2026-11-11.md; API regression 86 tests green; web+api tsc clean

## Stage-6 hardening batch (staging readiness, no new features) — IN PROGRESS
- [x] S3 upload driver: UPLOAD_DRIVER=s3, S3_BUCKET env, SSE AES256, private
      (proxied /uploads/* keeps tenant + magic-byte checks), local driver default
- [x] Terraform: aws_s3_bucket.uploads + public-access-block + SSE + versioning
      + lifecycle + task-role s3:PutObject/GetObject + UPLOAD_DRIVER/S3_BUCKET env
- [x] Monitoring: @sentry/node + @sentry/react (release tag, PII scrub, no-op
      without DSN), /ready DB check (SELECT 1 → 503 on failure), SNS email+SMS
      uptime alerts in infra
- [x] Logging: req serializer redacts /portals/<type>/<token> → [redacted],
      credential headers dropped; redactDeep/redactHeaders helpers + tests
      (apps/api/src/log-redaction.test.ts); bodies are never logged
- [x] Seed guard: packages/db/prisma/seed.ts refuses NODE_ENV=production (pre-existing)
- [x] Email seam: lib/email.ts — simulated (dev), resend, ses drivers;
      wired into verify/reset (auth.ts) + invitations; operator activation fallback kept
- [x] Pagination: listParams/listPage helper (default 50, max 200, ?page/?limit);
      applied to ~60 collection endpoints across 20 route files; legacy bare-array
      endpoints use X-Page/X-Limit/X-Has-More/X-Next-Page headers; web fetch
      wrapper in main.tsx transparently follows pages and merges list arrays
      (MAX_LIST_PAGES=20); unit tests pagination.test.ts
- [x] /terms + /privacy: LegalPage.tsx placeholder pages on path routes
- [x] Company data export: GET /api/v1/company/export (COMPANY_ADMIN/ADMIN,
      COMPANY_MANAGE), ?format=json full export / ?format=csv&entity=<name>,
      audit-logged COMPANY_DATA_EXPORTED; "Download company data" button in Team view
- [x] company-export.test.ts: role gate, JSON+CSV export, audit rows, /health+/ready,
      pagination clamp — written, runs inside verify-local
- [x] verify-local.sh full run with UPLOAD_DRIVER=s3 vs LocalStack —
      COMPLETED SUCCESSFULLY (API 578/578, web 118/118, db 15/15, money 63/63,
      permissions 9/9); 4 PNG objects observed in localstack bucket
- [x] Evidence doc docs/evidence/staging-hardening-2026-11-13.md + commit/push

## Review (stage-6)
- OBSERVED: verify-local COMPLETED SUCCESSFULLY under UPLOAD_DRIVER=s3 —
  g5-14 upload-security 4/4 via real S3 driver; LocalStack bucket holds
  4 tenant-scoped .png objects; company-export 8/8; pagination 4/4;
  log-redaction 5/5; API total 578 (was 561)
- OBSERVED: seed guard refuses NODE_ENV=production (run output captured)
- FIXED mid-run: turbo.json globalPassThroughEnv was stripping S3/email/
  sentry env vars — first verify pass silently used local driver; added
  passthrough list and re-ran (this is why evidence shows real S3 objects)
- HONEST GAPS: Sentry/Resend/SES/SNS proven only as code+config until real
  DSN/creds/domain exist; /ready 503 path untested; me/approvals + portal
  feeds are bounded aggregates, not page-parameter lists

## CTO audit fixes (Stage-7 hardening) — DONE + full-suite green
- [ ] Payments: Idempotency-Key + SELECT FOR UPDATE + partial unique
      (tenant_id,reference)→409 DUPLICATE_PAYMENT_REFERENCE + dev-concurrency.spec.ts
      NOTE: aud-stage1/stage2 POST /payments without the header — helpers.ts
      apiPost will auto-attach a key for /payments URLs (specs untouched)
- [ ] Numbering: document_counters table + atomic upsert helper; invoice_no
      tenant scope, certificate_no per-project scope; backfill from max;
      global P2002→409 in error handler
- [ ] Cost approve: updateMany claim on current status (certificates pattern)
- [ ] Auth: trustProxy from TRUSTED_PROXY_CIDRS (no wildcard); login_throttles
      table — IP AND normalized-email, 10 fails/15min, generic 429, dummy
      verify for timing; PIN path already DB-backed (pin_failed_attempts)
- [ ] Web headers: apps/web/nginx.conf (CSP no unsafe-inline scripts,
      HSTS, XFO DENY, nosniff, Referrer-Policy, Permissions-Policy) +
      vite server.headers parity + dev-security-headers.spec.ts
- [ ] Passwords: scrypt N=2^17 r=8 p=1 maxmem raised; 's2$N$r$p$salt$key'
      format; legacy salt:key still verifies; rehash on next login
- [ ] PDF: p-limit(2) + timeout around renderPdfToBuffer call sites +
      event-loop lag measurement over 10 concurrent report requests
- [ ] ADR-013 next scale step (pg-boss, DB shared state)
- [ ] Evidence + verify-local + commit/push

### Stage-7 progress notes
- Migration 0017: document_counters + login_throttles + partial unique
  invoice_payments(tenant_id,reference); counters backfilled from maxima
- Payments: Idempotency-Key REQUIRED (400 without); FOR UPDATE row lock
  BEFORE idempotency re-check (same-key racers queue then replay); key
  reuse across invoices → 409; P2002→DUPLICATE_PAYMENT_REFERENCE
- e2e helpers.ts auto-attaches idempotency-key on /payments URLs so immutable
  aud specs keep passing; InvoicingView sends crypto.randomUUID() per submit
- Numbering: nextDocumentNumber() atomic upsert; applied to invoice create
  (3 sites: invoices.ts, certificates.ts invoice-from-cert, quotes.ts
  deposit invoice) + certificate_no per project
- Cost approve: updateMany claim on prior status → exactly one CostApproval
- Auth: TRUSTED_PROXY_CIDRS env (CIDR list, '*' rejected); login_throttles
  IP+ACCT scopes, 10 fails/15min atomic upsert, dummy-hash timing equalise,
  clear on success; PIN path already DB-backed
- Headers: apps/web/nginx.conf (real file, COPY'd in Dockerfile) + vite
  server/preview headers parity; CSP script-src 'self' (fonts origins added
  for Google Fonts); dev-security-headers.spec.ts asserts the set
- Passwords: scrypt N=2^17 r=8 p=1 maxmem 256MB, 's2$N$r$p$salt$key' format,
  legacy salt:key verifies, transparent rehash on login
- PDF: renderPdfToBufferLimited — semaphore 2 + 30s timeout at all 7 call
  sites; event-loop lag measured in audit-hardening.test.ts
- ADR-013-next-scale-step.md: pg-boss on Postgres, DB shared state
- audit-hardening.test.ts: 8/8 pass (payments×3, numbering×10-parallel,
  cost-claim, hash formats, pdf-burst, XFF throttle isolation)
- invoices.test.ts 16/16 + lifecycle-money 6/6 still green with keys

### Stage-7 REVIEW
- OBSERVED: verify-local COMPLETED SUCCESSFULLY — API 586/586 (+8),
  web 118, db 15, money 63, permissions 9
- OBSERVED: dev-concurrency + dev-security-headers 3/3 on chromium AND
  mobile-390 against real API+DB (migration 0017 applied to e2e DB)
- OBSERVED: P2002 meta.target is NULL for raw-SQL partial indexes and
  modelName is camelCase — DUPLICATE_PAYMENT_REFERENCE matching had to
  inspect meta+message case-insensitively (fixed after first red run)
- OBSERVED: proxy-addr only honours XFF when the socket peer is trusted —
  test needed 127.0.0.1/32 in TRUSTED_PROXY_CIDRS alongside 10/8
- OBSERVED: trustProxy env is read at buildServer() — e2e api server does
  NOT set TRUSTED_PROXY_CIDRS (direct connections, correct for tests)
- FIXED: packages/db index.test.ts asserted legacy ':' format — updated
  to s2$ prefix
- NOT DONE: TRUSTED_PROXY_CIDRS must be set to ALB CIDRs in staging env
  at deploy time; full aud-* sweep not re-run this batch

### Stage-7 follow-up (full Playwright sweep)
- OBSERVED: first full 236-test sweep exposed real regressions the
  aud-only subset missed:
  a) CSP string bug — cspDirectives ended without ';' so script-src was
     swallowed into upgrade-insecure-requests' value → default-src 'self'
     fallback blocked vite's inline react-refresh preamble → white screen
     on every UI test. Fixed by terminating directives and adding the
     exact sha256 of the preamble to DEV CSP only (no unsafe-inline).
  b) DB login throttle self-DoS'd the suite (all traffic = 127.0.0.1)
     → LOGIN_THROTTLE_MAX_FAILURES env knob, e2e sets it high (same
     pattern as LOGIN_RATE_LIMIT_MAX); real 10/15min covered by vitest.
  c) InvoicingView send had no self-approval reason path → 409 under
     maker-checker; added prompt+retry + userRole threading (3 call sites).
- OBSERVED: stale dev specs updated to current contracts (aud-* untouched):
  d-cert/i-stage2 sendInvoice +selfApprovalReason; e-portals/j-stage3
  supplier links auto-resolve Supplier record (201+supplierId);
  h-stage1 invite token via inviteUrl + pendingVerification gated;
  g-contractor dev auto-verify → field-workspace landing;
  i-stage1-ui dialog handler for self-approval prompt;
  i/l openMoneyTab dispatchEvent (sticky overlays ate force clicks);
  l-procurement projectId resolved from qs session + .tabular-nums.
- OBSERVED: full suite 236/236 chromium+mobile-390, 0 skipped, 0 flaky
- infra: TRUSTED_PROXY_CIDRS env on API task (defaults to VPC CIDR)

## Pilot readiness program (master prompt phases A–F)

- [x] Phase A A1–A6 — pushed (0cefd57…0c4c86d); auditor accepted A–B? (pending auditor reply)
- [x] B1 module flags + 404 gating + PILOT_SCOPE.md — pushed 570c650
- [x] C1 routing — pushed 9b0f9f7 (c1-routing.spec green both viewports)
- [x] C2 code splitting — pushed 761de96 (initial JS 1306→306KB raw; Lighthouse evidence)
- [x] C3 type-debt ratchet + money paths — pushed 7dfdd98 (75→0 any in money routes; baseline 787)
- [x] C4 typed API client + core modules — pushed 4230c51 (apiClient + 11 views migrated)
- [x] Phase D: D1 README ✓ D2 dependabot/codeql/gitleaks ✓ D3 coverage thresholds
      (money pkg 98.28% lines; api invoices 91.31 / certificates 90.92 /
      commitments 90.04 / commercialOperations 91.77 — per-file >=90
      enforced in vitest config + CI money-coverage step) ✓
      D4 OpenAPI+envelope ✓ D5 e2e workflow (chromium+mobile-390, hash
      check, brand/demo greps); "required check" = branch protection
      toggle, owner action
- [ ] Phase E: terraform plan only after A–B auditor acceptance
- [x] Phase F: F1 report-a-problem (f99476d) · F2 operator adoption
      (2543f44) · F3 BoQ template+dry-run+messy fixtures (3b69fc1)
- [x] Final verify-local on final commit — verify-2ffae50.log COMPLETED SUCCESSFULLY
      (617/617 api, 127 web, 74 money, 15 db, 9 permissions; lint/typecheck/
      build/audit/type-debt/bundle/demo-brand greps all green)

## Pilot readiness — final verification review (2026-11-13)

- OBSERVED: scripts/verify-local.sh on commit 2ffae50 →
  docs/evidence/verify-2ffae50.log (+ full-sha copy):
  migrations 0001–0018 applied as db_migrator, rls.sql re-enforced,
  seeded, secret scan clean, lint/typecheck/build green, pnpm audit
  passed (1 moderate uuid advisory remains; 1 high zod-3.x GHSA
  explicitly ignored in pnpm-workspace.yaml auditConfig with
  justification — zod4 migration is follow-up), tests as db_app:
  api 617/617, web 127/127, db 15/15, money 74/74, permissions 9/9.
- OBSERVED: @fastify/static bumped >=10.1.1 via pnpm override
  (GHSA-83w8-p2f5-377r, swagger-ui only, non-production surface).
- OBSERVED: F3 parser regression found & fixed — prime-cost /
  provisional-sum rows with qty×rate are VALID isProvisional items
  (not WARNING); e2e-live-site-simulation 24/24 restored.
- OBSERVED: route-guard coverage extended for operator-key routes
  and self-service routes (company/modules, problem-reports).
- NOT REACHED: Playwright suite not re-run in this final verify
  (last full sweep 236/236 at 1ce7753); CI e2e workflow runs it on PR.
- NOT REACHED: Phase E terraform plan — gated on auditor acceptance
  of Phases A–B.
