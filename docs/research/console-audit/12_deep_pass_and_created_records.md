# 12 — Deep pass: project tabs, created records & live workflows

**Date:** 2026-11-06 · **Account:** Contractor workspace (CONTRACTOR-CO, USD, trial) · **Method:** Puppeteer + system Chrome, env-var credentials only.
**Evidence tags:** [OBSERVED] seen live · [INFERRED] reasoned · all created records prefixed `ZZ-RESEARCH-` and logged in `CREATED_RECORDS.md`.

This pass went beyond navigation: every project-detail tab body was extracted, and three record types were created and driven through real state changes to observe saved-state UI, validation, and workflows.

---

## 1. Project detail tabs — full content map [OBSERVED]

Project: GRAND TOWERS (P-UTR3). 13 top-level tabs; each is a module hub, not just a view.

| Tab | What it contains (observed) |
|---|---|
| **Overview** | Health signals, activity feed, key metrics (overdue/blocked programme items, open defects, open H&S incidents, variations awaiting decision, budget used, forecast vs budget) |
| **Analytics** | Contract value, certified-to-date %, paid-to-date + outstanding, days remaining (needs start/finish dates), money-vs-contract breakdown (contract sum / certified / paid / committed / retention held / variations pending). **Export report** button. Graceful "—" states when contract sum unset |
| **Contract** | "Contract Documents" folder + "Other Documents" folder; drag-drop upload; "Needs your attention" + Activity panels |
| **Drawings** | Drawing sheets list — "revisions stack as V2, V3… under one sheet number"; accepts PDF/DWG/images, each file becomes a sheet at V1; separate "Design documents" folder (reports, specs, approvals) |
| **BOQ** | Working bill: sections → items → saved revisions ("Frozen copies of the bill. Nothing here is ever overwritten"); **Rate library**; **Import BOQ**; Add section; bill total auto-computed; revisions explicitly immutable |
| **Variations** | Original contract sum (set inline), approved variations (+additions/−omissions), revised contract sum, pending count, **Variation log** — "Log each change against the original contract sum with its cause — a client instruction, a design change, a provisional sum…" |
| **Certificates** | Certified to date %, paid, retention held, still-to-certify balance, certificate history; **Record certificate** — "cumulative valuation, retention and balance are worked out for you" |
| **Finishes** | Finish selections room-by-room (tiles, paint, sanitary ware, fittings) with photo; **"The client approves them from their phone before you order"** — client-in-loop selection workflow |
| **Site** | Sub-tabs: Daily log / Progress / Snagging & defects / Health & safety. Daily logs count, last-7-days entries, labour-days sum; New daily log; Site Records files |
| **Cost control** | Budget vs actual spend vs cost-to-complete vs **forecast final cost**; links to Financials ("book spend in Financials and log variations here"); needs contract sum + budget first |
| **Client** | Client invite panel (see §4) + progress-update composer (stage/type, photos/short video/docs attach, "Share with client") |
| **Reports** | Per-project report: work complete %, revised contract sum, certified, paid, forecast margin, "Needs attention" list; **Export PDF / Spreadsheet** |
| **Closeout** | Stage machine: `IN PROGRESS → HANDED OVER → DEFECTS LIABILITY → DEFECTS EXPIRED → CLOSED`; prerequisite checklist ("practical completion has not been recorded", defects-period end, open punch items, retention held); **Recording practical completion schedules the retention release**; defects-liability months field |

**Design notes for us:** tabs double as scoped dashboards with consistent "Needs your attention" + Activity rails. Empty states are instructional (tell you exactly what to do next). Financial tabs degrade gracefully with "—" until contract sum is set — same pattern we should copy.

---

## 2. Created record #1 — Change order CO-4990 [OBSERVED]

**Create form** (`POST /api/change-orders`):
- TITLE* (required), DESCRIPTION
- PROJECT (prefilled to GRAND TOWERS)
- NUMBER (auto if blank → assigned CO-4990)
- AREA / LOCATION
- TRIGGER select: Design clarification · Owner request · Unforeseen condition · Code compliance · Structural review · Weather/delays · Other
- LINKED RFI (optional link)
- STATUS select: Drafted · PM Review · Owner Approval · Approved · Rejected · Void
- COST IMPACT (USD), SCHEDULE IMPACT (DAYS)
- REQUESTED BY (free text, e.g. client name)
- ASSIGNEES (multi-select of workspace members: CONTRACTOR-CO/Contractor, CLIENTUSER/Owner, abel/Architect, watson/QS, QA-USER/QA-QC — confirms all 5 role accounts live in one workspace)

