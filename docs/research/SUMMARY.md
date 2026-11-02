# Phase 0 Research Summary: Synthesis, Plan Adjustments & Architecture Decisions

**Date:** 2026-10-27 (Revised 2026-10-29 post second independent review)  
**Status:** Under Review (Revised following Second Independent Review by Claude)  
**References:**
- `docs/research/01-competitors.md`
- `docs/research/02-kenyan-construction-workflow.md`
- `docs/research/03-regulation-and-compliance.md`
- `docs/research/04-technical-patterns.md`
- `docs/research/05-ux.md`

---

## 1. Executive Summary

Phase 0 research investigated the Kenyan construction landscape across five critical domains: competitor dynamics, industry workflows, regulatory requirements, technical architecture, and field UX. Following two rounds of independent review (`PHASE0_REVIEW.md` and `PHASE0_REREVIEW.md`), all findings have been rigorously revised to eliminate root-domain citations, correct mathematical formulas, resolve PostgreSQL RLS transaction security flaws, and accurately reflect Kenyan statutory language.

### Core Verified Findings:
1. **The Competitor Landscape is Polarized:**
   - **Enterprise / Claims-Heavy:** **Lobocon** charges a **KES 300,000 for a 90-day pilot** and **KES 100,000/month (or KES 86,500/month on annual terms)** per project with unlimited users, targeted at contractors running multiple live contracts with complex Earned Value Management (CPI/SPI).
   - **Field Labor & Materials:** **Strukchad** charges **KES 2,000/user/month (Lite)** and **KES 5,000/user/month (Professional)**, emphasizing mobile site reporting and reconciliation with Kenyan payment rails (M-Pesa, Airtel, Pesalink).
   - **Contractor Operations:** **ManPro** focuses on material theft prevention and labor tracking via custom quotes and an Android app.
   - **Regulatory Knowledge:** **JengaLex / Goldberry** provides AI-powered building code and contract guidance.
   - **Unverified Names:** SiteBooks, Jabali Nexus, GeoJenga, ConstructionOS, and Kenya-specific BuildTrack were **not found** on the live web and are **excluded** from strategic plans.
2. **Regulatory & Statutory Boundaries:**
   - **BORAQS (Cap. 525):** The software must position itself strictly as a calculation and project control tool for the project team, never claiming to be an "Automated QS".
   - **Data Protection Act 2019:** Exemption from mandatory ODPC *registration* applies only where turnover is below KES 5,000,000 **AND** the business has fewer than 10 employees, and does not process data for any of the 12 Third Schedule purposes (such as property management or CCTV operation). **Substantive compliance (data security, lawful basis, 72-hour breach notification) is universally mandatory**.
   - **KRA eTIMS:** Generating eTIMS electronic tax invoices is a prerequisite before billing subscribing construction companies. Tax records must be kept for at least 5 years under Section 23 of the Tax Procedures Act.
3. **Technical Architecture Corrections:**
   - **PostgreSQL RLS & Prisma Transactions:** Batch extensions break interactive transactions and fail to guarantee that audit logs commit atomically with financial changes. The architecture mandates an explicit `withTenantTx` transaction helper running as non-owner `db_app`, `FORCE ROW LEVEL SECURITY` across all tenant tables, permissive policies with both `USING` and `WITH CHECK`, and `NULLIF(..., '')::uuid` to fail closed safely.
   - **BOQ Import:** Staged 6-stage pipeline using `exceljs` to handle merged cells, section headers, and currency formatting without silent corruption.
   - **Reporting & Container Footprint:** Selection between `@react-pdf/renderer` and Puppeteer will be determined through direct memory and performance benchmarking on Railway containers in Milestone M10.

---

## 2. What This Changes in the Project Plan

