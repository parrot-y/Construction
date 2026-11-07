# PROGRESS.md — buildsasa.com console research

Resumable progress tracker. Update after every session.

**Last updated:** 2026-11-06 (Devin)
**Status:** GATE 1 substantially complete — deliverables written; awaiting owner review before Gate 2 synthesis.

## Environment notes
- Automation: `puppeteer-core` + system `/usr/bin/google-chrome` (headless). Scripts in `/tmp/sasa-audit/` (ephemeral — recreate if wiped).
- Credentials passed via env vars `SASA_EMAIL` / `SASA_PASSWORD` at runtime only — never stored.
- Screenshots: `screenshots/` (purged from history 2026-11-07 — account-identifying captures removed). Page DOM dumps (`pages-dom/`) and `api-endpoints-full.txt` were purged from the repo 2026-11-06 per Claude audit remediation — findings preserved in the numbered docs; raw captures must NOT be recommitted.

## Done — Gate 1 coverage
- [x] All sidebar modules visited and dumped (~35 pages)
- [x] ~20 create/edit forms captured read-only (CO, quote, invoice, commitment, daily log, observation, RFI, incident, correspondence, inspection, contact, crew, invite, subcontractor, checklist template, AI schedule)
- [x] Project detail page (GRAND TOWERS): 13 tabs + health signals captured
- [x] 14-role catalogue + 18-permission matrix extracted for ALL roles (`rolematrix2-*.json`)
- [x] Module access catalogue (36 modules)
- [x] Client path tested: separate account system; contractor creds rejected on client login
- [x] Pricing/plans/billing captured incl. Paystack, AI credits, self-hosted
- [x] Deliverables: 01_overview … 10_opportunities, SUMMARY.md, 03_workflows/README.md, 04_journeys, 05_data_model (ERD), 06_integrations, 07_sitemap, 08_pricing

## Owner plan (2026-11-06)
Owner will create additional trial accounts (14-day) for other roles while Claude audits PR #1. Protocol ready: `ROLE_SIMULATION_PROTOCOL.md` — 7 role accounts needed, per-role capture checklist, 7 end-to-end simulation scenarios (S1–S7). Team invites into CONTRACTOR-CO workspace preferred for staff roles; client needs Client-tab invite (record creation — will ask before sending).

## Not done / Not reachable
- [ ] Client dashboard interior — needs client invite (requires creating data; ask owner)
- [x] Saved-record workflows — partially done 2026-11-06: CO lifecycle, daily log, quote send flow exercised live (see § above); invoice/commitment/inspection/punch/checklist saved states still not reached
- [ ] Module-access toggle granularity per role — permission toggles captured; module list appears derived [INFERRED]
- [ ] "Viewing as" role preview mechanics — partially observed
- [ ] Bidding flow detail (no jobs/bid-packages in this workspace)
- [ ] Ask Buildsasa AI / Shemmy chat — not exercised
- [ ] Upload flow end-to-end (presign observed in bundle only)

## 2026-11-06 — Deep pass + created records (owner directive: test everything)
- All 13 project-detail tabs' bodies extracted → `12_deep_pass_and_created_records.md` §1 (BOQ revisions immutable, drawings revision stacking, closeout stage machine, finishes client-approval loop).
- Money group children enumerated: Financials · Commitments · Quotes · Invoicing · Inventory · Billing & plan.
- **Records created & driven live** (logged in CREATED_RECORDS.md):
  - CO-4990: created via UI, walked Drafted → PM Review → Approved; per-status action buttons + actor activity log captured.
  - Daily log (Fri 6 Nov): created; week dashboard counters; **per-media client-visibility checkbox — written notes never shown to client**.
  - Q-0001 quote: created, Draft → Sent; send panel exposes Copy/WhatsApp/Email/PDF + client-portal "Quotes & proposals" inbox with comment/request-changes loop.