**Detail panel actions by status** (walked live):

| Status | Buttons observed |
|---|---|
| Drafted | Edit · **Submit for PM review** · Approve · Reject |
| PM Review | Edit · **Send for owner approval** · Approve · Reject |
| Approved | Edit · Reject |

- Activity log records every transition with actor: "CONTRACTOR-CO · Contractor created this change order", "moved it to PM Review", "moved it to Approved".
- "Approve" from PM Review jumped straight to **Approved** — contractor can self-approve; "Send for owner approval" is the client-in-loop path. Approval limits per role exist in Role Manager (see `02_roles_permissions.md`) — enforcement point to replicate.
- List footer aggregates: "N change orders · net cost $X · schedule +Xd · N pending approval"; status filter + project filter + CSV export.

---

## 3. Created record #2 — Daily log entry (Fri 6 Nov) [OBSERVED]

`POST /api/projects/{id}/daily-log` succeeded. Week view: "1 of 7 days logged · 4 labour-days · 0 photos & videos · 0 days with deliveries", per-day cells (Logged / Not logged / "No work day?" / "Add log"), "Why log every day" explainer (ET claims + payment disputes).

**Form fields:**
- Date · **Crew on site\*** (free-text crew name accepted — no crew record needed) · People on site (count)
- **Work done today\*** · Where on site + "Use my location" + "Pick on map"
- Weather select: Not recorded · Clear · Cloudy · Light rain · Heavy rain · Windy · Hot · Cold + **Auto** (auto weather fetch)
- Labour, plant and deliveries (optional section)
- Photos / Short video (≤20 MB, ~30–60 s)
- **Client-visibility checkbox:** "Show these photos and videos to the client in the portal — Untick for anything internal, like an accident or a supplier problem. **The written notes are never shown to the client.**"

**Critical privacy model [OBSERVED]:** daily-log *text* is never client-visible; only attached media can be opted in per entry. This is subtler than "share the log" — our client-visibility ADR (ADR-009) should model per-field/per-media sharing, not per-record.

---

## 4. Created record #3 — Quote Q-0001 + Send flow [OBSERVED]

Money group children confirmed: **Financials · Commitments · Quotes · Invoicing · Inventory · Billing & plan**.

**Quote form:** title ("e.g. Kitchen remodel, Runda"), date, client name/phone/email, site location search, line items (Section · Description · unit select: item/sum/m/m²/m³/no/kg/day/hr/lot · Qty · Rate), scope-notes textarea, terms textarea ("50% deposit…"), validity days, deposit %, tax %; "Add lines from a template…" (Kitchen remodel, Bathroom remodel, Tiling works, Painting & decor, Electrical works); "Add your logo".

**List:** Q-0001 · ZZ-RESEARCH Client · **$4,235** · Draft → **Sent** · valid until 2026-12-06 · row actions Edit / Send→Share / PDF. Status filter: Draft · Sent · Accepted · Declined · Expired.

**Send flow (the quotes-to-cash keystone) [OBSERVED]:**
- "Send Q-0001 to {client}" panel: *"The client opens this link on any phone to see the quote and accept or decline it. You'll see their answer here."*
- Channels: **Copy link · WhatsApp · Email · Download PDF to attach**
- Manual fallback buttons: **Accepted · Declined**
- **"If {email} has a Buildsasa client account, this quote also appears in their Quotes & proposals, where they can comment and ask for changes."** — quotes surface inside the client portal with comment/request-changes loop.
- Comments section on the quote.

Tagline on page: *"Price a job, send it to the client to accept online, then turn it into a project"* — confirms quote→accept→project conversion is a first-class path (validates ADR-007 direction).

---

## 5. Client invite flow — contractor side [OBSERVED earlier, consolidated]

