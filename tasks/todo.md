# tasks/todo.md — active plan

## Current: Gate 4 — Slice S1 Quotes→cash (2026-11-07)

- [x] Prisma schema: `Quote`, `QuoteLineItem`, `QuoteEvent` models + relations
- [x] Permissions: `QUOTE_CREATE/VIEW/EDIT/SEND` in `@construction/permissions`
- [x] Validation schemas: create/update/send/public-respond/convert in `@construction/validation`
- [x] `apps/api/src/routes/quotes.ts` — full lifecycle:
  - Contractor: list, detail, create (computed totals), edit-draft-only, send, convert→project
  - Client portal: `GET /api/v1/client/quotes` (email-matched inbox)
  - Public: `GET /api/public/quotes/:token`, `POST .../respond` (typed-name accept/decline/comment)
- [x] Security: share token stored as SHA-256 hash only; `lookup_quote_by_share_hash` SECURITY DEFINER fn in rls.sql (same pattern as portal links); token rotates on re-send; all public reads/writes inside `withTenantTx` under RLS
- [x] Tests: `apps/api/src/quotes.test.ts` — 15 tests (RBAC, totals, send, public view/respond, client inbox, tenant isolation, convert, event trail)
- [x] verify-local.sh GREEN — 343/343 tests, typecheck/lint/build clean (evidence: docs/evidence/verify-7ff5992.log)
- [x] Backend committed + pushed (`fb3a036`)
- [x] `POST /api/v1/client/quotes/:id/respond` — authenticated client accept/decline (email-matched, typed-name)
- [x] Frontend:
  - `QuotesManagementView.tsx` — contractor quotes module (create form w/ line items, live totals, send→share link, detail+events, convert)
  - `ClientQuotesView.tsx` — client portal quotes inbox w/ inline typed-name accept/decline
  - `PublicQuoteView.tsx` — public share-link page (`?portal=quote&token=`)
  - Wired: PmQsDashboard '💼 Quotes & Cash' tab, CompanyAdminDashboard section, ClientDashboard section, App.tsx portal route
- [x] verify-local.sh GREEN — 344/344 API tests, 113/113 web tests, typecheck/build clean (`docs/evidence/verify-fb3a036.log`)
- [x] Commit + push S1 (`683ae24`) — backend `fb3a036` + frontend `683ae24`

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
