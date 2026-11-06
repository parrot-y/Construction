# 04 — End-to-end journeys

## J1. Win work → project → get paid (contractor + client)
1. Contractor creates **Quote** from template (e.g. kitchen remodel), adds client WhatsApp number, VAT %, deposit %.
2. Shares quote via WhatsApp link (`/public/quotes/:id`) → client accepts on phone (`/respond`).
3. Contractor **converts quote → project**; deposit invoice auto-drafted → sent → paid (Paystack/M-Pesa/card/bank).
4. Project created (or via Jobs/Bidding for larger work — bid-packages with award flow).
5. Project tabs activated: Contract, Drawings, BOQ (import), Schedule (manual or AI-generated).
6. Ongoing: daily logs, checklists, inspections, punch, observations, COs.
7. Money: commitments with subs/suppliers → their claims certified → payment applications → certificates issued → client approves/pays via portal → retention tracked and released at closeout → Closeout tab.

## J2. Daily site operations
Supervisor/Trade Lead/Worker (mobile-first, Field App permission): daily log (crew, work done, GPS, weather, photos w/ client-visibility toggle) → checklists assigned by trade → tasks (Kanban) assigned/completed → attendance check-in (geofenced? location captured) → issues → observations → punch items → inspections scheduled with consultant.

## J3. Change order lifecycle
Field issue → RFI (Coordination issues) → CO drafted (linked RFI, trigger, cost+schedule impact) → PM Review (within approval limit) → Owner Approval (above limit / major) → Approved → budget/schedule updated → client sees in portal → invoice/valuation reflects it. Rejected/Void paths exist; activity log per CO.

## J4. Inspection → close-out
QA/QC Officer or Site Engineer raises Inspection Request (type, template, consultant assignee, readiness+evidence photos) → Pending Consultant → consultant reviews → In Review → Approved/Rejected/Rework → Closed. Reports visible to client (`client-visible` flag, Inspection Reports permission).

## J5. Client/developer view (partially reachable)
Client gets free account via project Client tab → sees stage photos/videos (contractor controls per-item visibility), progress, approves change orders (`/public/portal/:token/change-orders/:id`), selections, messages contractor (threads), pays invoices, downloads reports. Diaspora-friendly: web portal, WhatsApp quote acceptance, multi-currency display.

## J6. Procurement & payment to subs
Subcontractor/supplier added to database → commitment created (retention %, advance, recover %) → sub submits claim → contractor certifies → payment application → approve → mark-paid (B2C/disbursement?) → retention held → release at end (`/retention/due`, `/release`).

## J7. Onboarding a company
"New company? Create your company account" on login → company profile/logo → invite team (roles) → create project (or convert quote) → upload drawings/BOQ → invite client via Client tab → set location for weather → optional AI schedule/checklists.
