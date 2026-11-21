# Admin console inventory — COMPANY_ADMIN / ADMIN / EXECUTIVE

Scope: signed-in web console (`/app/*`), roles COMPANY_ADMIN, ADMIN, EXECUTIVE
(identical navigation). Audited on branch `devin/contractor-lifecycle`.

Status legend:
- **works** — a committed Playwright UI test drives the primary action end to end, plus a committed screenshot exists under `docs/evidence/visual/<sha>/admin-console/`.
- **partly** — the screen renders, the click-through sweep (l2) found no dead control, and the 403 sweep (a8) is clean, but no dedicated UI test yet proves the primary workflow end to end.
- **dead** — a visible control does nothing (none found in the L2 sweep).
- **hidden** — not shown to this role by design.

Evidence specs referenced: `l1-new-project`, `l2-click-sweep`, `l3-admin-first-hour`,
`a3-boq-entry`, `a6-home`, `a7-nav`, `a8-permissions`, `w-admin-workflows` (W1–W10),
`admin-console-capture` (per-tab screenshots).

## Home

| tab | purpose | primary action | empty co. | demo data | click path | covering test | status |
|---|---|---|---|---|---|---|---|
| dashboard | Portfolio KPIs, attention, get-started | Open projects / checklist steps | Get-started checklist with 5 deep-linked steps | Attention cards + linked KPIs | Home | a6-home | works |
| inbox | Team notifications | open item | empty inbox message | seeded items | Home → Inbox | l2 sweep | partly |
| announcements | Company announcements | post announcement (manage) | empty state | seeded | Home → Announcements | l2 sweep | partly |

## Projects

| tab | purpose | primary action | empty co. | demo data | click path | covering test | status |
|---|---|---|---|---|---|---|---|
| all | Project list + create | New project (modal) | "No projects" + New project CTA | cards, select, CO counts | Projects → All | l1, a6, a7, w1 | works |
| schedule | Gantt / programme | view schedule, edit (canEdit) | select-a-project prompt | Gantt renders | Projects → Schedule | w-spec / l2 | partly |
| drawings | Drawing register | upload/register drawing | select-a-project prompt | seeded drawings | Projects → Drawings | w8, l2 | partly |
| changeorders | Variations / COs | raise + approve CO | select-a-project prompt | seeded COs, maker-checker | Projects → Change orders | w5, h2, l2 | works (approve path proven h2; full admin raise+approve in w5) |
| coordination | RFIs | raise RFI | select-a-project prompt | seeded RFIs | Projects → Coordination | l2 | partly |
| correspondence | Letters/contracts | create letter | list + create | seeded | Projects → Correspondence | l2 | partly |

## Site

| tab | purpose | primary action | empty co. | demo data | click path | covering test | status |
|---|---|---|---|---|---|---|---|
| fieldview | Mobile-first site board | view today | select-a-project prompt | live board | Site → Field view | l2 | partly |
| dailylog | Site diaries | new diary entry | empty state + CTA | seeded diaries | Site → Daily log | h5, l2 | works (field flow h5; admin view l2) |
| checklists | Checklist templates | assign template | empty + create | seeded | Site → Checklists | g5-6 api, l2 | partly |
| assignments | Checklist assignments | assign to crew | empty state | seeded | Site → Assignments | l2 | partly |
| punch | Snag/punch list | add snag, rectify, verify | empty + add | seeded snags | Site → Punch | j-stage3, l2 | partly |
| inspections | Inspection records | new inspection | empty + CTA | seeded | Site → Inspections | l2 | partly |
| observations | Site observations | log observation | empty + CTA | seeded | Site → Observations | g5-4 api, l2 | partly |
| actionplans | Corrective action plans | create plan | empty state | — | Site → Action plans | l2 | partly |
| safety | Incident register | log incident | empty + CTA | seeded | Site → Safety | g5-10 api, l2 | partly |
| attendance | Headcount register | mark attendance | empty + CTA | seeded | Site → Attendance | g5-10 api, l2 | partly |

## Money

| tab | purpose | primary action | empty co. | demo data | click path | covering test | status |
|---|---|---|---|---|---|---|---|
| financials | Overview/ledger/BoQ/retention/budget | BoQ tab: add/edit/delete/import | BoQ empty state w/ actions | active BoQ workbook | Money → Financials → Bill of quantities | a3-boq-entry | works |
| commitments | Payment applications / commitments | review commitment | empty state | seeded | Money → Commitments | l2 | partly |
| procurement | Purchase orders | raise PO | empty + CTA | seeded POs | Money → Procurement | j-stage3, l-procurement-ui, l2 | works (supplier-side proven j-stage3) |
| quotes | Quote builder + send | create quote, share link | empty + CTA | seeded quotes | Money → Quotes | a-quote-to-cash, l3 | works |
| invoices | Tax invoices + payments | create invoice, record payment | empty + CTA | seeded invoices | Money → Invoices | d-certificate-payment, l2 | partly (W6 proves admin path) |
| inventory | Materials/equipment | add stock item | empty + CTA | seeded | Money → Inventory | l2 | partly |
| certificates | Payment certificates | raise + issue cert | empty + CTA | seeded | Money → Certificates | d-certificate-payment | partly (W6) |
| subvaluations | Subcontractor valuations | certify sub-val | empty + CTA | seeded | Money → Sub valuations | l2 | partly |
| billing | Subscription & plan | view plan | plan card | seeded | Money → Billing & plan | l2 | partly |

## People

| tab | purpose | primary action | empty co. | demo data | click path | covering test | status |
|---|---|---|---|---|---|---|---|
| team | Members + invitations + roles | invite by email/phone, change role, remove | empty + invite CTA | members, pending invites | People → Team | w3, g5 api, l2 | works (w3) |
| crews | Crew definitions | create crew | empty + CTA | seeded | People → Crews | g5-5 api, l2 | partly |
| subcontractors | Subcontractor companies | add sub, award, portal link | needs project | seeded subs | People → Subcontractors | w7, e-portals | partly (w7) |
| directory | People directory | search/filter | list | seeded | People → Directory | l2 | partly |
| roles | Role/permission matrix | view roles | matrix | seeded | People → Roles | l2 | partly |

## Files & reports

| tab | purpose | primary action | empty co. | demo data | click path | covering test | status |
|---|---|---|---|---|---|---|---|
| reports | Report centre + export | run/export report | report list | seeded | Files → Reports | w9, l2 | partly (w9) |
| companydocs | Company document register | upload doc | empty + upload | seeded | Files → Company docs | w8, g5-7 api | partly (w8) |
| unfiled | Unfiled uploads triage | file/remove | empty state | — | Files → Unfiled | l2 | partly |

## Summary counts (this commit range)

- works: 8 tabs (dashboard, projects/all, changeorders, dailylog, financials/BoQ, quotes, team, + admin-first-hour journey)
- partly: 29 tabs — render correctly, sweep-clean, no 403s; awaiting dedicated end-to-end UI proof in W1–W10 and per-tab captures
- dead: 0
- hidden: 0 (billing visible to admin; module flags respected — no flag-gated tab appears for admin)

Known gaps carried into this round's findings:
1. Client project requests show a count on Home → links to Correspondence, but there is no dedicated review screen in the console (ClientRequestView is client-side only). **Finding.**
2. BoQ "applications"/sub-tab naming vs. Financials inner tabs — inner tab state (`ft`) is not URL-addressable; deep-linking to the BoQ sub-tab lands on Financials overview. **Finding (minor).**
