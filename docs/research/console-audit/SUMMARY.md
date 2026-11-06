# SUMMARY — reference-console research (Gate 1)

**Evidence basis:** all ✅/field claims below are **[OBSERVED]** in the authorised contractor console on 2026-11-06 (read-only; no records created). Anything not seen is marked **not observed** — it may exist behind roles, saved records, or the native app we could not reach; it is NOT proven absent. "Our wedge" rows mean *candidate differentiators, not observed in the audited surfaces* — unverified until role-by-role accounts (`ROLE_SIMULATION_PROTOCOL.md`) or customer validation.

**Account:** Contractor workspace (JUMUIA CONTRACTORS / POWELL), USD display, trial ~4 days left at 2026-11-06.
**Coverage:** all sidebar modules visited, ~20 create/edit forms captured read-only, 14-role permission matrix extracted, 250 API endpoints mapped, client path tested (separate account system).
**Not reachable:** client dashboard (needs client invite), other workspaces/tenants, saved-record workflows (no records created — see CREATED_RECORDS.md), native mobile app.

## Feature checklist — reference product has it? → our MVP priority

| Feature | Reference console | Our MVP priority |
|---|---|---|
| Projects hub w/ lifecycle statuses | ✅ | Must |
| Change orders w/ trigger/cost/schedule/approval chain | ✅ core | Must |
| Quotes + WhatsApp share + convert-to-project + deposit invoice | ✅ | Must (Kenya killer feature) |
| Invoicing AR (draft/sent/paid/overdue, terms, PO) | ✅ | Must |
| Commitments (subcontracts/POs) → claims → payment apps → retention → certificates | ✅ deep | Must (our valuation engine equivalent) |
| Financials: ledger, BOQ, budget vs actual, retention, exports | ✅ | Must |
| Daily log w/ GPS, weather, crew, photos, client-visibility toggle | ✅ | Must |
| Checklists: templates by trade, assignments, submissions, AI from paper, Form Builder | ✅ | Should |
| Punch list (snags) w/ trades + comments + attachments | ✅ | Must |
| Observations (quality/safety/env/commissioning) + corrective actions | ✅ | Should |
| Coordination issues (RFI/clash/design Q) | ✅ | Should |
| Inspections w/ consultant approval chain + evidence photos | ✅ | Should |
| Safety incidents (OSHA-style) | ✅ | Should |
| Schedule: Gantt/list/milestones + AI schedule generator | ✅ | Should |
| Plans & drawings: upload PDF/image/CAD, revisions, viewer, pin punch | ✅ | Should |
| Inventory: materials + equipment, stock movements, low-stock, wastage | ✅ | Later |
| Attendance: check-in/out, location, leave | ✅ | Should |
| Crews/foremen/trades taxonomy | ✅ | Should |
| Directory, Subcontractors DB, Team invites | ✅ | Must |
| Role manager: 14 roles, 36 modules, 18 permissions, approval limits | ✅ | Later (we start 4 roles) |
| Client portal: photos, approvals, messages, invoices, reports | ✅ token+account | Must |
| Public token links (portal/quotes/bids/forms) | ✅ | Must |
| Bidding/bid-packages + award | ✅ | Later |
| Jobs/requests (client-initiated) | ✅ | Later |
| Correspondence (letter/submittal/transmittal/notice) | ✅ | Later |
| Company documents vault | ✅ | Should |
| Reports: scheduled, PDF export, custom | ✅ | Should |
| Inbox team chat + announcements | ✅ | Should |
| AI assistant + AI credits metering | ✅ metered | Later |
| Multi-currency display (KES/USD) | ✅ | Must (KES-first for us) |
| Paystack billing (M-Pesa/card/bank) | ✅ | Must |
| Self-hosted option | ✅ | Not now |
| eTIMS/VSCU tax invoices | not observed | **Candidate differentiator — Should/Must (unverified)** |
| SMS notifications | not observed | **Candidate differentiator — Should (unverified)** |
| Offline sync for field use | not observed | **Candidate differentiator — Must (unverified)** |
| Per-project pricing | per-seat observed | **Candidate differentiator (unverified)** |

## Biggest strategic takeaways
1. Their centre of gravity = field ops + change orders + client transparency; ours = BOQ→budget→progress→cost→evidence→approval→client. Overlap is large; differentiate on QS-depth, M-Pesa/eTIMS, offline, KES pricing.
2. The money chain (quote→project→commitment→claim→application→certificate→invoice→retention→closeout) is the spine — our slices should follow it.
3. 14 roles is their answer to "everyone involved"; our 4-role V1 + permission RBAC is the right start, with their role catalogue as the expansion map.
4. Client-side is a separate free account + token links — dual access model worth copying.
