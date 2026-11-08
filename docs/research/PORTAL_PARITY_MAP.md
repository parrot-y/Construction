# Portal parity map — our platform vs observed reference portals

Source: `docs/research/console-audit/15_role_portals.md` (8-role survey, OBSERVED).
Our side: seed accounts `*@apexbuilders.co.ke` (see `packages/db/prisma/seed.ts`),
dashboards in `apps/web/src/components/Dashboard.tsx`.

Legend: ✅ implemented+tested · 🟡 partial · ❌ gap · — n/a

## Role → our login → dashboard

| Role | Seed login | Dashboard component | Portal surface |
|---|---|---|---|
| COMPANY_ADMIN | admin@ | CompanyAdminDashboard | Company hub: members, invites, projects, company docs, quotes, invoices, commitments, certificates, announcements, scheduled reports |
| PM_QS | qs@ / pm@ | PmQsDashboard | Full contractor hub — ~45 tabs (cost, BOQ, variations, RFIs, quality, schedule, store, safety, drawings, subcontractors, delays, taxes, requisitions, wastage, cashflow, subvaluations, equipment, muster, safety audits, eTIMS, WhatsApp, retention/bonds, geofence, telematics, rebar, B2C, RMC, steel, soil, asphalt, survey, inspections, tenders, quotes, invoices, commitments, project, announcements, inbox, observations, crews, documents, correspondence, scheduled reports, attendance, checklists) |
| SITE_SUPERVISOR | supervisor@ | SupervisorDashboard | Field ops hub — diary, progress, costs, schedule, inventory, safety, snags, attendance, checklists, RFIs, observations, crews, documents, correspondence, announcements, inbox |
| EXECUTIVE | executive@ | ExecutiveDashboard | Portfolio KPIs, project focus picker, inbox, announcements, observations, scheduled reports, company documents (read-mostly) |
| SUPERINTENDENT | superintendent@ | FieldDashboard | Project picker, inbox, announcements, attendance, checklists, schedule, drawings, RFIs, observations, crews, tenders, correspondence |
| SITE_ENGINEER | engineer@ | FieldDashboard | same as superintendent |
| TRADE_LEAD | tradelead@ | FieldDashboard | same + tender bid submission |
| FOREMAN | foreman@ | FieldDashboard | same, crew-level |
| WORKER | worker@ | FieldDashboard | same, minimal perms (diary/progress/inspections view) |
| VIEWER | viewer@ | FieldDashboard (readOnly) | read-only across all field views |
| CLIENT | client@ | ClientDashboard + console-style tabs | Live client-portal hydrate: project, financials, progress, photos (opt-in only), timeline, pending variations, payment certificates, quotes, Messages tab |
| ARCHITECT | architect@ | AppShell (console) | Reference-observed: exec dashboard home; all projects/site tabs; money minus billing; people minus crews; docs+reports files |
| QA_QC | qaqc@ | AppShell (console) | Reference-observed: field inbox home; projects minus change orders; all site tabs; inventory-only money; subs+directory people; docs-only files |

## Feature parity vs observed reference (per module)

