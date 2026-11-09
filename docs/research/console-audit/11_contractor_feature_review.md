# 11 — Contractor dashboard: feature-by-feature review & improvement plan

**Purpose:** go through every sidebar feature in the contractor console and decide what our product must match or beat — so the contractor side is the solid hub every other portal syncs into. [OBSERVED] = seen live; [INFERRED] = reasoned; "Our status" = what exists in this repo today.

**Thesis (owner-directed):** make the contractor dashboard excellent; staff/client/field portals then plug into it rather than being bolted on.

---

## Global shell

| Element | Observed | Our action |
|---|---|---|
| Ctrl+K global search (projects, COs, people) | [OBSERVED] | Add project-scoped quick search early — cheap, high daily-use value |
| "New" universal create menu (CO / project / daily log / schedule / Ask AI) | [OBSERVED] | Single create entry point per role; reduces hunting |
| Currency toggle KES⇄USD | [OBSERVED] | **KES default, USD optional** — they default USD; we invert |
| Dark mode | [OBSERVED] | We have Tailwind dark tokens — verify coverage |
| "Viewing as" role preview | [OBSERVED] | Implement as permission-presets preview for admins (later phase) |
| Trial banner + plan CTA | [OBSERVED] | Standard SaaS — include in billing slice |
| Onboarding tour | [OBSERVED] — but reappears, can't dismiss | Do better: dismissible, per-role, resumable |

## Inbox
Team chat: conversations, "New group", per-conversation members/read state. [OBSERVED]
- **Improve:** WhatsApp/SMS-first notifications instead of in-app-only chat; in-app inbox is table stakes but won't be opened daily by site staff. Defer full chat; ship notifications + comment threads per record first.

## Dashboard
CO-pipeline analytics (Drafted→PM Review→Owner→Approved), value charts, "Needs your attention", activity feed, health signals. Role-specific landing (QA/QC lands on Projects). [OBSERVED]
- **Improve:** our dashboard should lead with **money + evidence**: budget vs actual, certificates due, pending approvals, today's site status — not just CO funnel. Add "needs attention" inbox pattern (it works well).

## Announcements
Pinned/urgent, audience targeting (Everyone/Project/Role/People). [OBSERVED]
- **Improve:** simple project announcements + push/SMS for urgent safety notices; role-targeting later.

## Projects group
- **All projects**: filter tabs Active/At Risk/Planning/Closing/Archived, project cards w/ schedule %, value, COS. [OBSERVED] → we have projects; add lifecycle status tabs + at-risk signal.
- **Change orders**: list/CSV, trigger taxonomy, linked RFI, cost+schedule impact, assignees, 3-stage approval w/ limits. [OBSERVED] → **ADR-010 covers; top MUST slice.**
- **Plans & drawings**: discipline filter, PDF/image/CAD upload, revisions, viewer, pin-punch, "AI Design SOON". [OBSERVED] → we have ProjectDocument partial; add viewer + revision chain + pin-to-punch later (SHOULD).
- **Schedule**: Gantt/List/Milestones, activity statuses, **AI schedule generator**. [OBSERVED] → we have ProjectScheduleTask; add milestone view + AI draft later.
- **Daily log**: per-day cards, "No work day?", labour/photos/deliveries counters, **per-photo client-visibility toggle**, weather auto-capture, "evidence for claims/disputes" framing. [OBSERVED] → we have SiteDiary+photos; **add client_visible flag (ADR-009) + weather auto + non-working-day option**.
- **Site checks** → routes into Daily log. [OBSERVED] → fold into daily log/checklists.
- **Checklists**: Templates/Assignments-by-trade/My checklists; Upload, **Form Builder**, **AI from paper form/CSV**, 30+ trade taxonomy. [OBSERVED] → we have InspectionChecklist; add template library + assignment + AI-extract later (SHOULD, high value for Kenyan paper-based sites).
- **Punch list**: 30+ trades, Open→In Progress→Ready for Review→Resolved→Closed/Rejected, attachments+comments. [OBSERVED] → we have SnagItem; align statuses + trade taxonomy.
- **Observations**: Quality/Safety/Environmental/Commissioning + corrective actions, priority levels. [OBSERVED] → we have SnagItem/RFI; consider unified "issue" model with type field (design decision for slice).

