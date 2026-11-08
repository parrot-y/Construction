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
- [ ] Seed accounts per role (DONE in seed.ts) + the reference platform portal comparison doc
- [ ] Final verify-local + PROJECT_STATUS update
- [x] Wave A+B subagent wiring complete — 20+ views live (see commit 80143d1)
- [x] PORTAL_PARITY_MAP.md — the reference platform↔ours role/feature matrix + seed accounts
- [x] PATCH subcontractor package status endpoint + UI persistence
- [ ] Known backend gaps (documented, not built): GET equipment-logs, GET telematics-devices list, GET SiteWebhookLog, subcontractor valuations PATCH?, Excel export, AI features, WhatsApp/SMS/eTIMS live providers, scheduled-report delivery
- [x] Final verify-local GREEN on 80143d1 — 687/687
- [x] Integration provider layer (AT SMS / WhatsApp Cloud / Resend email), status+test endpoints, real dispatch on notify-client/site-alerts/scheduled-reports, IntegrationsView UI
- [x] Site Safi brand applied everywhere; reference-platform name/URLs scrubbed from repo
- [x] Mobile-first: bottom tab nav on FieldDashboard + SupervisorDashboard
- [x] Missing GETs added: telematics-devices, site-webhook-logs, equipment dailyLogs serialized
- [x] integrations.test.ts (4 tests)
- [x] Final verify-local GREEN — 691/691 on 6858172
