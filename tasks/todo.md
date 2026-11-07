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
- [ ] verify-local green on final head + evidence log
- [ ] PROJECT_STATUS.md + commit + push