## Money group
- **Financials**: tabs Overview/Ledger/BOQ/Commitments/Applications/Retention; Budget vs actual; Excel/PDF export. [OBSERVED] → our CostEntry ledger + BOQ is deeper; add Applications/Retention tabs via ADR-008.
- **Commitments**: subcontract/PO with retention %, advance, "recover % of each claim", 3-step explainer empty state. [OBSERVED] → we have SubcontractorPackage/Valuation; add commitment wrapper w/ retention+advance fields.
- **Quotes**: templates (Kitchen/Bathroom/Tiling/Painting/Electrical…), WhatsApp share, GPS site pick, deposit %, branding logo, convert→project+deposit invoice. [OBSERVED] → **ADR-007; the Kenya killer flow. MUST.**
- **Invoicing**: AR invoices w/ terms Net 7–60, PO number, amount paid/balance, overdue. [OBSERVED] → **ADR-007 invoices; MUST.**
- **Inventory**: Materials/Equipment tabs, stock-movement ledger, low-stock alerts, wastage. [OBSERVED] → we have SiteInventoryItem/InventoryMovement/MaterialWastageReconciliation — likely covered (frozen M11+); verify vs MUST.
- **Billing & plan**: subscription, seats, invoices. [OBSERVED] → ADR-006 M-Pesa billing exists (subscription side).

## Quality & safety
- **Inspections**: template-driven, consultant approval chain, civil types too (Road Surface, Subgrade, Drainage, Bridge, Asphalt, Traffic Control), readiness+evidence photo slots (0/10, 0/3 limits), client-visible flag. [OBSERVED] → we have IndependentSiteInspection + InspectionChecklist; add consultant-approval chain + template types + evidence slots.
- **Safety incidents**: OSHA-style taxonomy incl. regional items (Asphalt Burn, Traffic Incident, Cave-in), severity minor→fatality, corrective action. [OBSERVED] → we have SafetyIncident + SafetyAuditRecord; align taxonomy.

## People group
- **Directory**: contacts/companies by category (Client/Consultant/Sub/ Supplier/Authority). [OBSERVED] → light CRM; SHOULD.
- **Subcontractors**: sub/supplier DB auto-attaching to commitments/bids by company name, payments. [OBSERVED] → we have subcontractor models; add directory-lite.
- **Crews**: roster by trade/shift/site, 33-trade taxonomy, foreman link. [OBSERVED] → we have SiteLaborer/LaborMusterRoll; add Crew entity (SHOULD).
- **Team**: invite w/ 14 roles + temp password. [OBSERVED] → we have Invitation; add role presets later.
- **Attendance**: Today/History/Team history/Access log; check-in/out/break, location, leave report, "currently on site/late/on leave" counters. [OBSERVED] → we have LaborDailyAttendance/WorkerClockEvent/geofence; add access-log view.
- **Role manager**: 14 roles × 36 modules × 18 permissions + approval limit. [OBSERVED] → our permissions package + presets plan (MVP_SCOPE phases).

## Documents & reports
- **Reports**: Financial/Operational/By Project/By Region/Custom/**Scheduled**; metrics (Total CO Value, Approval Rate, Median Cycle, Rework Rate); period filters; PDF export. [OBSERVED] → we have M10 PDFs; add scheduled reports + standard metric set.
- **Company documents**: categorized vault (Policies/Templates/Certifications/Insurance/HR/Legal). [OBSERVED] → we have ProjectDocument; add company-level vault (SHOULD).
- **Correspondence**: Letter/Submittal/Transmittal/Notice + drafts. [OBSERVED] → missing; LATER (formal correspondence is low-frequency for small contractors).
- **Coordination issues**: RFI/Clash/Design Question, priority, Open/Answered/Closed, links to COs. [OBSERVED] → we have RFI model; extend types + link to variations (ADR-010).

## Project detail (13 tabs)
Overview · Analytics · Contract · Drawings · BOQ · Variations · Certificates · Finishes · Site · Cost control · Client · Reports · Closeout. [OBSERVED]
- Health signals on Overview: overdue programme items, blocked items, open defects, open H&S incidents, variations awaiting decision, budget used, forecast vs budget, "Needs your attention", activity feed. [OBSERVED]
- **Action:** our project hub should converge on this tab structure — most tabs map to existing models; "Client" tab = invite + visibility controls (ADR-009); "Certificates" = ADR-008; "Closeout" = retention release + DLC (we have DefectsLiabilityCertificate).

## Priority synthesis for the contractor hub
1. **MUST now:** quotes-to-cash (ADR-007), certificates/retention entities (ADR-008), CO upgrade (ADR-010), photo client-visibility (ADR-009).
2. **Match quickly:** lifecycle project filters, dashboard "needs attention", daily-log non-work-day + weather, punch trade taxonomy, inspection consultant chain.
3. **Differentiate (Kenya):** KES-default, M-Pesa project payments, eTIMS path, SMS fallback, offline sync, WhatsApp quote accept, per-project pricing — all "not observed" there, unverified until role research completes.
4. **Defer:** AI schedule/checklist extraction, correspondence, bidding depth, self-hosted, inbox chat.
