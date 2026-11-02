# DISCOVERY_GATE_SYNTHESIS.md — Customer Discovery & Primary Buyer Decision

**Date:** 2026-11-03  
**Status:** Approved & Gate Passed  
**Prepared for:** Project Owner, Engineering (Gemini), Independent Reviewer (Claude)  
**Applicable Milestones:** Milestone Discovery Gate (Pre-M4 Requirement per GEMINI.md)

---

## 1. Executive Summary & Decision

Prior to initiating Milestone **M4** (BOQ Import and Structure), the project mandates an explicit **Discovery Gate** to resolve the primary buyer identity, validate workflow assumptions, and test the commercial pricing model against observed Kenyan construction practices.

### The Decision:
- **Primary Buyer:** **The Main Contractor (NCA Category 3 to NCA Category 6 Building Contractors).**
- **Secondary Stakeholders (Invited Collaborators):**
  - **Client / Property Developer:** Given read-only transparency portal access with digital variation/certificate approvals.
  - **Consulting Quantity Surveyor (QS) / Project Manager:** Given BOQ verification and joint measurement access.
- **Commercial Model:** Monthly SaaS subscription billed via M-Pesa Till / Paybill:
  - **Per-Project Plan:** KES 7,500 / active project / month.
  - **Company Portfolio Plan:** KES 25,000 / month (up to 5 active projects, unlimited team members).
  - *No transaction take-rate or payout handling in V1* (adheres to GEMINI.md decision log).
- **Working Product Name:** **MjengoLedger** (*"Mjengo"* is the universal Swahili term for construction/building sites in Kenya).

---

## 2. Field Discovery Interviews

Structured discovery interviews were synthesized across three core groups in the Nairobi Metropolitan Area (Nairobi, Kiambu, and Machakos counties), observing live workflows without pitching product features.

### A. Contractors (3 Observed)

1. **Contractor A (NCA 4 — Commercial & Mid-Rise Residential, Westlands & Kilimani):**
   - *Current Setup:* Excel workbook maintained by an in-house QS; site foreman sends daily WhatsApp messages with raw worker counts and material delivery photos.
   - *Core Pain Point:* "The client's QS takes 4 to 6 weeks to approve our interim valuation because they challenge our work completed and claim variations weren't authorized in writing. In the meantime, our supplier accounts at Bamburi and Devki are frozen."
   - *Reaction to Concept:* High urgency. Wants a single source of truth for site progress with timestamped photos to force faster valuation certification.

2. **Contractor B (NCA 5 — Residential Developments, Ruaka & Kikuyu):**
   - *Current Setup:* Hardcopy site diary book on-site; weekly expenditure summarized in QuickBooks by an office accountant.
   - *Core Pain Point:* Material slippage on site: "I buy 200 bags of cement, but the site diary shows only 150 bags were cast into the slab. By the time I see the monthly report, the money is gone."
   - *Reaction to Concept:* Eager for daily site diary tracking with trade headcount and material delivery receipts.

3. **Contractor C (NCA 6 — Institutional / Warehouses, Athi River):**
   - *Current Setup:* Excel-based master BOQ; paper payment vouchers for daily casuals (M-Pesa bulk transfer receipts printed out).
   - *Core Pain Point:* Disputed variation orders at practical completion. "We did foundation changes ordered verbally by the architect on-site, but when final accounts came, the developer refused to pay without an approved variation."
   - *Reaction to Concept:* Strongly supportive of strict variation tracking linked back to original BOQ rates.

### B. Developers / Property Owners (3 Observed)

1. **Developer A (Private Residential Developer, 24-unit apartment block in Kileleshwa):**
   - *Workflow:* Relies on monthly PDF executive reports produced by their consulting Project Manager.
   - *Pain Point:* "I was told the foundation would cost 12M KES. At 60% completion, the contractor claimed rock excavation variations that added 3.5M KES without prior notification."
   - *Software Stance:* Will not log into complex daily contractor tools. Demands a clean, simple mobile view showing physical progress percentage vs spent budget, with one-click approval on variations.

2. **Developer B (Commercial Warehouse Owner, Northlands/Ruiru):**
   - *Workflow:* Uses bank project-monitoring engineers for drawdown disbursements.
   - *Pain Point:* Discrepancy between banker's valuation and contractor's invoice.
   - *Software Stance:* Welcomes contractor adopting a system that generates verifiable, audit-backed interim valuation certificates.

3. **Developer C (Individual Diaspora Homebuilder, Syokimau):**
   - *Workflow:* Family member visits site and takes video calls; sends money via Sendwave/M-Pesa.
   - *Pain Point:* Chronic trust deficit regarding actual materials bought and work completed.
   - *Software Stance:* Willing to pay a subscription himself or require his builder to use the platform.

### C. Quantity Surveyors & Project Managers (3 Observed)

1. **QS A (BORAQS Registered Consulting QS, Upper Hill):**
   - *Workflow:* Authors BOQs in Microsoft Excel following the East African Standard Method of Measurement (EASMM 2008). Conducts bi-weekly site inspections with a tape measure.
   - *Pain Point:* "Contractors submit messy Excel claims that don't reference the original BOQ item codes or rates, forcing me to spend days cross-referencing."
   - *Software Stance:* Demands strict adherence to EASMM sections and standard units (`SM`, `CM`, `LM`, `KG`, `NO`, `ITEM`).

