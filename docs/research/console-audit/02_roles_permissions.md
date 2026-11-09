# 02 — Roles & permissions (Contractor workspace)

Source: Role manager UI (all 14 roles clicked and permission toggles read) + Team invite form + "Viewing as" switcher. `[OBSERVED]` unless tagged.

## Role catalogue (14 roles) `[OBSERVED]`

| Role | Description (verbatim-ish) | Invite via Team? |
|---|---|---|
| Contractor | Workspace owner. Full control over projects, finances, team, permissions. Can also be project Owner. | n/a (account owner) |
| Client | Project client with read access to progress, reports, inspection results. | NO — invited via project Client tab, creates own free account |
| Architect | Design lead. Reviews plans, comments, coordinates field clarifications. No financial approval authority. | Yes |
| Quantity Surveyor | Cost control. Tracks BOQs, validates quantities, supports financial reporting. Office/cost-based. | Yes |
| QA/QC Officer | Quality assurance. Creates inspections, fills checklists, verifies compliance. | Yes |
| Owner | Client/developer paying for project. Approves budget & change orders. | Yes (internal role) |
| Executive | Office leadership/assistant. Helps Contractor manage projects & approvals within configured limit. | Yes |
| Project Manager | Runs day-to-day on one or more projects. Approves COs up to configured limit. Does NOT manage workspace permissions. | Yes |
| Site Engineer | On-site technical lead. Coordinates inspections, tasks, quality readiness. | Yes |
| Superintendent | Jobsite lead. Assigns daily tasks to crews & trade leads. Mobile for field uploads. | Yes |
| Trade Lead | Head of sub-crew (Electrical, Plumbing, HVAC…). Accepts & assigns tasks, manages crew, uploads progress. Field-based. | Yes |
| Foreman | Crew foreman. Oversees workers on site, supports task completion. | Yes |
| Worker | Tradesperson. Mobile-first: view tasks, mark done, upload photos. | Yes |
| Viewer | Read-only: architect, inspector, lender, stakeholder. | Yes |

## Granular permissions (18 toggles per role) `[OBSERVED]`

View Financials · Approve Any CO · Create COs · Manage Team · Share Plans · View Reports · Audit Trail · Kanban Board · Field App · Assign Tasks · Complete Tasks · Workspace Owner · View Checklists · Use AI Assistant · Create Inspections · Fill Inspections · Approve Inspections · Inspection Reports — **plus "Approval Limit"** (max CO value the role can approve; `∞ Unlimited` for Contractor).

## Permission matrix `[OBSERVED — toggles read per role]`

| Permission | Contractor | Exec | PM | QS | QA/QC | Site Eng | Super | Trade Lead | Foreman | Worker | Architect | Owner | Client | Viewer |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| View Financials | ON | ON | ON | ON | OFF | OFF | ON | OFF | OFF | OFF | ON | ON | OFF | OFF |
| Approve Any CO | ON | ON | ON | OFF | OFF | OFF | OFF | OFF | OFF | OFF | OFF | ON | OFF | OFF |
| Create COs | ON | ON | ON | ON | OFF | OFF | ON | ON | OFF | OFF | OFF | OFF | OFF | OFF |
| Manage Team | ON | ON | OFF | OFF | OFF | OFF | OFF | OFF | OFF | OFF | OFF | OFF | OFF | OFF |
| Share Plans | ON | ON | ON | ON | ON | ON | ON | OFF | OFF | OFF | ON | OFF | OFF | OFF |
| View Reports | ON | ON | OFF | ON | OFF | OFF | OFF | OFF | OFF | OFF | ON | ON | ON | OFF |
| Audit Trail | ON | ON | ON | ON | ON | OFF | ON | OFF | OFF | OFF | ON | ON | OFF | ON |
| Kanban Board | ON | ON | ON | ON | ON | ON | ON | OFF | OFF | OFF | ON | OFF | OFF | OFF |
| Field App | ON | OFF | ON | ON | ON | ON | ON | ON | ON | ON | ON | OFF | OFF | OFF |
| Assign Tasks | ON | ON | ON | OFF | OFF | ON | ON | ON | OFF | OFF | OFF | OFF | OFF | OFF |
| Complete Tasks | ON | OFF | OFF | OFF | ON | ON | ON | ON | ON | ON | OFF | OFF | OFF | OFF |
| Workspace Owner | ON | OFF | OFF | OFF | OFF | OFF | OFF | OFF | OFF | OFF | OFF | OFF | OFF | OFF |
| View Checklists | ON | ON | ON | ON | ON | ON | ON | OFF | OFF | OFF | ON | ON | OFF | OFF |
| Use AI Assistant | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | OFF |
| Create Inspections | ON | ON | ON | OFF | ON | ON | ON | ON | ON | OFF | OFF | OFF | OFF | OFF |
| Fill Inspections | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | ON | OFF | OFF | OFF |
| Approve Inspections | ON | OFF | OFF | ON | ON | OFF | OFF | OFF | OFF | OFF | ON | OFF | OFF | OFF |
| Inspection Reports | ON | ON | ON | ON | ON | ON | ON | OFF | OFF | OFF | ON | ON | ON | ON |

