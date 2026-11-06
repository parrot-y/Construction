# MVP_SCOPE.md — V1 feature cut (Gate 2 output)

**Date:** 2026-11-06 · **Status:** DRAFT for owner approval
**Basis:** Buildsasa console research (`docs/research/console-audit/`) + existing MjengoLedger milestones M0–M10 + discovery synthesis.

## Guiding principle
Thin end-to-end slices in the money chain: **BOQ → budget → progress/cost → evidence → approval → client visibility**. Everything else is "later" unless it's table stakes for the core loop.

## Roles & portals — coverage plan (all Buildsasa roles mapped, delivered in steps)

| Phase | Role/portal | Buildsasa equivalent | Our V1 status |
|---|---|---|---|
| Now (built) | Company Admin / Contractor | Contractor | ✅ exists |
| Now (built) | PM/QS | Project Manager + Quantity Surveyor (merged) | ✅ exists |
| Now (built) | Site Supervisor | Foreman/Trade Lead/Superintendent/Worker/Field App (merged mobile-first) | ✅ exists |
| Now (built) | Client/Developer portal | Client account + token portal | ✅ exists (M9) |
| Now (built) | 4 external stakeholder portals (consultant, subcontractor, supplier, compliance) + token links | `/api/public/*` capability links | ✅ exists |
| Later | Architect | Architect role | permission-based role — config, not new code |
| Later | QA/QC Officer | QA/QC Officer | config + inspection module extension |
| Later | Owner (approver) | Owner | config on PM/QS approval chain |
| Later | Executive | Executive | config |
| Later | Site Engineer | Site Engineer | config |
| Later | Trade Lead / Foreman / Worker split | field roles | split Supervisor into crew-level roles when crews module lands |
| Later | Viewer | Viewer | read-only permission preset |

**Rule:** new "roles" are permission presets on our existing permission-based RBAC — no rebuild. The 14-role catalogue is our expansion map.

## MVP feature cut

### MUST (core loop — mostly built, needs hardening)
- Auth + tenancy + RBAC + audit (M1–M3) ✅
- Company/users/invites/projects/role dashboards (M3) ✅
- BOQ import (Excel, EASMM) (M4) ✅
- Budget, cost ledger, approvals, receipts (M5) ✅
- Site diary, photos (GPS, client-visibility toggle), progress %, offline queue (M6) ✅ — **add per-photo client-visibility toggle [from Buildsasa]**
- Variance monitor, project dashboard (M7) ✅
- Variations workflow (M8) ✅
- Client portal: progress, photos, retention terms, pending variations (M9) ✅
- PDF reports: IPC, diary, summary (M10) ✅
- **Change orders with trigger/cost/schedule impact + PM→Owner approval chain + approval limits** [Buildsasa core — partially = our variations; unify]
- **Quotes → WhatsApp share → client accept → convert to project → deposit invoice** [Buildsasa killer flow — NEW]
- **Invoicing AR**: draft/sent/paid/overdue, terms, line items, tax % [NEW, simple]
- **Commitments → claims → payment applications → retention release → certificates** [extends M5/M10]
- **Punch list / snags** with trade taxonomy + comments [NEW — we have snagging model from lifecycle milestone]
- **Daily log client-visibility controls** [NEW detail]
- **KES-first + M-Pesa (STK) for subscription billing** (ADR-006 exists)
- **eTIMS-ready tax invoice fields** (real integration later; correct disclaimers now — C2 done)

### SHOULD (post-MVP, next slices)
- Checklists: templates by trade, assignments, submissions, AI-from-paper, Form Builder
- Inspections w/ consultant approval chain + evidence photos
- Observations + corrective actions; Coordination issues (RFI/clash/design Q)
- Safety incidents (minor/moderate/major/fatality + corrective action)
- Schedule: Gantt/list/milestones + AI schedule generator
- Plans & drawings: upload, revisions, viewer, pin punch items
- Attendance check-in/out + leave
- Crews/foremen/trades taxonomy
- Correspondence (letter/submittal/transmittal/notice)
- Company documents vault
- Reports: scheduled reports, PDF exports, custom
- Inbox team chat + announcements (or integrate WhatsApp/SMS instead — decide)
- Inventory: materials + equipment, stock movements, low-stock
- Multi-currency display (KES base + USD/GBP/EUR/AED — diaspora clients)
- Role manager UI: expose permission presets for the 14-role catalogue

### LATER
- Bidding/bid-packages marketplace, Jobs/requests
- AI credits metering, AI design concepts
- Self-hosted offering
- Native mobile app (PWA covers it)
- Accounting integrations (QuickBooks/Xero) — build own ledger first
- SMS gateway — evaluate Africa's Talking vs WhatsApp Business API cost

## Explicitly OUT (not copying)
- Their branding, copy, trade taxonomy verbatim (we adapt the concept), 36-module sprawl up front, USD-default pricing.

## Success metrics (draft)
- Pilot: 1 contractor + 1 client using daily logs + 1 CO + 1 certificate end-to-end.
- Activation: project created → BOQ imported → first diary → first client portal view.
- Retention: weekly active projects; M-Pesa subscription conversion post-pilot.
