# ROLE_SIMULATION_PROTOCOL.md — per-role account research plan

**Status:** READY — waiting for owner to create the additional trial accounts (14-day trials).
**Purpose:** Experience Buildsasa as EVERY role, not just Contractor, and simulate real-world workflows end-to-end with dummy data.

## Accounts needed (owner creates; we never self-register)
Priority order — Contractor admin view is done; these are the gaps:

| # | Account/role to obtain | Why | Access needed |
|---|---|---|---|
| 1 | **PM / Quantity Surveyor** | Money workflows: BOQ, commitments, claims, payment applications, certificates, CO approvals | Team invite into existing workspace OR own company account |
| 2 | **Client / property owner** | Client portal: photos, approvals, invoices, messages, selections | Client tab invite on MAKUNDI APARTMENTS (creates record — needs approval) OR "Create your free client account" + link a project |
| 3 | **Site Engineer / Superintendent** | Field workflows: daily log, checklists, punch, inspections, attendance | Team invite |
| 4 | **Trade Lead / Foreman / Worker** | Mobile-first field view: tasks, mark-done, photo upload | Team invite |
| 5 | **QA/QC Officer** | Inspection creation/fill/approve chain | Team invite |
| 6 | **Architect** | Plans/drawings review, clarifications (RFIs) | Team invite |
| 7 | **Owner / Executive / Viewer** | Approval-limit behaviour, read-only views | Team invite |

Note: roles 3–7 can likely be covered by inviting dummy users into ONE workspace (POWELL's) — each signs in and sees their role-scoped UI. That requires owner approval before sending invites (per safe-use rules). Dummy names/emails only, e.g. `zz-research-pm@example.com`.

## Per-role capture checklist (run for each account)
1. Login → landing view: what does this role see first? (dashboard, tasks, field app?)
2. **Navigation diff**: which sidebar modules are visible/hidden vs Contractor?
3. **Permission probes**: try to open money/financial screens — allowed or blocked?
4. **Core workflow for that role** (see scenarios below) — walk it end-to-end with `ZZ-RESEARCH-` records.
5. Mobile viewport pass (390×844) for field roles — layout, upload flow.
6. Notifications: what triggers them (record which actions notify whom).
7. Logout/expiry/session behaviour notes.

## Real-world simulation scenarios (the "make sure we understand" part)
Run these as full journeys per role, screenshotting each step:

- **S1 Quote-to-cash**: PM creates quote → shares link → "client" (role 2 account) accepts → convert to project → deposit invoice → client sees it in portal → pays (sandbox/test only, NO real payment).
- **S2 Daily site loop**: Worker/Foreman logs daily log w/ photos+GPS → PM reviews → client sees only shared photos.
- **S3 Change order**: field issue → RFI → CO drafted (cost+schedule impact) → PM approves within limit → Owner approves above limit → client approves in portal → budget/schedule reflect.
- **S4 Valuation cycle**: commitment to sub → sub claim → certify → payment application → approve → mark paid → retention held → release.
- **S5 Inspection→punch→close**: QA/QC raises inspection → consultant approves → punch items raised → trade lead fixes → verified → closed.
- **S6 Attendance & claims**: crew check-in/out w/ location → muster → labour-days feed daily log → EOT/delay claim evidence.
- **S7 Dispute evidence**: client disputes progress → contractor exports diary/photos/reports → shows audit trail.

## Safety rules (unchanged)
- `ZZ-RESEARCH-` prefix on ALL created records; log every one in `CREATED_RECORDS.md`.
- No real payments/messages; M-Pesa/Paystack test mode only if offered.
- ~1 action/2s; read-only by default; ask before invites, submissions that notify real people, or anything billing-related.
- Redact real data in all captures; credentials via env vars only.

## Deliverables per role
- `pages-dom/role-<name>-*.json` dumps + screenshots
- Workflow notes appended to `03_workflows/` files (role-specific sections)
- Permission observations appended to `02_roles_permissions.md` (observed vs inferred)
- Journey evidence appended to `04_journeys.md`