Project → **Client tab** (project-specific, NOT under People/Team):
- Invite the project owner **by email** → they get a **free client account**
- Client sees: progress updates, shared daily logs (media only per §3), shared inspections (per-item "Share with client"), change orders, finish selections, invoices, project chat
- Client **must register with the invited email** for the project to appear
- Fallbacks: **Copy invite link** · **Send invite on WhatsApp** · **view-only link** for non-signup viewing
- Daily logs shared by default (media opt-in per entry); internal notes private; inspections shared individually

Client portal interior [OBSERVED live 2026-11-06 with owner-supplied client login]: sidebar = Home · My sites · Messages · Quotes & proposals · Site reporting · Request a project · Account. Home shows site cards (GRAND TOWERS, "CLIENTCO CONTRACTORS · Nairobi · 0% complete"), a "Neutral site reporting" upsell (independent Buildsasa inspection service), and "Request a project" (client-initiated tender: "Need fencing, solar, CCTV or a gate?"). Onboarding modal "Karibu, client!" frames value props: real progress photos, approve-and-pay from Home, chat with team, independent eyes.

Client quote acceptance E2E [OBSERVED]: quote appeared under Quotes & proposals once the client email matched ("Waiting for you"). Detail renders the quotation document: line items ("110 item × KES 5,000 → KES 550,000"), Subtotal/Total, Deposit to start 50% (KES 275,000), terms, validity. **Accept flow = typed-name e-signature**: "Accept quote" → panel "Accept KES 550,000 … Typing your name confirms you accept" → type full name → "Confirm acceptance" → `POST /api/public/quotes/{token}/respond` → "Quote accepted by CLIENT USER on 7 Nov 2026". Decline + "Comment or ask for a change" thread also present. Contractor list immediately shows **Accepted | by CLIENT USER** and unlocks **Start project** action — closing the quote→accept→project chain.

---

## 5b. Created record #4 — Invoice ZZ-RESEARCH-INV-001 [OBSERVED]

`POST /api/projects/{id}/invoices` succeeded. List columns: INVOICE # · CLIENT · AMOUNT · STATUS · DUE · PAID · BALANCE · ACTIONS. Row actions: **PDF · Record payment**. Statuses: draft · sent · paid · overdue. Project filter + status filter.

**Form:** invoice no (auto-capable), selects for project + status + payment terms (Due on receipt / Net 7 / Net 14 / Net 30 / Net 60), bill-to client name/address/site, issue + due dates, PO reference, line items (description, qty, rate), tax % (16 default observed), notes, payment-terms textarea whose placeholder literally suggests *"Payment due within 14 days by M-Pesa or bank transfer"* — M-Pesa is a first-class payment-terms concept even though no M-Pesa integration was observed in-product [OBSERVED placeholder text; INFERRED they expect manual M-Pesa settlement].

## 5c. Commitments — form schema + model [OBSERVED form; create attempt failed validation]

Page: "Subcontracts, purchase orders and what is owed on them." Explicit 3-step mental model: **1) Add the contract → 2) Certify their claims → 3) See what's owed** (paid / held back / still to pay always up to date).

Fields: Vendor · Scope · Contract value · Retention % · Advance/mobilisation (optional) · Advance paid (USD) · **Recover % of each claim** · Status (active/completed/overdue/on hold) · Cost code (optional). This is the commitment→claim→payment chain our money model needs; retention + advance-recovery are built into the commitment itself.

Create attempt: `POST /api/projects/{id}/commitments` fired but record did not appear — likely validation (vendor may need to exist in Directory/Subcontractors first) [INFERRED]. Saved-state UI still [NOT REACHED].

## 5d. Certificates — form schema + prerequisite chain [OBSERVED form; create blocked]

Project → Certificates tab → "Record a payment certificate" (IPC model):
- Previously certified total shown; fields: Certificate no. (e.g. IPC-04), Period (e.g. Aug 2026), Valuation date
- "The certificate states": Amount for this period, Gross valuation to date, Amount (USD), **Retention %**, **Advance recovered (USD)**
- Live computed totals: THIS PERIOD / RETENTION / **NET PAYABLE**
- Status: Submitted · Under review · Certified · Paid · Rejected
- Optional scanned-certificate PDF/photo attach

