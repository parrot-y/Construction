# 15 — Role portal survey (8 team-role accounts, observed 2026-11-08)

Method: puppeteer login as each owner-provided account → dump sidebar nav (`.ws-nav`), per-section headings/actions. Raw screenshots/logs stay LOCAL in `/tmp/sasa-audit/roles/` (never committed). Credentials handled via env vars only — not stored anywhere.

## Universal shell (all contractor-side roles)

Left rail: **Ask the reference platform AI · Home · Projects · Site · Money · People · Files & reports** (+ profile chip, USD/KES toggle, "New" quick-create, workspace switcher "Create new"). Home always has **Dashboard/Inbox/Announcements** tabs (executive/PM see Dashboard; field roles see Team inbox). AI home also shows prompt chips: Quotes & estimates / Site & daily logs / Money & reports / Checklists & quality / Planning & schedule.

## Per-role matrix (OBSERVED)

| Role | Home | Projects tabs | Site extras | Money | People | Files & reports |
|---|---|---|---|---|---|---|
| **Executive** | Dashboard | All projects, Schedule, Plans & drawings, **Change orders**, **Coordination**, **Correspondence** | — | Financial tracker + **Billing & plan**, Export Excel/PDF; tabs Overview/Ledger/BOQ/**Applications**/Retention/Budget | Team, Crews, Subcontractors, Directory, **Roles**, Invite member | Reports, Company documents, Unfiled docs; report types Financial/Operational/By Project/By Region/Custom/**Scheduled** |
| **Project Manager** | Dashboard | same as Executive | — | Financial tracker (no Billing & plan) + exports | Team, Crews, Subcontractors, Directory, Roles (no Invite) | Company documents (categories: Policies/Templates/Certifications/Insurance/HR/Legal) + Unfiled + Upload |
| **Site Engineer** | Team inbox | no Change orders tab | **Field view** button | **Inventory only** (Materials/Equipment, Add item) | Crews, Subcontractors, Directory, New Crew | Company documents |
| **Superintendent** | Team inbox | incl. Change orders | Field view | Full financial tracker + exports (no Billing & plan) | Crews, Subcontractors, Directory, Roles, New Crew | Company documents |
| **Trade Lead** | Team inbox | no Change orders | Field view | **Invoicing** (Invoices, Inventory, PDF) | Crews, Subcontractors, Directory, Roles, New Crew | Company documents |
| **Foreman** | Team inbox | no Change orders | Field view | Inventory only | Crews, Subcontractors, Directory, New Crew | Company documents |
| **Worker** | Team inbox | Projects opens **Plans & drawings** (trade filters: Architectural/Mechanical/Structural/Electrical/Civil/AI Concept, "AI Design SOON") | Field view | Inventory only | — (no People section) | — (no Files section) |
| **Viewer** | login accepted but workspace shell did not render — BLOCKED, needs re-check | | | | | |

## Site section sub-tabs (all field-capable roles)
Daily log · Checklists · Assignments · Punch list · Inspections · **Observations** · **Action plans** · Safety · Attendance · (+ Field view for site roles)

## Projects section sub-tabs
All projects · Schedule · Plans & drawings · Change orders* · Coordination · Correspondence (*= senior roles only). Filters: All/Active/At Risk/Planning/Closing/Archived.

## Money section (Financial tracker)
Top tabs: Financials · Commitments · Quotes · Invoices · Inventory · Billing & plan (executive only). Sub-tabs: Overview · Ledger · Bill of quantities · Applications · Retention · Budget. Export Excel + Export PDF.

## People section
Team · Crews · Subcontractors · Directory · Roles · Invite member (availability varies by role — see matrix).

## Files & reports
Reports · Company documents · Unfiled documents · Filters · Export PDF · report types: Financial / Operational / By Project / By Region / Custom / Scheduled.

## Gaps this reveals for our platform (to implement)
1. **Role taxonomy expansion** — we have PM_QS/SITE_SUPERVISOR/CLIENT/etc.; observed ladder: EXECUTIVE > PM > SUPERINTENDENT > SITE_ENGINEER > TRADE_LEAD > FOREMAN > WORKER > VIEWER (+CLIENT, SUBCONTRACTOR portals already done).
2. **New modules not yet built:** Inbox (team messaging), Observations, Action plans, Assignments, Crews, Directory, Roles admin, Company documents vault (categories: Policies/Templates/Certifications/Insurance/HR/Legal), Unfiled documents triage, Scheduled reports, Coordination + Correspondence project tabs, Plans & drawings viewer (trade-filtered), Field view (mobile-first field UI), Attendance module.
3. **Permission scoping pattern:** same IA for all; capabilities gated per role (Money depth, People write access, Files access, CO tab visibility).

## Deep-dive captures (PM account, 2026-11-08)

- **Observations**: list + "New Observation" — fields: title, type (Quality/Safety/Environmental/Commissioning), priority (Low/Medium/High), location ("Level 2 — Grid C4"), project, description. Statuses: Open / In Review / Closed. Sub-tab "Corrective actions" with "New corrective action": plan title, owner, due date, project, **source ref (e.g. OBS-102 — links to observation)**, ordered steps (Step 1…). Statuses: Active / Overdue (derived) / Completed.
- **Assignments**: "Assignments by trade" + "Assign a form" — checklist/form assignment to trades.
- **Checklists**: Templates / My checklists / Upload / **Form Builder / New Template** (AI extraction from paper forms).
- **Attendance**: Today / History / Check In / Report Leave or Off-Day.
- **Crews**: crew list management (New Crew for senior field roles).
- **Correspondence** (Projects tab): types **Letter / Submittal / Transmittal / Notice** + AI draft ("delay notice to client").
- **Coordination** (Projects tab): "Coordination issues" — unified RFIs & issues view.
- **Company documents** (Files): categories Policies / Templates / Certifications / Insurance / HR / Legal + **expiry tracking** ("which documents expire soon?") + Upload. "Unfiled documents" triage.
- **Reports**: Financial / Operational / By Project / By Region / Custom / **Scheduled** + Export PDF/Excel.
- Every list has an "Ask the reference platform AI" inline prompt scoped to that module.

## Second deep-dive pass (PM account)

- **Safety**: "Safety incidents" register + Report button (maps to our SafetyIncidentLogView).
- **Inspections**: "New Request" flow.
- **Punch list**: CSV + PDF export, Create Punch Item (covered by snag module; export pending).
- **Assignments**: "Assignments by trade" + "Assign a form" — checklist/form assignment with statuses Draft/Assigned/In Progress/Submitted/Approved/Rejected, trade+project filters.
- **Coordination**: "Coordination issues" unified RFIs & issues search (our RFI module covers base; unified view pending).
- **Checklists > New Template**: title, 15 trade categories (General/Masonry/Concrete/Steel Fixing/Carpentry/Electrical/Plumbing/Painting/Tiling & Flooring/Roofing/Structural Steel/Welding & Fabrication/Glazing & Aluminium/Waterproofing/Scaffolding), kind (safety/quality/pre-handover/custom), **Global template flag**, question builder: Text/Number/Date/Yes-No/Pass-Fail/Dropdown/Checkbox/Photo/Signature + required + options.
# Pending doc updates (write AFTER verify completes)

## 15_role_portals.md additions:
- Safety: "Safety incidents" register + Report (covered by SafetyIncidentLogView)
- Inspections: "New Request" flow
- Punch list: CSV + PDF export buttons, Create Punch Item
- Assignments: "Assignments by trade" + "Assign a form" — statuses Draft/Assigned/In Progress/Submitted/Approved/Rejected → IMPLEMENTED G5-6
- Coordination: "Coordination issues" unified RFIs & issues search
- Checklists > New Template: 15 trades, kind safety/quality/pre-handover/custom, Global flag, question types Text/Number/Date/Yes-No/Pass-Fail/Dropdown/Checkbox/Photo/Signature → IMPLEMENTED G5-6
- Plans & drawings: discipline filters Architectural/Mechanical/Structural/Electrical/Civil + AI Design SOON + AI Concept + Upload drawings
- Money/People tab navigation didn't respond to probe clicks for PM (section headers collapsed differently) — NOT REACHED this pass
