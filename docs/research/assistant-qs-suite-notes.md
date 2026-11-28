# Assistant QS suite — competitive notes (from construction.mp4, 2026-11-25)

Source: 53-min screen recording of an AnyDesk session. The other party showed a
self-hosted ASP.NET MVC web app at `192.168.100.10` titled **"Assistant QS"**
("In4Suite" branding in the header). No audio narration — visual only.

## What the suite covers (observed screens)

### Material indents (their core workflow)
- Left nav: Home, Projects, Inventory (Purchase Orders, Engg GRN, Issue
  Inventory, Expenses, Return Inventory, Gate Pass, Material Reconciliation,
  Transfer Order), HR, Masters, Utilities, Search; top modules Land /
  Tendering / Site-Activity / Billing / Approvals.
- **Indent List**: filters for Project, Sub Project, Floor, Unit, Contractor,
  Work Order, Work Category/Sub-Category, Material/Asset type & subtype,
  Status. Status buckets: *Unfulfilled PO/TO*, *Unfulfilled Issue*,
  *Fulfilled PO/TO*, *Fulfilled Issue*. "Create Indent" / "Show Indents".
  Two indent kinds: **Service Indent** vs **Material/Asset Indent**;
  "Category of Indent".
- **Indent detail** (e.g. item 99759): Material Type/Sub Type, Store
  ("Eldoret Store"), Indent Date, Approval Date, Bench Mark with **Lead Time
  (3 days)**, Expected Delivery Date, UOM, Recommended Qty, Notes.
  **Delivery Schedule** grid (Batch Date / Quantity). Actions:
  Amend & Modify Material, Amend & Remove Material, Close Back, Print,
  **Audit Trail**. Approval stamped with user + timestamp.

### Stores / procurement register
- PO register rows: PO/ACL numbers, dates, supplier (Ramji & Sons Ltd,
  Oriom Hardware & Novators Ltd.), store location (Eldoret Store, Nairobi),
  material (sand, ballast, cement, steel bars, trane), qty, value, status
  "Approved". Modules: Engg GRN, Issue Inventory, Return Inventory,
  Gate Pass, Material Reconciliation, Transfer Order.

### Masters
- **Contractor List**: Firm Name, Work Category, PAN No./Tax Id, Sub Work
  Category, Firm Code, Phone, Fax, City, Status (e.g. Pending).
- **BOQ List**: Attach/Copy BOQ, Bulk Delete, **Import/Export BOQ**,
  **Create Floor / Unit Mapping**, BOQ versions (V3.5), filters by
  Project/Sub Project/Work Category/Floor/Unit/BOQ Name/date range.
- **Rate Master**: rates by Country → State → City + Project + Item Type +
  Material/Asset type & subtype; **Bulk Upload Rate Master**, **Bulk Edit**.
- Checklist + Templates module.

### Adjacent tools on their machine
- Procore (app.procore.com) open in another tab — drawings register,
  documents, meetings, punch list, incidents for project "PBSA 011 –
  ELDORET" (LANCEWOOD Acorn Management Services Ltd).
- Browser bookmarks: Procore, "Online Ruler: Calibrate…", ChatGPT, PDF24.

## Gap analysis vs SiteSafi (as of devin/contractor-lifecycle)

Already covered: BoQ workbook + Excel import/export, material requisitions
with approval statuses, site inventory + movements (delivery in, usage out,
transfer, wastage), POs with deliveries, checklist templates/assignments,
documents/drawings register, snag/punch, invoices/valuations/certificates.

Gaps worth stealing (proposed backlog — NOT Phase 5 scope):

1. **Indent depth** — our `MaterialRequisition` lacks: store + floor/unit +
   work-order targeting, service-vs-material indent category, delivery
   schedule batches with expected dates, lead-time benchmark, amend-material
   workflow, print view, audit trail, and the four-way fulfilment buckets
   (unfulfilled/fulfilled × PO-TO/issue). Highest-value gap: it is the daily
   driver on a Kenyan site.
2. **Rate master** — shared rate library (geo + item/material typing) with
   bulk upload/edit; prefill BoQ lines and PO rates. We have rates embedded
   in BoQ/PO items only.
3. **Gate pass** — no material-exit authorization record at all.
4. **GRN/PO register polish** — our MaterialDelivery is diary-linked; they
   have a dedicated GRN/issue/return register with supplier + store + value
   columns. Ours may need a register view, not new schema.
5. **Contractor master** — unify supplier + subcontractor into one firm
   register w/ KRA PIN, work categories, approval status.
6. **BOQ floor/unit mapping** — takeoff dimension they have; check our
   BoqWorkbook for floor/unit fields.
7. **Print views** — indent/PO/GRN print is table stakes for site paperwork.