- Invoice ZZ-RESEARCH-INV-001 created (draft; PDF + Record payment actions; Net-7/14/30/60 terms; M-Pesa named in terms placeholder).
- Commitments form fully mapped (vendor/scope/value/retention%/advance/recover%/cost code; 3-step contract→claim→owed model); create POST fired but validation-rejected — likely needs existing vendor record.
- Certificate (IPC) form fully mapped (period valuation, gross-to-date, retention %, advance recovery, live NET PAYABLE, Submitted→…→Paid statuses, scan attach); save blocked until contract sum is set — contract sum is the root input unlocking analytics/cost-control/certificates.
- Payment application #ZZ-APP-01 created (Draft; Submit/Mark paid workflow; commitment-linked). Financials all 7 tabs extracted (Ledger/Budget variance categories, BOQ→budget link, Retention derived).
- Punch item PL-2419 created (36-trade taxonomy, manager+final-approver roles, distribution list, cost/schedule impact scales, Private visibility flag). Due-date render anomaly noted.
- Full module sweep batch 2+3: Inspections (consultant-approval workflow, civil-engineering types, required checklist template, photo quotas), Safety incidents (9 types, 4 severities, witnesses/corrective action), Observations (+corrective-actions tab), Checklists (upload→auto-extract + Form Builder 10 question types), Inventory (stock ledger w/ waste %, supplier lead times, KES costs), Schedule (Gantt/List/Milestones + AI schedule), Plans & drawings (discipline filters + AI Design SOON), Team (14-role dropdown per member), Attendance (check-in/out/break/location + access log), Directory (5 categories), Subcontractors (Bidding auto-attach by company name), Crews (shift Day/Night), Coordination issues (RFI/Clash/Design Q), Correspondence (Letter/Submittal/Transmittal/Notice), Company documents (6 categories), Reports (Financial/Operational/By project/By region/Custom/Scheduled), Announcements (audience targeting + read acknowledgement), Billing & plan (Starter $23 / Business $69 / yearly $690, KES native pricing), Settings (profile/security/company sectors).
- Site checks page [NOT REACHED] — nav click renders Dashboard; likely project-scoped/stub.
- Remaining "not reached": saved-state UI for inspection/observation/checklist/subcontractor/crew/RFI/incident/correspondence/contact/inventory/announcement creates; contract-sum setup flow; "Viewing as" mechanics; Ask AI/Shemmy; upload pipeline end-to-end; bidding module (referenced but not in nav).

## Blockers / flags
- **Trial expiry ~2026-11-10** — if it lapses, remaining items become "Not reachable" permanently.
- R-026 closed 2026-11-06: the 9 "discovery interviews" were synthetic; owner redirected validation to this console audit instead. Buyer/product-name/pricing remain UNVALIDATED.
- 3 ZZ-RESEARCH- records now exist in the account (see CREATED_RECORDS.md for cleanup).

## 2026-11-06 — Role account probes (owner-provided accounts)
- QS, Architect, QA/QC accounts exercised read-only; findings appended to `02_roles_permissions.md` ("Live account probes"). Key facts: sidebar is role-pruned (QA/QC loses Dashboard, Money pages, Team/Role manager, Reports); QS/Architect see full nav but Role manager denies at open; role-specific landing views confirmed.
- New deliverable: `11_contractor_feature_review.md` — feature-by-feature contractor sidebar review with match/improve/differentiate priorities (owner directive: solid contractor hub first, portals sync inside).
- Raw captures kept local only (`/tmp/sasa-audit2/`) — not committed.

