# GATE4_BUILD_PLAN.md — Contractor-hub first slices

**Date:** 2026-11-07 · **Status:** DRAFT for owner approval
**Basis:** `docs/MVP_SCOPE.md` (MUST list), `docs/PRD.md`, ADR-007…010, `docs/research/console-audit/` observed workflows, existing schema (79 models) + ~40 view components.

## Strategy
All portals sync inside the contractor hub. Build order = money chain dependency order, Kenya wedges embedded from day one (KES default, M-Pesa-ready payment terms, eTIMS fields, SMS/WhatsApp share). Each slice = schema delta + API + UI + tests, shipped behind the existing tenant/RBAC/audit spine.

## Slice plan (contractor hub)

### S1 — Quotes → cash (ADR-007) · highest value, competitor's killer flow
- **Schema (new):** `Quote` (number auto Q-####, title, clientName/phone/email, siteLocation, currency, status Draft/Sent/Accepted/Declined/Expired, validUntil, depositPct, taxPct, terms, scopeNotes, projectId nullable), `QuoteLineItem` (section, description, unit enum, qty, rate), `QuoteEvent` (activity log), share token on Quote.
- **API:** CRUD, `POST /quotes/:id/send` (generates share link + optional email/WhatsApp dispatch hooks), `POST /public/quotes/:token/respond` (accept/decline/comment — typed-name e-signature per observation), `POST /quotes/:id/convert` → creates Project + optional deposit Invoice.
- **UI:** Quotes list (status filters, CSV), quote editor (line items, templates later), send panel (Copy/WhatsApp/Email/PDF), client-facing public quote page.
- **Client portal:** "Quotes & proposals" inbox keyed on **client email match** (observed behaviour), quotation doc view, accept/decline/comment thread.
- **Tests:** quote lifecycle, token authz (no tenant leak), email-match visibility, convert→project idempotency.
- **Acceptance:** contractor sends quote → client accepts with typed name → contractor sees "Accepted by X" → converts to project → deposit invoice drafted.

### S2 — Invoicing AR
- **Schema (new):** `Invoice` (number, project, client bill-to, status draft/sent/paid/overdue, issue/due dates, PO ref, taxPct, terms), `InvoiceLineItem`, link to `CostReceipt`/payment.
- **API:** CRUD, `POST /invoices/:id/record-payment`, status derivation (overdue cron/derived), PDF render (existing PDFKit path).
- **UI:** Invoicing list + form (observed fields: terms Net 7/14/30/60, M-Pesa in terms placeholder), PDF, Record payment.
- **Tests:** status transitions, balance math, tenant isolation.

### S3 — Change-order engine (unify VariationOrder → CO lifecycle)
- **Schema delta:** add to `VariationOrder` (or new `ChangeOrder` view over it): trigger enum (Design clarification/Owner request/Unforeseen/Code/Structural/Weather/Other), requestedBy, linkedRFI, assignees, approvalLimit fields per role, status machine Drafted→PM Review→Owner Approval→Approved/Rejected/Void, `COEvent` activity log.
- **API:** transition endpoints enforcing **approval limits** (ADR-010) — PM within limit, Owner above; contractor self-approve only within own limit.
- **UI:** CO list (net cost/schedule aggregates, CSV), detail panel with per-status actions (observed button sets), activity feed.
- **Client portal:** CO approval via token link `/public/portal/:token/change-orders/:id`.
- **Tests:** limit enforcement matrix per role, illegal-transition rejection, activity log completeness.

### S4 — Certificates, retention & closeout (ADR-008)
- **Schema (new):** `PaymentCertificate`/`PaymentApplication` unified record (observed: applications and certificates share one model), period valuation fields, retentionPct, advanceRecovery, netPayable computed, status Submitted→Under review→Certified→Paid/Rejected; `CloseoutStage` machine on Project (In progress→Handed over→Defects liability→Defects expired→Closed) with prerequisite checklist gating retention release.
- **Depends on:** contract sum as first-class project field (set via "Contract value & dates" editor — observed), BOQ total → budget link.
- **UI:** project tabs Certificates + Closeout (13-tab project detail is the target IA — see `12_deep_pass` §1).
- **Tests:** retention math, closeout gating, certificate cumulative totals.

### S5 — Commitments → claims → payment applications
- **Schema (new):** `Commitment` (vendor, scope, contractValue, retentionPct, advance, advancePaid, recoverPct, status, costCode), `Claim`/`PaymentApplication` (period, requested, retention, netPayable, Submit/Mark paid).
- **UI:** Commitments page (3-step mental model: contract→claim→owed), Financials tracker tabs (Overview/Ledger/BOQ/Commitments/Applications/Retention/Budget).
- **Tests:** retention derivation, advance recovery math.

### S6 — Punch/snag depth
- Extend `SnagItem`: 36-trade taxonomy, priority, due date (fix their date bug — we won't replicate), manager + final-approver roles, distribution list, cost/schedule impact scales, private flag, status machine Open→In Progress→Ready for Review→Resolved→Closed/Rejected, comments + photos.

### S7 — Daily-log client media privacy (ADR-009)
- `SiteDiary`/`SitePhoto`: per-media `clientVisible` flag; written notes NEVER client-visible (observed rule); crew/weather/location fields per observed form.

### S8 — Project onboarding & edit
- Project create/edit matching observed Edit-project modal: name*, code, contract value ($/KSh), location + map pin, description, progress%, money-at-risk, status lifecycle (Planning/On Track/At Risk/Closing/Archived), PM/Architect/QS assignment, images, documents; "Contract value & dates" editor (possession-of-site + completion).

## Cross-cutting (every slice)
- KES default currency, USD optional toggle; M-Pesa references in payment terms; eTIMS fields on tax invoices; SMS/WhatsApp notification hooks; offline queue for field modules; audit log on every mutation; tenant isolation tests per slice.

## Explicitly deferred (SHOULD/LATER)
Checklists+AI extraction, inspection consultant chain, observations/corrective actions, correspondence, crews/attendance split, schedule Gantt+AI, drawings revision viewer, company docs vault, scheduled reports, announcements, inbox chat, bidding module, role presets beyond 4 V1 roles.

## Order rationale
S1 first = revenue loop + validates client-portal sync pattern that S3/S4 reuse. S2 cheap AR. S3 is the observed core loop. S4/S5 complete money chain. S6–S8 field/UX depth.

## Gate 4 exit criteria
Each slice merges with: schema migration, API routes + authz tests, UI view, client-portal surface where applicable, `verify-local.sh` green, evidence log updated.