| Observed module | Reference surface | Ours | Status |
|---|---|---|---|
| Dashboard/Inbox/Announcements home tabs | all roles | Dashboard + InboxView + AnnouncementsView | ✅ |
| Ask AI prompt chips | all roles | — | ❌ (no AI layer) |
| Projects tabs (Schedule, Plans & drawings, Change orders, Coordination, Correspondence) | exec/PM/supt | schedule(Gantt live), DrawingsView, VariationManagementView(CO), RfiManagementView, CorrespondenceView | ✅ |
| Field view tab | all site roles | Site > Field view — quick actions + my assigned checklists | ✅ |
| Money: Financial tracker + exports | exec/PM/supt | CostManagementView, InvoicingView, VarianceMonitor, S-curve, reports PDF + financials.xlsx (cash flow/COs/commitments) | ✅ |
| Money: Billing & plan | exec only | — | ❌ (SaaS billing exists at /billing but not surfaced per-role) |
| Money: Inventory only | engineer/foreman/worker | SiteInventoryManagementView (live) | ✅ |
| Money: Invoicing | trade lead | InvoicingView mounted in PmQs; trade lead sees via FieldDashboard? — verify | 🟡 |
| People: Team/Crews/Subcontractors/Directory/Roles/Invite | role-scoped | CrewsView, SubcontractorManagementView(wiring), CompanyAdmin members+invite, Directory=site laborers | 🟡 (Roles admin page, Directory view pending) |
| Files: Company documents + Unfiled + expiry | exec/PM/field | CompanyDocumentsView (live, categories+unfiled+expiry) | ✅ |
| Files: Reports incl. Scheduled | exec/PM | ScheduledReportsView + run history | ✅ (delivery ❌ no provider) |
| Site: Daily log | field | SiteDiaryModal + diary PDF | ✅ |
| Site: Checklists (templates, my checklists, assignments by trade) | field | ChecklistsView (templates+assignments) | ✅ (AI extraction ❌) |
| Site: Assignments | field | ChecklistsView assignments tab | ✅ |
| Site: Punch list + CSV/PDF | field | SnaggingListView + export csv/pdf | ✅ |
| Site: Inspections + New Request | field/consultant | inspections API + consultant review chain | ✅ |
| Site: Observations + Corrective actions | field | ObservationsView | ✅ |
| Site: Safety incidents | field | SafetyIncidentLogView + SafetyAuditScorecardView (live) | ✅ |
| Site: Attendance (Today/History/Check-in/Leave-Off-Day) | field | AttendanceView + laborer registration | ✅ |
| Site: Crews + New Crew | senior field | CrewsView | ✅ |
| Plans & drawings: discipline filters + upload + markup | all | DrawingsView (5 disciplines, file upload, preview, click-to-pin annotations w/ resolve) | ✅ (AI Design ❌ provider) |
| Coordination: unified issues | PM+ | RfiManagementView (live) | 🟡 (unified RFI+issue search view pending) |
| Correspondence: Letter/Submittal/Transmittal/Notice + AI draft | PM+ | CorrespondenceView | ✅ (AI draft ❌) |
| Tenders/bidding | — | TendersView (live) | ✅ (reference NOT REACHED) |

## Cross-portal handoffs (our implementation)

- PM/QS → field: role-targeted inbox + announcements (FIELD_TEAM audience) ✅
- Site → PM/QS: observations → corrective actions → PM review ✅
- Field → client: daily updates + opt-in photos only (notes never shared) ✅
- PM/QS → client: OWNER_REVIEW variations, payment certificates ✅
- PM/QS → subcontractor: token portal (snags, packages, valuations) ✅
- Consultant → inspections: INSPECTION_REVIEW approval gate ✅
- Scheduled reports → recipients: snapshot+history (delivery pending) 🟡

## Form-level parity additions (2026-11-08 second pass)

- CO modal: linked RFI + multi-assignee selects; RFI issue_type (RFI/CLASH/DESIGN_QUESTION)
- Safety incident hazard taxonomy extended; daily-log weather +wind/hot/cold
- Crew/subcontractor trade lists matched to observed taxonomy (+Interior Design & Decor)
- Reports: CO volume-by-status chart; client portal "My sites" multi-project picker
- Ask Site Safi: live-data answers (open snags, pending COs, attendance, unpaid invoices)
- Home module grid: full 15 modules incl. Materials & equipment, Team/roles/crews, Interior design
- Client portal nav now exact: Home / My sites / Messages / Quotes & proposals / Site reporting / Request a project / Account

## Seed accounts for portal comparison

All on `*@apexbuilders.co.ke`, dev password `Password123!` (change before deploy):
admin, qs, pm, supervisor, executive, superintendent, engineer, tradelead, foreman, worker, viewer, client.
14 role logins on `*@apexbuilders.co.ke` (added ARCHITECT + QA_QC 2026-11-08 after live capture of the reference architect/QA-QC portals). Run `pnpm --filter @construction/db db:seed` (or verify-local seed step) to materialize.