## 2026-11-06 (later) — Client portal verified + quote loop closed + money chain
- **Client login fixed** (correct password supplied): full client dashboard captured — Home/My sites/Messages/Quotes & proposals/Site reporting/Request a project/Account. Client invite→register→dashboard chain confirmed project-scoped via Client tab.
- **Quote E2E loop OBSERVED:** edited Q-0001 client email → share panel confirmed email-match sync → client Quotes & proposals showed it "Waiting for you" → quotation document (line items, KES 550,000, 50% deposit KES 275,000) → **typed-name e-signature acceptance** (`POST /api/public/quotes/{token}/respond`) → contractor list shows "Accepted | by CLIENT USER" + **Start project** action. Full quotes-to-cash chain proven live.
- **Contract sum set** ($1,000,000 dummy via PUT /contract): unlocked revised contract sum $1,000,100.10 (CO-4990 rolls up), certificates "still to certify" balance, analytics.
- **Certificate/payment-application unification found:** #ZZ-APP-01 appears in Certificates history with status action buttons — applications and certificates share one record model.
- Certificate create form re-captured live (live THIS PERIOD/RETENTION/NET PAYABLE computation, 5 statuses, scan attach); save still not exercised — inputs ambiguous, cancelled cleanly.
- All findings → `12_deep_pass_and_created_records.md` §5/§6b/§6c; cleanup rows added to CREATED_RECORDS.md (contract sum reset, quote now Accepted — do not click Start project).

## 2026-11-07 — Cleanup pass + new findings
- **Cleanup executed:** CO-4990 → Rejected; PL-2419 → Rejected; #ZZ-APP-01 → Rejected (Reject modal w/ comments); daily-log Friday entry neutralized (crew "Site crew", work text generic — no delete exists, edit-only); contract sum reset $1,000,000 → 0 via project "More project actions" → "Contract value & dates".
- **Could NOT clean:** invoice ZZ-RESEARCH-INV-001 (draft, no delete/edit affordance) and quote Q-0001 (Accepted by real client; no decline/delete path; "Start project" must not be clicked). Both remain ZZ-marked; trial expiry will wipe the workspace.
- **New findings:** "More project actions" menu = Refresh · Contract value & dates · View-only portal link. "Edit project" modal fully mapped (contract value $/KSh, location+map pin, progress %, money-at-risk, status lifecycle Planning→On Track→At Risk→Closing→Archived, PM/Architect/QS assignment, images, documents). Sidebar groups are collapsible toggles (clicking 'Projects' collapses children). Payment-application Reject requires modal comments + confirm. No hard-delete exists for any record type observed — statuses are the cleanup mechanism (audit-trail preserved by design).
- Repo hygiene: added `AGENTS.md` (orchestration rules), `tasks/todo.md`, `tasks/lessons.md` per owner directive.

## 2026-11-07 (later) — probes + final creates
- **Viewing as:** sidebar label present but click did not open a menu in headless run [PARTIAL].
- **Shemmy/Ask AI:** "Open Shemmy support" opens a support chatbot ("Hi, I'm Shemmy 👋 your Buildsasa support assistant… Talk to a human: WhatsApp · Email") — support assistant, not a work AI. Separate "Ask Buildsasa AI…" input exists inside schedule/checklist forms (AI generation, metered).
- **Site checks:** confirmed dead nav — renders Dashboard every time [NOT REACHED, likely stub].
- **Profile menu:** CONTRACTOR-CO button opens Settings · Help & support · Sign out.
- **Created & verified:** crew (POST /api/crews), 2× inventory items (POST /api/inventory), announcement (POST /api/announcements — published workspace-wide).
- **Attempted, not created:** subcontractor (validation), contact (save click no POST), observation (save regex hit wrong button), safety incident/inspection/checklist/RFI/correspondence/inventory-extra — automation form-filling proved unreliable for React floating-label forms; forms fully mapped earlier, saved-state UI remains [NOT REACHED] for these.
- **Cleanup final state:** all voidable/rejectable records rejected; daily log neutralized; contract sum $0; invoice draft + accepted quote have no delete path (documented). New ZZ records (crew, 2 inventory, announcement) logged in CREATED_RECORDS.md — announcement is workspace-visible, owner should remove.
