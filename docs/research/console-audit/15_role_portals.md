# 15 — Role portal survey (8 team-role accounts, observed 2026-11-08)

Method: puppeteer login as each owner-provided account → dump sidebar nav (`.ws-nav`), per-section headings/actions. Raw screenshots/logs stay LOCAL in `/tmp/sasa-audit/roles/` (never committed). Credentials handled via env vars only — not stored anywhere.

## Universal shell (all contractor-side roles)

Left rail: **Ask Buildsasa AI · Home · Projects · Site · Money · People · Files & reports** (+ profile chip, USD/KES toggle, "New" quick-create, workspace switcher "Create new"). Home always has **Dashboard/Inbox/Announcements** tabs (executive/PM see Dashboard; field roles see Team inbox). AI home also shows prompt chips: Quotes & estimates / Site & daily logs / Money & reports / Checklists & quality / Planning & schedule.

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
