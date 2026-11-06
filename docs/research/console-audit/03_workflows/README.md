# 03 — Workflows

State machines and step tables per module group. All `[OBSERVED]` from UI + forms unless tagged.

## 3.1 Change orders (core differentiator)

List columns: NUMBER · TITLE · PROJECT · TRIGGER · COST · SCHEDULE · ASSIGNEES · STATUS. Filters: project, status. CSV export. "New change order".

**Statuses:** `Drafted → PM Review → Owner Approval → Approved | Rejected | Void`

**Create form fields:**
| Field | Type | Required | Options/notes |
|---|---|---|---|
| Title | text | * | |
| Description | textarea | | |
| Project | select | | MAKUNDI APARTMENTS |
| Number | text | auto if blank | sequence |
| Area / location | text | | |
| Trigger | select | | Design clarification, Owner request, Unforeseen condition, Code compliance, Structural review, Weather/delays, Other |
| Linked RFI | link | | ties to Coordination issues |
| Status | select | | full lifecycle |
| Cost impact | number (USD) | | |
| Schedule impact | number (days) | | |
| Requested by | user | | |
| Assignees | multi-user | | |

Approval model [INFERRED from role matrix]: PM approves within Approval Limit → Owner approves above limit → Contractor unlimited. Activity log per CO (`/activity` endpoint).

## 3.2 Quotes → project → deposit invoice

Statuses: `Draft → Sent → Accepted | Declined | Expired`. Actions: share (WhatsApp link `/public/quotes/:id`), client-comments, respond, convert (`/convert`), status.

**Form fields:** Job title*, Valid until, Client name*/phone (WhatsApp — "we use this to send the quote on WhatsApp")/email, Job site/address + GPS ("Use my location"/"Pick on map"), company logo/branding (shows "JUMUIA CONTRACTORS"), line items from templates (Kitchen remodel, Bathroom remodel, Tiling works, Painting & decor, Electrical works — more likely), units: m, m², m³, no, kg, day, hr, lot; Scope notes/inclusions/exclusions; Terms; Subtotal; Discount (KES); VAT %; Total; **Deposit to start %** → "When the quote becomes a project, a deposit invoice for this amount is drafted for you."

## 3.3 Invoicing (accounts receivable)

Statuses: `draft → sent → paid | overdue`. Columns: INVOICE # · CLIENT · AMOUNT · STATUS · DUE · PAID · BALANCE.

**Form fields:** Invoice #*, Status, Bill-to client name*/address, Ship-to (optional), Issue date, Payment terms (Due on receipt, Net 7/14/30/60), Due date, PO number, Line items (description/qty/rate/amount), Subtotal, Tax %, Discount, Shipping, Total, Amount Paid, Balance Due, Notes, Terms & Conditions.

## 3.4 Commitments → claims → payment applications → retention (money chain)

**Commitment** = subcontract or purchase order. Form: Vendor, Scope, Contract value, Retention %, Advance/mobilisation (optional) + Advance paid, "Recover % of each claim", Status (active/completed/overdue/on hold), Cost code. Steps shown in UI: 1 Add contract → 2 Certify their claims → 3 See what's owed (paid, held back, still to pay).

API chain `[OBSERVED]`: `/commitments/:id/claims`, `/claim-preview`, `/payment-applications` (submit/approve/reject/mark-paid), `/retention` (+`/release`), `/certificates`, `/retention/due`.

**Financials module tabs:** Overview · Ledger · Bill of quantities · Commitments · Applications · Retention. Metrics: Budget, Cash in, Deposits & advances, Cash out, Net, Budget vs actual. Export Excel/PDF.

## 3.5 Daily log

Purpose text: "Day-by-day site record — your evidence for claims, delays and disputes." Period filters (This week/Last 2 weeks); per-day cards; "0 of 7 days logged", labour-days, photos & videos, days with deliveries. "No work day?" option for non-working days.

**Form fields:** Date, Crew on site*, People on site, Work done today*, Where on site ("Use my location"/"Pick on map"), Weather (Clear/Cloudy/Light rain/Heavy rain/Windy/Hot/Cold/Auto/Not recorded), Labour·plant·deliveries (optional), Photos & video (video ≤20MB ~30–60s), **"Show these photos and videos to the client in the portal"** privacy toggle — "Untick for anything internal, like an accident or a supplier problem. The written notes are never shown to the client."

## 3.6 Inspections (QA/QC with consultant approval)

Statuses: `Draft → Pending Consultant → In Review → Approved | Rejected | Rework Required → Closed`. Table: TYPE · INSPECTOR · DATE · STATUS · TEMPLATE · ASSIGNEE · EVIDENCE.

**Request form:** Type (Quality, Safety, Structural, Environmental, Electrical, Plumbing, **Road Surface, Subgrade/Earthwork, Drainage/Culvert, Bridge Structural, Asphalt Compaction, Traffic Control Setup** — civil/infrastructure coverage too), Date, Inspector/requester, Assign to consultant (multi), Checklist template*, Notes, Readiness photos (0/10), Evidence photos/videos (0/10, 0/3). Endpoints: `/inspections/:id/approvals`, `/client-visible`.