**Prerequisite finding [OBSERVED]:** certificates, analytics %, cost control and budget all show "—" / "Set a contract sum" until a contract sum exists — contract sum (set via Variations tab or project setup) is the root financial input that unlocks the whole money chain. Our schema should treat contract sum as a first-class project field set at inception, not an afterthought.

## 5e. Financials page — all 7 tabs extracted [OBSERVED]

Tabs: Overview · Ledger · Bill of quantities · Commitments · Applications · Retention · Budget (+ Export Excel/PDF). "Financial tracker — Money in and out, budget against actual, exports."

- **Ledger/Budget:** cost categories with Add; "Variance: $0 — Positive = under budget. Negative = over budget."
- **BOQ tab:** same BOQ editor; "The total becomes this project's budget" — BOQ pricing feeds budget directly.
- **Applications:** "Create a payment application, submit it for review, then approve and pay." Columns: NUMBER · PERIOD · COMMITMENT/VENDOR · REQUESTED · RETENTION · NET PAYABLE · STATUS · WORKFLOW.
- **Retention:** "appears here once commitments hold retention or applications certify amounts" — retention is derived, not entered.

## 5f. Created record #5 — Payment application #ZZ-APP-01 [OBSERVED]

`POST /api/projects/{id}/payment-applications` succeeded. Row: #ZZ-APP-01 · Nov 2026 · — commitment · $0 requested · $0 retention · $0 net payable · **Draft** · actions **Submit · Mark paid**.

Form: Number · Period · **Commitment select** (links application to a subcontract/PO — "— none —" when no commitments) · Work completed this period · Previously certified · Requested amount · Retention % → live Retention amount + Net payable. This is the subcontractor-side claim; combined with the Certificates tab (client-side IPC) the full valuation chain is: commitment → application → certificate → invoice → retention release.

## 5g. Created record #6 — Punch item PL-2419 [OBSERVED]

`POST /api/punch` succeeded (verified on reload — earlier list render was stale).

**Form richness:** TITLE* · DESCRIPTION · PROJECT · LOCATION (Bldg/Level/Room) · TYPE/CATEGORY (architectural·mep·finishes·structural·civil·other) · **TRADE — 36-value taxonomy** (Masonry…Solar & Energy…Traffic Control…Cleaning & Handover) · PRIORITY (H/M/L) · DUE DATE · ASSIGNEES multi · **PUNCH ITEM MANAGER** + **FINAL APPROVER** (separate accountability roles) · DISTRIBUTION LIST · COST IMPACT + SCHEDULE IMPACT (Yes/Yes-unknown/No/TBD/N/A) · COST CODE · REFERENCE (drawing) · **Private (restrict visibility)** checkbox.

Statuses: Open · In Progress · Ready for Review · Resolved · Closed · Rejected. Table: CODE·TITLE·LOCATION·TRADE·ASSIGNEES·PRIORITY·STATUS·DUE·IMPACT + CSV/PDF export.

**Quirk observed:** due date rendered as `61120-02-02` for input 2026-11-20 — likely a date-parsing bug on their side [OBSERVED anomaly; do not replicate].

## 5h. Remaining modules — page + form captures [OBSERVED]

Every sidebar module was opened; create-form interiors captured for ~25 flows. Summary per module:

