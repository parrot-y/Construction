# 12 — Deep pass: project tabs, created records & live workflows

**Date:** 2026-11-06 · **Account:** Contractor workspace (POWELL, USD, trial) · **Method:** Puppeteer + system Chrome, env-var credentials only.
**Evidence tags:** [OBSERVED] seen live · [INFERRED] reasoned · all created records prefixed `ZZ-RESEARCH-` and logged in `CREATED_RECORDS.md`.

This pass went beyond navigation: every project-detail tab body was extracted, and three record types were created and driven through real state changes to observe saved-state UI, validation, and workflows.

---

## 1. Project detail tabs — full content map [OBSERVED]

Project: MAKUNDI APARTMENTS (P-UTR3). 13 top-level tabs; each is a module hub, not just a view.

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
- PROJECT (prefilled to MAKUNDI APARTMENTS)
- NUMBER (auto if blank → assigned CO-4990)
- AREA / LOCATION
- TRIGGER select: Design clarification · Owner request · Unforeseen condition · Code compliance · Structural review · Weather/delays · Other
- LINKED RFI (optional link)
- STATUS select: Drafted · PM Review · Owner Approval · Approved · Rejected · Void
- COST IMPACT (USD), SCHEDULE IMPACT (DAYS)
- REQUESTED BY (free text, e.g. client name)
- ASSIGNEES (multi-select of workspace members: POWELL/Contractor, brendah/Owner, abel/Architect, watson/QS, LISA/QA-QC — confirms all 5 role accounts live in one workspace)

**Detail panel actions by status** (walked live):

| Status | Buttons observed |
|---|---|
| Drafted | Edit · **Submit for PM review** · Approve · Reject |
| PM Review | Edit · **Send for owner approval** · Approve · Reject |
| Approved | Edit · Reject |

- Activity log records every transition with actor: "POWELL · Contractor created this change order", "moved it to PM Review", "moved it to Approved".
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

Client portal interior (verified with owner-supplied login): Home · My sites · Messages · Quotes & proposals · Site reporting · Request a project · Account; project interior tabs: Progress · 360° tour · Daily logs · Inspections · Approvals & invoices · Chat. Client account page: email, full name, phone/WhatsApp, country, Save, Sign out.

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

## 6. Coverage status vs "click everything"

| Area | Status |
|---|---|
| All sidebar modules | ✅ visited; Money group children enumerated (Financials/Commitments/Quotes/Invoicing/Inventory/Billing & plan) |
| All 13 project tabs | ✅ bodies extracted this pass |
| Create flows exercised end-to-end | ✅ CO (full lifecycle), daily log, quote (draft→sent). Others (invoice, commitment, inspection, punch, observation, checklist, subcontractor, crew, RFI, incident, correspondence, contact) — forms captured read-only earlier; saved-state UI still [NOT REACHED] |
| Settings | ✅ Account Security + Company captured earlier (`settings-*.json` local) |
| Role Manager matrix | ✅ extracted earlier for all 14 roles |
| Role-scoped logins | ✅ QS, Architect, QA/QC probed; Client portal verified |

**Remaining gaps (honest):** saved-state detail for invoice/commitment/inspection/punch/checklist; "Viewing as" switcher mechanics; Ask AI / Shemmy chat; upload pipeline end-to-end; bidding flow (no bid packages in workspace).

## 7. What this means for our build [INFERRED]

1. **CO engine is the proven core loop** — our change-order module should copy the status machine + per-transition actor activity log + approval limits.
2. **Quote→accept→project** is the acquisition wedge — implement share-link + WhatsApp share + client-portal quote inbox early (ADR-007).
3. **Client visibility is granular** — per-media opt-in on daily logs, per-item inspection sharing, project-scoped client identity. ADR-009 must be field-level, not record-level.
4. **Closeout is a stage machine with prerequisites** — practical completion gates retention release; replicate in our closeout module.
5. **Finishes approval loop** (client approves selections from phone before ordering) is a cheap, high-delight feature worth stealing the *concept* of.