Module access: 36 modules listed per role in Role manager; module visibility appears derived from these permissions [INFERRED — module toggles not separately observed].

## Approval chain model `[OBSERVED + INFERRED]`
- Change orders: Drafted → PM Review → Owner Approval → Approved/Rejected/Void. PM approves up to "Approval Limit"; Owner approves above it; Contractor unlimited.
- Inspections: Draft → Pending Consultant → In Review → Approved/Rejected/Rework Required → Closed. Consultant approval workflow built in.
- Payment applications: submit → approve/reject → mark-paid.

## Invite flow `[OBSERVED]`
Team → Invite member: FULL NAME, WORK EMAIL, ROLE (14 minus Client), TEMP PASSWORD (optional, auto-generated). "We'll email them an invite with sign-in details. If email isn't set up yet, you'll get the temporary password to share." Clients: "Open the project and use its Client tab. They create their own free account and password."

## "Viewing as" `[OBSERVED]`
Sidebar control "Viewing as: Contractor" — lets the owner preview the workspace as a role sees it (role-scoped nav). Exact mechanics partially observed [INFERRED].

## Live account probes — 2026-11-06 (owner-provided role accounts) [OBSERVED]

Four role accounts exercised read-only. Raw captures kept LOCAL ONLY (`/tmp/sasa-audit2/`) — not committed per audit remediation.

| Account role | Login path | Landing view | Sidebar scope | Access probes |
|---|---|---|---|---|
| Quantity Surveyor (watson) | Contractor sign-in | Dashboard (CO analytics widgets) | FULL module tree visible | Opened: Financials, Commitments, Quotes, Invoicing, Inventory, Inspections, Safety incidents, Team, Attendance, Reports, Correspondence, Directory, Subcontractors, Company documents, Coordination issues, Schedule, Daily log, Announcements, Inbox. **Role manager → ACCESS DENIED** (matches Manage Team=OFF) |
| Architect (abel) | Contractor sign-in | Dashboard | FULL module tree visible (incl. Role manager entry) | Same broad page access as QS incl. Financials/Quotes/Invoicing pages. **Role manager → ACCESS DENIED** despite menu entry visible |
| QA/QC Officer (QA-USER) | Contractor sign-in | **Projects** (not Dashboard — field-role landing) | **PRUNED**: no Dashboard; Money group shows only Inventory (no Financials/Commitments/Quotes/Invoicing); People group lacks Team + Role manager; Documents & reports lacks Reports | Opened: Inventory, Inspections, Safety incidents, Attendance, Correspondence, Directory, Subcontractors, Company documents, Coordination issues, Schedule, Daily log, Checklists, Punch list, Observations. Money/financial pages absent from nav entirely |
| Client/Owner (CLIENT@example.com…) | — | **LOGIN FAILED** — "Invalid email or password" on BOTH client and contractor paths (tried gmail.com; owner may have typo'd or invite not accepted) | — | Needs corrected credentials or invite acceptance |

### New observed facts
1. **Sidebar is role-pruned**, not just action-gated: QA/QC loses Dashboard, all Money pages except Inventory, Team/Role manager, and Reports. QS/Architect see the full tree but Role manager denies at open (permission ≠ menu visibility — inconsistent UX worth noting).
2. **Dashboard is role-specific**: contractor/QS/architect land on CO-analytics dashboard; QA/QC lands on Projects list. Confirms per-role default views [OBSERVED].
3. Page-level access ≠ action-level: QS/Architect can *open* Financials/Quotes/Invoicing pages — whether create/approve buttons inside are gated was NOT tested (would need form interaction; deferred).
4. Role manager remains the authoritative rights source — matrix above stands; probes confirm Manage Team and View Financials/Reports gating at nav level.
