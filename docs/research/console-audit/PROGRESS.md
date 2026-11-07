# PROGRESS.md — buildsasa.com console research

Resumable progress tracker. Update after every session.

**Last updated:** 2026-11-06 (Devin)
**Status:** GATE 1 substantially complete — deliverables written; awaiting owner review before Gate 2 synthesis.

## Environment notes
- Automation: `puppeteer-core` + system `/usr/bin/google-chrome` (headless). Scripts in `/tmp/sasa-audit/` (ephemeral — recreate if wiped).
- Credentials passed via env vars `SASA_EMAIL` / `SASA_PASSWORD` at runtime only — never stored.
- Screenshots: `screenshots/` (retained). Page DOM dumps (`pages-dom/`) and `api-endpoints-full.txt` were purged from the repo 2026-11-06 per Claude audit remediation — findings preserved in the numbered docs; raw captures must NOT be recommitted.

## Done — Gate 1 coverage
- [x] All sidebar modules visited and dumped (~35 pages)
- [x] ~20 create/edit forms captured read-only (CO, quote, invoice, commitment, daily log, observation, RFI, incident, correspondence, inspection, contact, crew, invite, subcontractor, checklist template, AI schedule)
- [x] Project detail page (MAKUNDI APARTMENTS): 13 tabs + health signals captured
- [x] 14-role catalogue + 18-permission matrix extracted for ALL roles (`rolematrix2-*.json`)
- [x] Module access catalogue (36 modules)
- [x] Client path tested: separate account system; contractor creds rejected on client login
- [x] Pricing/plans/billing captured incl. Paystack, AI credits, self-hosted
- [x] Deliverables: 01_overview … 10_opportunities, SUMMARY.md, 03_workflows/README.md, 04_journeys, 05_data_model (ERD), 06_integrations, 07_sitemap, 08_pricing

## Owner plan (2026-11-06)
Owner will create additional trial accounts (14-day) for other roles while Claude audits PR #1. Protocol ready: `ROLE_SIMULATION_PROTOCOL.md` — 7 role accounts needed, per-role capture checklist, 7 end-to-end simulation scenarios (S1–S7). Team invites into POWELL workspace preferred for staff roles; client needs Client-tab invite (record creation — will ask before sending).

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
- Remaining "not reached": saved-state UI for commitment/inspection/punch/checklist/subcontractor/crew/RFI/incident/correspondence/contact; contract-sum setup flow itself; "Viewing as" mechanics; Ask AI/Shemmy; upload pipeline; bidding.

## Blockers / flags
- **Trial expiry ~2026-11-10** — if it lapses, remaining items become "Not reachable" permanently.
- R-026 closed 2026-11-06: the 9 "discovery interviews" were synthetic; owner redirected validation to this console audit instead. Buyer/product-name/pricing remain UNVALIDATED.
- 3 ZZ-RESEARCH- records now exist in the account (see CREATED_RECORDS.md for cleanup).

## 2026-11-06 — Role account probes (owner-provided accounts)
- QS, Architect, QA/QC accounts exercised read-only; findings appended to `02_roles_permissions.md` ("Live account probes"). Key facts: sidebar is role-pruned (QA/QC loses Dashboard, Money pages, Team/Role manager, Reports); QS/Architect see full nav but Role manager denies at open; role-specific landing views confirmed.
- Client/owner account (brendakosgeijeptoo26@gmail.com) FAILED login on both client and contractor paths — "Invalid email or password". Needs corrected credentials or invite acceptance from owner.
- New deliverable: `11_contractor_feature_review.md` — feature-by-feature contractor sidebar review with match/improve/differentiate priorities (owner directive: solid contractor hub first, portals sync inside).
- Raw captures kept local only (`/tmp/sasa-audit2/`) — not committed.
