# 04 — End-to-end journeys

Claim tags: **[OBSERVED]** = seen in the authorised contractor console; **[INFERRED]** = reasoned from UI/permissions, not walked end-to-end; **[NOT REACHED]** = requires records/accounts we did not create.

## J1. Win work → project → get paid (contractor + client) — [OBSERVED end-to-end through quote acceptance]
1. [OBSERVED] Contractor creates **Quote** from template (e.g. kitchen remodel), adds client WhatsApp number, VAT %, deposit %.
2. [OBSERVED] Shares quote via WhatsApp link (`/public/quotes/:id`) → client accepts on phone (`/respond`).
3. [OBSERVED] Quote surfaces in the **client portal's "Quotes & proposals"** when the client email matches an account; client accepts via **typed-name e-signature** → `POST /api/public/quotes/{token}/respond` → contractor sees "Accepted by {name}" + **Start project** action. (Verified live with Q-0001, 2026-11-06.)
4. [INFERRED] Contractor clicks Start project → deposit invoice auto-drafted → sent → paid (Paystack/M-Pesa/card/bank) — conversion/payment steps not executed.
5. [INFERRED] Project created (or via Jobs/Bidding for larger work — bid-packages with award flow).
6. [OBSERVED] Project tabs activated: Contract, Drawings, BOQ (import), Schedule (manual or AI-generated).
7. [OBSERVED] Ongoing: daily logs, checklists, inspections, punch, observations, COs.
8. [OBSERVED] Money: contract sum set on project → variations roll up to revised contract sum → commitments with subs/suppliers → their claims certified → payment applications (= certificates, shared record model) → client approves/pays via portal → retention tracked and released at closeout → Closeout stage machine.

## J2. Daily site operations — [INFERRED from forms + permissions; Field App roles not reachable]
Supervisor/Trade Lead/Worker (mobile-first, Field App permission): daily log (crew, work done, GPS, weather, photos w/ client-visibility toggle) → checklists assigned by trade → tasks (Kanban) assigned/completed → attendance check-in (geofenced? location captured) → issues → observations → punch items → inspections scheduled with consultant.

## J3. Change order lifecycle — [OBSERVED form + status list; transitions INFERRED]
Field issue → RFI (Coordination issues) → CO drafted (linked RFI, trigger, cost+schedule impact) → PM Review (within approval limit) → Owner Approval (above limit / major) → Approved → budget/schedule updated → client sees in portal → invoice/valuation reflects it. Rejected/Void paths exist; activity log per CO.

## J4. Inspection → close-out — [OBSERVED request form; consultant-side review INFERRED]
QA/QC Officer or Site Engineer raises Inspection Request (type, template, consultant assignee, readiness+evidence photos) → Pending Consultant → consultant reviews → In Review → Approved/Rejected/Rework → Closed. Reports visible to client (`client-visible` flag, Inspection Reports permission).

## J5. Client/developer view — [OBSERVED interior, 2026-11-06]
Client gets free account via project Client tab (project-scoped invite; separate login path "I'm a client"; contractor creds rejected there) → dashboard: Home (site cards w/ % complete) · My sites · Messages · Quotes & proposals · Site reporting (independent inspection upsell) · Request a project (client-initiated tender) · Account → project interior tabs: Progress · 360° tour · Daily logs · Inspections · Approvals & invoices · Chat. Quote acceptance = typed-name e-signature; decline/comment-request-changes loop; finishes approved from phone; invoices paid via portal; change orders approved via `/public/portal/:token/change-orders/:id`. Diaspora-friendly: web portal, WhatsApp quote acceptance, multi-currency display (KES native, USD toggle).

## J6. Procurement & payment to subs — [INFERRED from forms; no records created]
Subcontractor/supplier added to database → commitment created (retention %, advance, recover %) → sub submits claim → contractor certifies → payment application → approve → mark-paid (B2C/disbursement?) → retention held → release at end (`/retention/due`, `/release`).

## J7. Onboarding a company — [OBSERVED login page + INFERRED from settings]
"New company? Create your company account" on login → company profile/logo → invite team (roles) → create project (or convert quote) → upload drawings/BOQ → invite client via Client tab → set location for weather → optional AI schedule/checklists.