| Plan Area | Previous Assumption / Proposal | Revised Approach Based on Research Findings | Reason & Impact |
|---|---|---|---|
| **Competitive Positioning** | "First platform connecting BOQ to actual spend and evidence." | **Targeted hypothesis:** Simple, unbloated project control for Kenyan SME contractors and developers without expensive pilot fees or alienating EVM formulas. | Lobocon already provides BOQ-vs-progress with EVM. Differentiation lies in usability, speed, and accessible pricing. |
| **Pricing Model** | Undecided; possibility of per-user billing considered. | **Adopt flat per-project or per-company pricing with unlimited users**, avoiding Strukchad's per-user model. | Per-user billing disincentivizes adding site supervisors, foremen, and clients, breaking the collaborative evidence chain. |
| **RLS Multi-Tenancy Design** | Basic restrictive policy or client extension batch transaction. | **Mandate explicit `withTenantTx` helper, role separation (`db_app`), `FORCE ROW LEVEL SECURITY`, permissive policies with `USING` + `WITH CHECK`, and CI catalog checks.** | Client extensions break interactive transactions (audit log risks). Table owners bypass RLS unless `FORCE` is applied. Non-owner runtime role prevents silent RLS bypass. |
| **Interim Valuation Math** | General conceptual formula (which previously double-deducted retention). | **Append-only retention ledger:** $\text{Retention Held} = \min(\text{rate} \times \text{Gross}, \text{cap}) - \text{Released to date}$. Worked 4-certificate example; labeled `UNVERIFIED — TO BE VALIDATED BY A PRACTICING QS`. | Prevents under-paying contractors after Practical Completion release. Gated behind QS discovery interviews. |
| **BOQ Import Engine** | Simple table/CSV parser. | **Formal 6-stage pipeline:** Upload → Parse (`exceljs` with merged-cell resolution) → Column Mapping → Validation/Anomalies → Preview Table → Atomic DB Commit. | Real Kenyan BOQs contain merged cells, section headers, and provisional sums that silently corrupt financial totals if not validated. |
| **Financial Decimal Precision** | Generic `numeric(15,2)` assumed for all numbers. | **Explicit precision catalogue in `packages/money`:** Amounts `numeric(15,2)`, Quantities `numeric(12,4)`, Unit Rates `numeric(15,4)`; standard Round Half-Up on certificate totals (R-018). | Unit rates and measured quantities require higher precision than final currency totals to prevent rounding drift. |
| **Legal & Marketing Copy** | Potential use of "AI Quantity Surveyor" or "Automated QS". | **Strictly prohibited.** Copy must emphasize "Project Financial Control" and "Collaborative Oversight". | Section 3 of Cap. 525 restricts the title and professional practice of Quantity Surveying to BORAQS-registered individuals. |
| **Regulatory Compliance** | General turnover exemption assumed. | **Clarified ODPC criteria:** Turnover < KES 5M **AND** < 10 employees; Third Schedule exclusions (property management, CCTV); universal 72-hour breach notice; 5-year tax record retention. | Ensures adherence to Data Protection Act 2019 and prevents accidental trigger of mandatory registration via scope creep. |
| **Client Portal UX** | Showing traditional project metrics. | **Eliminate all EVM jargon (CPI/SPI/ACWP).** Present 5 plain-language financial cards and neutral, non-accusatory variance notices. | Private developers find EVM metrics confusing; neutral alerts prevent contractual friction while highlighting financial risks. |

---

## 3. What is Still Unverified (To Resolve in Discovery Gate)

The following items cannot be answered by secondary research alone and are explicitly assigned to the **Discovery Gate (Customer Interviews before M4)**:

1. **The Primary Paying Buyer:**
   - Does the SME Contractor buy to protect margins and prove claims to clients?
   - Or does the Developer / Property Owner buy to monitor their money and prevent contractor padding?
   - Or does the consulting QS / PM mandate it as their digital management system?
   - *Resolution:* 8–10 structured discovery interviews (contractors, developers, QSs).
2. **IPC & Retention Formula Sign-Off (R-015):**
   - Review the worked 4-certificate example in `02-kenyan-construction-workflow.md` with a practicing Kenyan QS during the first discovery interview to confirm local consensus on unfixed materials, retention caps, and certificate deductions.
   - Confirm whether the 5% retention cap floats with approved variations or stays fixed on the original contract sum (G3).
   - Confirm VAT and withholding tax application point (G2).
3. **Price Sensitivity Threshold:**
   - Whether SME contractors are willing to pay KES 3,000–5,000/month directly, or if they prefer passing the cost to the developer as a project preliminary expense.
4. **Real BOQ Spreadsheets from the Field:**
   - Need 3+ genuine Excel BOQ files from prospective pilot users to test the parser against real-world human formatting idiosyncrasies.
5. **Field Offline Sync Conflict Frequency:**
   - How often site supervisors concurrently modify records for the same site or whether diary logging is purely serial.

---

## 4. Recommended Architecture Decision Records (ADRs)

Prior to or during upcoming milestones, the following ADRs will be formally authored in `docs/adr/`:

### ADR-001: Multi-Tenancy Isolation Strategy (Milestone M2 — Must be rewritten per Review F1 & Amendments A1–A7)
- **Context:** Ensuring 100% tenant data isolation in a shared PostgreSQL database while maintaining transactional integrity across business mutations and audit logs.
- **Decision:** Mandate the explicit `withTenantTx` interactive transaction helper. Set `FORCE ROW LEVEL SECURITY` across all tenant tables. Connect runtime Fastify API as `db_app` (non-owner, non-BYPASSRLS). Use permissive policies with both `USING` and `WITH CHECK`. Enforce fail-closed casting via `NULLIF(..., '')::uuid`.
- **Verification:** Automated CI catalog checks verifying `relrowsecurity` and `relforcerowsecurity` on all tenant tables; API boot check asserting `current_user = 'db_app'`; rollback test proving atomic rollback of change + audit + idempotency key.

### ADR-002: PDF Generation Engine (Milestone M10)
- **Context:** Generating payment certificates, budget reports, and site diaries on cloud container infrastructure.
- **Decision:** Conduct empirical performance and memory benchmarking of `@react-pdf/renderer` vs. alternative engines on Railway staging containers during M10 before freezing the implementation.

### ADR-003: Excel BOQ Import Pipeline (Milestone M4)
- **Context:** Safely importing financial BOQ data without arithmetic discrepancies or silent row drops.
- **Decision:** Use `exceljs` with a 6-stage import lifecycle (Upload, Cell Extraction & Merge Normalization, Column Mapping, Validation & Anomaly Detection, Interactive Preview with Rejection Reasons, and Atomic Commit).

### ADR-004: Client-Side Offline Storage & Synchronization (Milestone M6)
- **Context:** Allowing site supervisors to log site diaries and photos under unstable 3G field conditions.
- **Decision:** PWA service worker with Workbox; Dexie.js (IndexedDB) mutation queue; client-side image compression; server-side idempotency table using `(tenant_id, idempotency_key)`.
- **Constraint:** Financial approvals, BOQ modifications, and permission updates remain strictly online-only.

### ADR-005: Money Handling, Arithmetic Precision & Rounding (Milestone M1 — R-018)
- **Context:** Preventing floating-point rounding errors and precision loss across currency amounts, unit rates, and quantities.
- **Decision:**
  - Financial amounts: PostgreSQL `numeric(15,2)`, Prisma `Decimal`, 2 decimal places.
  - Item unit rates: PostgreSQL `numeric(15,4)`, Prisma `Decimal`, up to 4 decimal places.
  - Measured quantities: PostgreSQL `numeric(12,4)`, Prisma `Decimal`, up to 4 decimal places.
  - All arithmetic performed server-side via `packages/money` using `decimal.js`.
  - Rounding rule: Round Half-Up applied at the certificate total level.

---

## 5. What I Did NOT Verify

To maintain complete audit integrity, the following aspects were not empirically verified:
1. **Railway Multi-Role Provisioning (A7):** Whether Railway's managed PostgreSQL allows creating and managing separate database users (`db_migrator` vs `db_app`) via standard connection strings without superuser restrictions. Must be verified during M0 setup.
2. **Prisma Issue #55 Live Reproduction:** The transaction rollback caveats of Prisma Client Extensions were evaluated based on the official Prisma example repository and open issue reports, rather than a local reproduction script. The `withTenantTx` pattern resolves this preemptively.
3. **Practitioner Validation of Kenyan Valuations (G5):** The 4-certificate retention walkthrough reflects standard East African contract literature, but has not yet been reviewed in person by a practicing Kenyan Quantity Surveyor.
4. **Competitor Retention / Churn / Actual User Numbers:** Competitor information is based strictly on live public marketing pages and pricing terms. Internal subscriber counts and operational retention rates remain unverified.

---

## 6. Where I Am Least Confident

1. **Kenyan SME Contractor Pricing Threshold:** While Lobocon's enterprise pricing (KES 86,500/mo) and Strukchad's per-user pricing (KES 2,000–5,000/user/mo) are verified, whether SME building contractors will willingly pay KES 3,000–5,000/month for software out of pocket—or demand that the property owner/developer pays—is the highest commercial uncertainty.
2. **Messy BOQ Spreadsheets in the Wild:** Excel sheets produced by small design practices often feature irregular column naming, handwritten notes scanned into cells, and unlinked subtotal collections. The `exceljs` parser must be heavily tested against messy field samples in Milestone M4.

---

## 7. Next Steps

- **Milestone M0 (Repo, tooling, CI, docs, staging setup) is cleared to proceed.**
- **Milestone M1 may proceed once R-018 is acknowledged in `packages/money`.**
- **Milestone M2 (Tenancy & RBAC) remains blocked until ADR-001 is formally drafted per F1 and Amendments A1–A7.**
- **Payment Certificate features remain gated until G1–G5 and R-015 are signed off by a practicing QS.**