## 3.7 Punch list (snags/defects)

Statuses: `Open → In Progress → Ready for Review → Resolved → Closed | Rejected`. Trade filter list = same 30+ trade taxonomy as crews/checklists (Masonry…Landscaping, Fencing, Bridge, Traffic Control, Surveying, Cleaning & Handover, Other). Endpoints: attachments, comments, status transitions.

## 3.8 Observations (quality/safety/environmental issues)

Types: Quality, Safety, Environmental, Commissioning. Priority: Low/Medium/High. Tabs: Observations / Corrective actions. Statuses: Open / In Review / Closed.

## 3.9 Coordination issues (RFI/clash/design question)

Types: RFI, Clash, Design Question. Priority Low/Med/High. Statuses: Open / Answered / Closed. Links to change orders via "Linked RFI".

## 3.10 Safety incidents

Types: Injury, Near Miss, Environmental, Property Damage, Struck by Equipment, Equipment Rollover, Cave-in/Trench Collapse, Traffic Incident, Asphalt Burn/Hot Material. Severity: minor/moderate/major/fatality. Statuses: open/investigating/closed. Fields: Date, Type, Severity, Description, Witnesses, Corrective action, Reporter.

## 3.11 Checklists

Tabs: Checklists · Assignments by trade · Templates · My checklists. Actions: Upload, Form Builder, New Template, AI from paper form (`/ai/extract-checklist-from-document`, `/ai/generate-checklist`, `/checklist-templates/from-csv|from-parsed|parse-file`). Template form offers the 30+ trade taxonomy. Endpoints: assign, progress, questions, responses, submit, share, submissions.

## 3.12 Schedule

Views: Gantt / List / Milestones. Scale: Weeks/Days. Activity statuses: Not started, In progress, Done, Blocked. "Add activity" (phases, activities, milestones) or **"AI schedule"**: Describe the project + Start date + Duration (weeks) → drafts phases/tasks/milestones (`/schedule/generate`).

## 3.13 Plans & drawings

0 drawings across 1 project. Filters by discipline: Architectural, Mechanical, Structural, Electrical, Civil, AI Concept. "AI Design — SOON" badge. Upload accepts "PDFs, images and CAD files". Endpoints: drawings, revisions, drawing-versions, viewer, `/drawings/:id/punch` (pin punch items on drawings).

## 3.14 People modules

- **Directory**: contacts/companies, categories Client/Consultant/Subcontractor/Supplier/Authority.
- **Subcontractors**: "Subcontractor & supplier database" — auto-attaches to commitments/bids by company name. Form: Company, Type (Subcontractor/Supplier), Contact person, Trade/what they supply, Phone, Email. Payments endpoint exists.
- **Crews**: roster by trade/shift/site. Form: Crew name*, Trade (33 options incl. Other), Foreman, Project*, Shift (Day/Night), Usual work area.
- **Team**: invite members with roles (see 02). 
- **Attendance**: Today/History/Team history/Access log tabs. "Mark team attendance", check-in/out/break, location, "Currently on site / Late today / On leave" counters, "Report Leave or Off-Day".
- **Role manager**: 14 roles × module access + permissions (see 02).

## 3.15 Documents & reports

- **Reports**: Financial/Operational/By Project/By Region/Custom/Scheduled tabs; Export PDF; metrics Total CO Value, Approval Rate, Median Cycle, Rework Rate; period 7D/30D/QTD/YTD; scheduled reports endpoint.
- **Company documents**: Policies/Templates/Certifications/Insurance/HR/Legal categories; NAME/CATEGORY/SIZE/UPLOADED BY/DATE.
- **Correspondence**: Letter/Submittal/Transmittal/Notice + Save Draft.
- **Coordination issues**: see 3.9.

## 3.16 Inbox & Announcements

- **Inbox**: team conversations, "New group", per-conversation members/read state (`/conversations`).
- **Announcements**: pinned/urgent flags, audience filters (Everyone/Project/Role/People).

## 3.17 Project detail (MAKUNDI APARTMENTS, P-UTR3)

Header: code P-UTR3, status Active, location Nairobi, created date, client "not assigned yet — Invite client", Edit project, "Set location" (weather pinning for build-day decisions), project photos.

**Tabs:** Overview · Analytics · Contract · Drawings · BOQ · Variations · Certificates · Finishes · Site · Cost control · Client · Reports · Closeout.

Overview shows: Project brief, Team, Health signals (Overdue programme items, Blocked items, Open defects, Open H&S incidents, Variations awaiting decision, Budget used, Forecast vs budget), "Needs your attention", Activity feed.

## Cross-module data flow `[INFERRED from endpoints]`
Quote →(convert)→ Project → BOQ → Commitments/cost codes → Claims → Payment applications → Certificates → Invoices → Client portal visibility. Change orders link to RFI, schedule (+days), cost, assignees. Daily-log photos gated per-item for client portal. Drawings → punch items. Checklists → inspections. Everything audited (`/access-logs`, audit trail permission).