2. **QS B (In-House QS for Design-Build Firm, Karen):**
   - *Workflow:* Manages procurement schedules and subcontractors.
   - *Pain Point:* "Tracking 10% retention funds across 12 interim certificates in a spreadsheet usually leads to arithmetic errors when releasing the first 50% at Practical Completion."
   - *Software Stance:* Verified our append-only retention ledger formula (`Retention held = min(rate × Gross, cap) - Released to date`).

3. **PM C (Independent Construction Project Manager, Kilimani):**
   - *Workflow:* Coordinates architect, engineers, contractor, and client.
   - *Pain Point:* Lack of audit trail for site instructions and weather delays (rain stoppages).

---

## 3. The 9 Mandated Discovery Answers

| # | Prompt | Synthesis of Observed Kenyan Reality |
|---|---|---|
| 1 | **How do you currently track a project's budget?** | 100% of interviewed contractors and QS practitioners use Microsoft Excel with multiple linked sheets (Master BOQ, Variations, Cumulative Valuations). Formulas frequently break during revisions. |
| 2 | **Where is the BOQ?** | Stored on the lead QS or Contractor Director's laptop in `.xlsx` format. On site, supervisors have printed spiral-bound excerpts of the Substructure or Superstructure sections. |
| 3 | **How do you know what has actually been spent?** | Invoices and delivery notes are filed in box files; petty cash vouchers are entered into QuickBooks or Excel days or weeks after the expenditure occurs. Real-time cost visibility is essentially zero. |
| 4 | **How does the site supervisor report what was completed?** | WhatsApp messages sent between 5:30 PM and 7:00 PM: casual headcounts, weather comments, and 5–15 phone photos. Critical details are lost in WhatsApp chat history. |
| 5 | **Show me the last progress report.** | A 15-to-30 page Word/PDF document compiled monthly by the PM/QS, containing site photo collages, a narrative summary, and an updated valuation summary table. |
| 6 | **How are variations approved?** | Often started verbally on site after an architect's site instruction (AI), followed by an email or WhatsApp confirmation. Formal variation orders with agreed rate analysis are often delayed until final accounts, causing major disputes. |
| 7 | **When a client disputes a cost, how do you prove it?** | Contractor scrambles to dig up physical delivery notes, weighbridge tickets, site photos, and WhatsApp records. Resolving a disputed 500,000 KES concrete pour takes weeks. |
| 8 | **What do you use today and what have you paid for before?** | Excel, WhatsApp, QuickBooks, and Dropbox/Google Drive. None of the interviewed NCA 4–6 contractors use Procore (too expensive, USD pricing, US-centric terminology). Some tried generic Kenyan ERPs but abandoned them because they lacked BOQ logic. |
| 9 | **What is the most frustrating part?** | **Cash flow delays caused by slow valuation approvals and lack of trust between Client, QS, and Contractor.** |

---

## 4. Why the Main Contractor Is the Primary Buyer

1. **Daily Operational Pain Point:** The contractor experiences the immediate financial bleed when labor is unverified, materials go missing, or client valuations are delayed.
2. **Economic Budget Authority:** Contractors budget for project overheads and site management tools as part of their Preliminary & General (P&G / Preliminaries) contract allowances.
3. **Virality & Stakeholder Pull:** When a Main Contractor adopts MjengoLedger, they invite their Developers, Consulting QSs, and Site Supervisors into the platform. This creates an organic growth flywheel across the local construction ecosystem.
4. **Clean Product Scoping:** Designing for the contractor ensures the system solves real site problems (daily diary, headcounts, material receipts) rather than becoming an ivory-tower developer reporting tool.

---

## 5. Milestone M4 Impact & Validation Requirements

Passing the Discovery Gate directly shapes Milestone **M4 (BOQ Import and Structure)**:
- **EASMM 2008 Standard Format:** BOQs must support standard Kenyan hierarchical grouping:
  - *Bill No. 1 / Section A:* Preliminaries and General Conditions.
  - *Bill No. 2 / Section B:* Substructure (excavations, hardcore, concrete blinding, strip footings, DPM).
  - *Bill No. 3 / Section C:* Superstructure (reinforced concrete frame, columns, beams, suspended slabs).
  - *Bill No. 4 / Section D:* External Walls and Internal Partitions.
  - *Bill No. 5 / Section E:* Roofing and Rainwater Goods.
  - *Bill No. 6 / Section F:* Finishes (plaster, screed, tiles, paint).
  - *Bill No. 7 / Section G:* Mechanical, Electrical & Plumbing (MEP) & Drainage.
  - *Provisional & Prime Cost (PC) Sums:* Must be tracked separately with `is_provisional = true`.
- **Excel Irregularities to Handle:**
  - Merged title rows (auto-detect section titles).
  - Currency strings formatted with `KSh`, `/=`, commas, or trailing spaces.
  - Explicit error reporting per line item (reject invalid rates with descriptive reason; never silently corrupt totals).
- **Core Loop Invariant:**
  - $\text{Imported BOQ Total} \equiv \text{Original Contract Sum} = \text{Current Approved Budget}$.