| Module | Page model | Form highlights |
|---|---|---|
| **Inspections** (Quality & safety) | "Template-driven QA/QC inspections with consultant approval workflow." Statuses: Draft→Pending Consultant→In Review→Approved/Rejected/**Rework Required**→Closed. Types incl. civil works (Road Surface, Subgrade, Drainage/Culvert, Bridge, Asphalt Compaction, Traffic Control). Request form: type, date, inspector, **assign to consultant (multi)**, **checklist template (required)**, notes, readiness photos (0/10), evidence photo/video (0/10, 0/3) |
| **Safety incidents** | "Report and track safety incidents, near-misses, and corrective actions." Statuses open/investigating/closed. Form: date, type (Injury, Near Miss, Environmental, Property Damage, Struck by Equipment, Rollover, Cave-in, Traffic, Asphalt Burn), severity minor→fatality, reporter, description, witnesses, corrective action |
| **Observations** | "Quality and safety issues… and the actions that fix them." Two tabs: Observations + **Corrective actions**. Types Quality/Safety/Environmental/Commissioning; priorities; project + assignees |
| **Checklists** | Templates / Assignments by trade / My checklists. **Upload PDF/Word/Excel/CSV/Image → auto-extract checklist** + **Form Builder**: question types Text, Number, Date, Yes/No, Pass/Fail, Dropdown, Checkbox, Photo, Signature + required + sub-questions. Trade taxonomy (36), categories safety/quality/pre-handover/custom, Global flag |
| **Punch list** | See §5g — richest form (manager + final approver, distribution, impact scales, Private flag) |
| **Inventory** | Materials + Equipment tabs. Material form: name, SKU, category, unit (bags/tonnes/m/m²/m³/kg/pcs/rolls/litres/boxes), project/company-wide, location, opening stock, min/reorder/max levels, **acceptable waste %** (with plain-language explainer), reorder qty, supplier + contact + **delivery lead time days**, unit cost (KES), notes — a real stock ledger, not a list |
| **Schedule** | "Project programme: activities, phases and milestones against the calendar." Gantt/List/Milestones views, Weeks/Days scale, statuses Not started/In progress/Done/Blocked, **AI schedule** generator, Add activity |
| **Plans & drawings** | Drawing filters by discipline (Architectural/Mechanical/Structural/Electrical/Civil), **AI Concept / AI Design "SOON"** badges, Upload |
| **Team** | Invite member: name/email/**role dropdown listing all 14 roles per row**; members CONTRACTOR-CO, CLIENTUSER, abel, watson, QA-USER — client (CLIENTUSER) also appears as team member with assignable roles (dual-path: client portal invite AND team role) |
| **Attendance** | Today/History/Team history/**Access log** tabs; "Mark team attendance"; metrics: people working, on site, late, on leave; per-member check-in/out/break/location — geo check-in |
| **Directory** | Contacts & companies; categories Client/Consultant/Subcontractor/Supplier/Authority |
| **Subcontractors** | "Subcontractor & supplier database" — $ committed/paid/to-pay rollups; **"Subcontracts awarded through Bidding or created in Commitments attach automatically by company name"** (reveals a Bidding module not exposed in this workspace's nav) |
| **Crews** | Name*, trade (36-taxonomy + "Other (type it)"), foreman, project*, shift Day/Night, usual work area |
| **Coordination issues** | "RFIs, clashes and design questions." Types RFI/Clash/Design Question; priorities; statuses Open/Answered/Closed |
| **Correspondence** | Letters, submittals, transmittals, notices; types + project; "Save Draft" |
| **Company documents** | Policies/Templates/Certifications/Insurance/HR/Legal categories; upload |
| **Reports** | Financial/Operational · By Project/By Region/Custom · **Scheduled sends** · Export PDF |
| **Announcements** | Title/body, priority Low→Urgent, audience Everyone/By Project/By Role/**Hand-pick people**, attachments, **"Require acknowledgement"** read-receipt flag, live recipient count |
| **Billing & plan** | Starter $23/mo (3 users then ~$700 KES/extra; unlimited projects; free client accounts) · Business $69/mo (10 users; +Financials/BOQ/certificates/inventory/subcontractors/reports/RBAC) · Business yearly $690. **KES pricing shown natively with USD toggle**; per-seat math shown for current team size |
| **Settings** | Profile, Account & Security, Company (incl. sector multi-select: land sales, borehole, roads & civil, QS, etc. + "Save company profile") |
| **Inbox** | Team chat: conversations, "New group", member/read state |
| **Site checks** | [NOT REACHED] — nav click repeatedly renders Dashboard; likely project-scoped or stub. Flagged honestly. |

## 6. Coverage status vs "click everything"

| Area | Status |
|---|---|
| All sidebar modules | ✅ visited; Money group children enumerated (Financials/Commitments/Quotes/Invoicing/Inventory/Billing & plan) |
| All 13 project tabs | ✅ bodies extracted this pass |
| Every sidebar module + group | ✅ all visited; ~25 create-form interiors captured (§5h) |
| Create flows exercised end-to-end | ✅ CO (full lifecycle), daily log, quote (draft→sent), invoice, payment application, punch item. Remaining modules: forms fully mapped; saved-state UI [NOT REACHED] for inspection/observation/checklist/crew/subcontractor/contact/incident/RFI/correspondence/announcement/inventory |
| Site checks page | ⚠️ [NOT REACHED] — nav renders Dashboard (project-scoped or stub) |
| Settings | ✅ Account Security + Company captured earlier (`settings-*.json` local) |
| Role Manager matrix | ✅ extracted earlier for all 14 roles |
| Role-scoped logins | ✅ QS, Architect, QA/QC probed; **Client portal verified end-to-end** (§5, §6c) |
| Quote → client accept → contractor status | ✅ **full loop OBSERVED** — client typed-name acceptance synced back as "Accepted by CLIENT USER" + Start project action |
| Contract sum → variation rollup → certificates | ✅ OBSERVED (§6b); certificate save-state still NOT REACHED |

**Remaining gaps (honest):** saved-state detail for invoice/commitment/inspection/punch/checklist; "Viewing as" switcher mechanics; Ask AI / Shemmy chat; upload pipeline end-to-end; bidding flow (no bid packages in workspace); certificate create save; remaining field-module creates (crew/subcontractor/contact/incident/RFI/correspondence/announcement/inventory).

## 6b. Contract sum setup + certificates live state [OBSERVED]

- Variations tab → "Set contract sum" opens editor: contract sum (numeric, currency follows top-bar toggle — USD shown, hint says switch to KES to enter KES), start date, finish date → `PUT /api/projects/{id}/contract`. Saved dummy **$1,000,000** on GRAND TOWERS (cleanup: reset/zero it).
- After save, Analytics/Cost control/Categories unblocked: Original contract sum $1,000,000 · Approved variations +$100.10 (CO-4990) · **Revised contract sum $1,000,100.10** — variations roll up automatically.
- Certificates tab with contract sum set: Certified to date $0 (0%), Paid $0, Retention held $0, **Still to certify $1,000,100.10**, "Cumulative valuation against contract 0%".
- **Architecture finding:** certificate history already lists **#ZZ-APP-01** (the payment application) as its single row with per-status action buttons (Submitted/Under review/Certified/Paid/Rejected) + Attach — payment applications and payment certificates share one underlying record model [OBSERVED]. The client-side IPC form (period valuation, retention %, advance recovery, live NET PAYABLE) computes live but a save attempt was abandoned when inputs were ambiguous — saved-state certificate still [NOT REACHED].

## 6c. Client invite → registration → dashboard flow [OBSERVED end-to-end]

Owner supplied working client credentials (previous failure was wrong password). Verified chain:
1. Contractor invites client on the **project's Client tab** (project-scoped, separate from People/Team invites — Team also lists CLIENTUSER as a member with assignable roles: dual-path identity).
2. Client registers/logs in at the **separate client path** ("I'm a client" on login) — contractor creds rejected there.
3. Client lands on client dashboard (Home/My sites/Messages/Quotes & proposals/Site reporting/Request a project/Account); GRAND TOWERS appears under "Your sites" as "CLIENTCO CONTRACTORS · Nairobi · 0% complete".
4. Quote sent to the client's email surfaces in **Quotes & proposals** (see §4 + acceptance E2E above) — proving contractor→client record sync is keyed on **email match**, not invite token alone.

## 7. What this means for our build [INFERRED]

1. **CO engine is the proven core loop** — our change-order module should copy the status machine + per-transition actor activity log + approval limits.
2. **Quote→accept→project** is the acquisition wedge — implement share-link + WhatsApp share + client-portal quote inbox early (ADR-007).
3. **Client visibility is granular** — per-media opt-in on daily logs, per-item inspection sharing, project-scoped client identity. ADR-009 must be field-level, not record-level.
4. **Closeout is a stage machine with prerequisites** — practical completion gates retention release; replicate in our closeout module.
5. **Finishes approval loop** (client approves selections from phone before ordering) is a cheap, high-delight feature worth stealing the *concept* of.
