# Platform — 30-Day Live Site Pilot Protocol

**Target Audience:** Kenyan Main Contractors (NCA Categories 3–6 Building Contractors)  
**Pilot Cohort:** 1–3 Active Construction Sites in Nairobi / Kiambu / Machakos  
**Duration:** 30 Calendar Days  
**Primary Success Criterion:** Site team conducts the core workflow digitally and does **not revert to unstructured WhatsApp groups or Excel spreadsheets**.

---

## 1. Executive Pilot Objectives

1. **Eliminate WhatsApp Site Chaos:** Transition site diaries, daily headcount, and delivery receipts from unstructured chat groups into an append-only digital site record.
2. **Prevent Budget Slippage:** Expose real-time project variance ($\Delta = \text{Cost Consumption \%} - \text{Physical Progress \%}$) before costs exceed certified budget.
3. **Formalize Contractual Variations:** Stop informal verbal site alterations through a digital QS evaluation and Client sign-off chain with atomic budget updates.
4. **Generate Bankable Interim Valuations:** Produce print-ready, professional Interim Payment Certificates (IPCs) adhering to Kenyan standard practice (EASMM / JBC 1999 form) with statutory 10% retention deduction (capped at 5%).

---

## 2. Participant Profiles & Mobile Onboarding

| Role | User Persona | Device & Environment | Primary Field Responsibility |
|---|---|---|---|
| **Site Supervisor / Foreman** | Juma Omondi | Android Smartphone (Chrome PWA), 3G/Edge, dusty outdoor environment | Daily morning & evening site diary, trade headcount matrix, material delivery photo proof, weekly physical progress %. |
| **Project Manager / QS** | Faith Achieng | Laptop / Tablet (Web browser), Site Office / Head Office | BOQ import, line item tracking, subcontractor cost entry approvals, variation order evaluations, interim payment certificates. |
| **Company Admin / Contractor** | David Mwangi | Laptop / Smartphone | Portfolio health oversight, critical approvals, contractor cash flow runway, company user access management. |
| **Property Developer / Client** | Alice Nduta | Smartphone / Laptop (Client Portal) | Executive progress oversight, verified photo evidence inspection, variation order review & one-click sign-off. |

---

## 3. Four-Week Step-by-Step Pilot Cadence

### Week 1: Project Setup & Baseline Locking
- **Day 1: Project Registration & Team Assignment**
  - Company Admin creates project record with NCA Registration Number, physical location, and scheduled dates.
  - Generates cryptographic invite tokens for PM/QS, Site Supervisor, and Client.
- **Day 2–3: BOQ Import & Validation**
  - PM/QS uploads contractor's Excel BOQ via the 6-stage import pipeline (ADR-003).
  - System maps EASMM sections (Preliminaries, Substructure, Superstructure, Roofing, Finishes).
  - Arithmetic anomaly detection validates line item totals ($Qty \times Rate = Amount$).
  - Admin/QS confirms preview and locks `original_agreed_budget` into PostgreSQL RLS.
- **Day 4–5: Field PWA Setup**
  - Site Supervisor installs Platform PWA on smartphone (`Add to Home Screen`).
  - Supervisor verifies offline capability: turns off mobile data, logs dummy test diary entry, reconnects data, and verifies automatic sync.

---

### Week 2: Mobile Field Operations & Evidence Logging
- **Daily Site Diary Logging (Target: By 18:00 EAT Daily):**
  - Select weather preset (`SUNNY`, `RAINY`, `MUDDY`, `HOT`).
  - Select operational status (`OPERATIONAL`, `RAINED_OUT`, `STALLED`).
  - Input trades headcount matrix (Carpenters, Masons, Steel fixers, Plumbers, Electricians, Casual laborers).
- **Material Delivery Capture:**
  - Upon delivery of materials (e.g. 200 bags Bamburi Cement, 4 tonnes D12 rebar), supervisor taps "Log Delivery".
  - Snaps photo of physical delivery note and material stack on site.
  - Browser Canvas engine automatically compresses photo from 5MB to ~150KB.
  - Metadata captures local device timestamp and Nairobi GPS coordinates.
- **Weekly Progress Measurement:**
  - End of week: PM/QS and Supervisor walk site and record physical completion % against active BOQ line items.

---

### Week 3: Commercial Control & Contractual Variations
- **Cost Capture & Invoice Approvals:**
  - Subcontractor and supplier invoices uploaded by PM/QS.
  - Expenses categorized by section code and linked to active BOQ items.
  - Multi-step approval: PM reviews, Admin approves.
- **Contractual Variation Order (When Scope Changes):**
  - Client or Architect requests site change (e.g. addition of reinforced concrete cantilever, omission of drywall partitioning).
  - PM/QS submits Variation Order with itemized additions and omissions (`apps/web/CreateVariationModal.tsx`).
  - QS evaluates net financial impact.
  - Client receives alert in Client Portal, inspects KES impact and time extension days, and clicks **Approve** or **Reject**.
  - Upon approval, `project.current_approved_budget` updates atomically in PostgreSQL.

---

### Week 4: Client Valuation & Formal Certification
- **Interim Payment Certificate (IPC) Generation:**
  - PM/QS generates draft Interim Valuation based on approved physical progress and verified costs.
  - System applies statutory Kenyan retention formula:
    - 10% deduction on gross valuation.
    - Capped at 5% of Contract Sum.
  - System renders print-ready, professional IPC PDF (`apps/api/src/reports/PaymentCertificatePdf.tsx`) adhering to ADR-002.
- **Tripartite Sign-Off & Review:**
  - QS signs certificate with BORAQS registration number.
  - Employer/Client receives certificate in Client Portal for payment release.
- **Pilot Retrospective & Commercial Conversion:**
  - Contractor, QS, and Developer complete 15-minute pilot review questionnaire.
  - Conversion to paid monthly subscription (KES 7,500/project/month).

---

## 4. Quantitative Success Criteria (Go / No-Go Gate)

At Day 30, the pilot is deemed successful if all four quantitative benchmarks are met:

| Metric | Target | Measurement Method | Failure Condition |
|---|:---:|---|---|
| **Diary Completion Rate** | $\ge 85\%$ | Count of approved daily site diaries divided by working days in month | Site falls back to WhatsApp voice notes |
| **Material Proof Ratio** | $100\%$ | Ratio of recorded material deliveries with verified geotagged photo | Unverified verbal delivery claims |
| **Financial Auditability** | $\ge 90\%$ | Percentage of approved contractor costs mapped directly to BOQ line items | Unmapped miscellaneous bulk spend |
| **Variation Formality** | $100\%$ | All client-approved variations processed through digital approval chain | Informal handshake variation disputes |
| **Contractor NPS** | $\ge 8 / 10$ | Structured exit interview with Contractor Owner and Lead QS | "Too complicated for our site foreman" |

---

## 5. Pilot Field Support Protocol

- **Dedicated WhatsApp Support Line:** Direct developer support for site supervisors experiencing network sync questions or mobile browser quirks.
- **Offline Data Safety Guarantee:** All photos and entries cached locally in browser IndexedDB with UUID idempotency keys; zero data lost during remote site internet outages.
- **Weekly Progress Check-in:** 20-minute weekly call with Contractor PM to review variance analytics and unblock commercial questions.
