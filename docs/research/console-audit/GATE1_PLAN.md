# GATE 1 PLAN — Buildsasa console: full inside-out study

**Date:** 2026-11-06 · **Owner:** Devin · **Status:** EXECUTED 2026-11-06 — deliverables in this folder; awaiting owner Gate 1 review
**Goal:** Come out of this gate understanding Buildsasa completely enough to (a) replicate every user role/portal and how modules connect, and (b) feed Gate 2 product definition for Platform.

## What we already have (done)

- Full nav/module tree captured (page dumps were in `pages-dom/` — purged 2026-11-06 per audit remediation; screenshots purged from repo history 2026-11-07 per re-audit (account-identifying captures removed))
- All 14 roles identified in Role manager with descriptions
- Pricing/plans/billing captured (Starter $23/mo 3 seats, Business $69/mo 10 seats, Paystack M-Pesa/card/bank, self-hosted option)
- 77 API endpoints mapped; tech fingerprint complete
- Empty-state workflows for every module documented

## Module map discovered (all under one Contractor workspace)

```
Inbox · Dashboard · Announcements
Projects: All projects · Change orders · Plans & drawings · Schedule · Daily log · Site checks · Checklists · Punch list · Observations
Money: Financials (Overview/Ledger/BOQ/Commitments/Applications/Retention) · Commitments · Quotes · Invoicing · Inventory · Billing & plan
Quality & safety: Inspections · Safety incidents
People: Directory · Subcontractors · Crews · Team · Attendance · Role manager
Documents & reports: Reports · Company documents · Correspondence · Coordination issues
Global: Ctrl+K search · New menu · currency switch (KES/USD) · notifications · dark mode · Ask Buildsasa AI · Shemmy support chat · "Viewing as" role switcher
```

## Remaining work — in priority order

### Phase A — Structure & access (who can see what)
1. **Role × permission matrix**: open Role manager, select each of the 14 roles, capture which modules/actions each can see/do. Also test the "Viewing as" switcher to see role-scoped UIs.
2. **Invite flow**: Team → Invite member — capture role options, fields, message (no actual invite sent).
3. **Client path**: try "I'm a client" switch — determine if same account reaches client view; else mark Not reachable and infer from `/api/client/*` endpoints + marketing pages.
4. **Project detail**: open GRAND TOWERS — capture tabs (Client tab mentioned in tour), members, settings, statuses (Active/At Risk/Planning/Closing/Archived).

### Phase B — Workflows & forms (how things connect)
5. **Create forms, read-only**: open (never save) — New change order, New Quote, New Invoice, New daily log, New Observation, New Issue (RFI), safety Report, New Correspondence, New inspection Request, Add commitment, Add subcontractor, Add contact, New Crew, New Template/Form Builder, AI schedule.
6. **Financials deep-dive**: Financials tabs (Ledger, BOQ, Commitments, Applications, Retention) — understand valuation/certificate chain: quote → commitment → application → certificate → invoice → payment.
7. **Change order chain** (their core differentiator): statuses Drafted → PM Review → Owner Approval → Approved/Rejected/Void; triggers (cost/schedule/assignees); approval limits per role.
8. **Checklists**: templates, assignments by trade, submissions, AI checklist from paper form, Form Builder.
9. **Schedule**: Gantt/list/milestones, phases/activities, "AI schedule" generator, statuses (Not started/In progress/Done/Blocked).
10. **Integrations observed**: upload flow (presign → S3), AI assistant + ai-credits, WhatsApp quote acceptance, Paystack checkout, email status, support chat (Shemmy).

### Phase C — Synthesis deliverables (in `docs/research/console-audit/`)
11. `01_overview.md` — product positioning, plans, deployment options
12. `02_roles_permissions.md` — 14-role catalogue + permission matrix + invite flow + viewing-as
13. `03_workflows/` — one file per module group with Mermaid state diagrams (change orders, quotes→project, daily log, inspections, punch, observations/RFIs, commitments→applications→retention, invoicing, attendance, checklists)
14. `04_journeys.md` — end-to-end paths (win quote → project → CO → certificate → invoice; daily site loop; inspection → punch → close)
15. `05_data_model.md` — inferred ERD from forms/fields/endpoints
16. `06_integrations.md` — payments, AI, messaging, maps, storage
17. `07_sitemap.md` — full nav tree (mostly done)
18. `08_pricing_and_limits.md` — plans, seats, AI credits, feature gating
19. `09_ux_findings.md` — strengths/friction for Kenyan contractors
20. `10_opportunities.md` — where Platform beats them
21. `SUMMARY.md` — feature checklist: feature | Buildsasa has it? | priority for our MVP
22. Update `PROGRESS.md` continuously; every created record (none so far) in `CREATED_RECORDS.md`

## Rules I'll follow (unchanged)

- Read-only: open forms, never save/submit/approve/pay/invite. Dummy `ZZ-RESEARCH-` records only with your approval.
- ~1 action per 2s, sequential; no parallel hammering.
- Real data redacted in all screenshots/notes; credentials never written anywhere.
- Claims tagged [OBSERVED]/[INFERRED]/[ASSUMPTION]; unreachable roles/views listed honestly.

## Constraints & flags

- **Trial expires ~Nov 10** — ~4 days. If it lapses mid-study, remaining items move to "Not reachable" and I infer from bundle/help pages.
- The onboarding tour modal keeps reappearing — handled in scripts now.
- R-026 (real interviews?) and Discovery Gate remain open regardless — this research doesn't replace them.

## Estimated shape of outcome

A complete "how Buildsasa works inside" document set + a feature matrix that directly feeds Gate 2 (PRD/MVP scope) — including the 14-role model and portal/access patterns you asked for, mapped against our current 4-role V1 design so we can decide what to adopt, adapt, or deliberately drop.
