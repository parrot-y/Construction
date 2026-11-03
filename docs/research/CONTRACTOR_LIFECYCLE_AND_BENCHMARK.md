# Master Blueprint: Kenyan Contractor Project Lifecycle & Global/Regional SaaS Benchmark

**Document Reference:** `DOC-RES-2026-004`  
**Classification:** Product Architecture & Domain Engineering Specification  
**Author:** Chief Construction Technology Officer (CTO) & Product Architect Agent  
**Audience:** Core Engineering Team, Product Managers, Consulting Quantity Surveyors, Executive Board  
**Target Platform:** MjengoLedger (Multi-Tenant Construction Project Control SaaS)  
**Date:** November 2026  
**Status:** Approved Master Architecture Baseline  

---

## Table of Contents
1. [Executive Summary & Strategic Thesis](#1-executive-summary--strategic-thesis)
2. [Kenyan Statutory & Regulatory Framework](#2-kenyan-statutory--regulatory-framework)
   - [2.1 National Construction Authority (NCA) Act (Cap 499A)](#21-national-construction-authority-nca-act-cap-499a)
   - [2.2 BORAQS (Cap 525) & Legal Monopolies](#22-boraqs-cap-525--legal-monopolies)
   - [2.3 Standard Forms of Building Contract (JBC 1999 vs. FIDIC)](#23-standard-forms-of-building-contract-jbc-1999-vs-fidic)
   - [2.4 East African Standard Method of Measurement (EASMM 2008)](#24-east-african-standard-method-of-measurement-easmm-2008)
   - [2.5 Retention Fund Mechanics & Mathematical Formulation](#25-retention-fund-mechanics--mathematical-formulation)
3. [Global & Regional SaaS Competitive Benchmark](#3-global--regional-saas-competitive-benchmark)
   - [3.1 Comprehensive Competitor Comparison Matrix](#31-comprehensive-competitor-comparison-matrix)
   - [3.2 The Global SaaS Failure Modes on Kenyan Sites](#32-the-global-saas-failure-modes-on-kenyan-sites)
   - [3.3 The Regional / Local Competitor Bottlenecks](#33-the-regional--local-competitor-bottlenecks)
   - [3.4 MjengoLedger’s Unfair Strategic Advantage & Moat](#34-mjengoledgers-unfair-strategic-advantage--moat)
4. [The 8-Stage Contractor Project Lifecycle Architecture](#4-the-8-stage-contractor-project-lifecycle-architecture)
   - [Stage 1: Inception, Statutory Approvals & BOQ Baseline Lock](#stage-1-inception-statutory-approvals--boq-baseline-lock)
   - [Stage 2: Site Possession, Mobilization & Signage](#stage-2-site-possession-mobilization--signage)
   - [Stage 3: Substructure & Foundation (Excavation to Cube Tests)](#stage-3-substructure--foundation-excavation-to-cube-tests)
   - [Stage 4: Superstructure & MEP First-Fix (Frame, Walling & Pre-Pour Checklists)](#stage-4-superstructure--mep-first-fix-frame-walling--pre-pour-checklists)
   - [Stage 5: Finishes & Services Second-Fix (Architectural & M&E Enclosure)](#stage-5-finishes--services-second-fix-architectural--me-enclosure)
   - [Stage 6: Commercial Administration (Site Diary, Material Audit, Variations & IPCs)](#stage-6-commercial-administration-site-diary-material-audit-variations--ipcs)
   - [Stage 7: Practical Completion & Snagging (Joint Inspection & 1st Moiety Release)](#stage-7-practical-completion--snagging-joint-inspection--1st-moiety-release)
   - [Stage 8: Defects Liability Period (DLP) & Final Account Closeout](#stage-8-defects-liability-period-dlp--final-account-closeout)
5. [Prisma Data Model Specification (Extensions)](#5-prisma-data-model-specification-extensions)
   - [5.1 RFI & Technical Queries (`RFI`, `RFIResponse`)](#51-rfi--technical-queries-rfi-rfiresponse)
   - [5.2 Quality Assurance & Inspections (`InspectionChecklist`, `InspectionItem`)](#52-quality-assurance--inspections-inspectionchecklist-inspectionitem)
   - [5.3 Structural Verification (`ConcreteCubeTest`, `CubeBreakResult`)](#53-structural-verification-concretecubetest-cubebreakresult)
   - [5.4 Handover & Defects Tracking (`SnagItem`, `SnagPhoto`)](#54-handover--defects-tracking-snagitem-snagphoto)
   - [5.5 Closeout & Retention Release (`DefectsLiabilityCertificate`)](#55-closeout--retention-release-defectsliabilitycertificate)
   - [5.6 Core Schema Integration & Database Migrations](#56-core-schema-integration--database-migrations)
6. [Achieving Procore Parity at 10x Lower TCO](#6-achieving-procore-parity-at-10x-lower-tco)
   - [6.1 Offline-First Architectural Blueprint (Dexie / Service Worker PWA)](#61-offline-first-architectural-blueprint-dexie--service-worker-pwa)
   - [6.2 Safaricom Low-Bandwidth & Data Optimization (Edge / WebP / Delta Sync)](#62-safaricom-low-bandwidth--data-optimization-edge--webp--delta-sync)
   - [6.3 Pricing Model & Unit Economics Comparison](#63-pricing-model--unit-economics-comparison)
7. [Engineering Implementation Roadmap & Governance](#7-engineering-implementation-roadmap--governance)

---

## 1. Executive Summary & Strategic Thesis

The Kenyan construction sector generates over 7% of Kenya's Gross Domestic Product (GDP) and engages millions of skilled and semi-skilled workers. Yet, the vast majority of projects across the Nairobi Metropolitan Area, Mombasa, Kisumu, and secondary counties operate in a state of chronic operational opacity. Critical project data—Bills of Quantities (BOQ), site attendance, material deliveries, concrete test records, change orders, and payment certifications—is scattered across disconnected Excel workbooks, paper site books, and transient WhatsApp chat groups.

### The Problem
1. **The Cost of Disputed Valuations:** Mid-tier commercial contractors (NCA 3 to NCA 6) face severe cash-flow crunches. Consulting Quantity Surveyors (QS) and developers delay Interim Payment Certificates (IPCs) by 4 to 8 weeks due to unsubstantiated progress claims and missing physical site evidence.
2. **Material Slippage on Site:** Site foremen and storekeepers struggle with material reconciliation. An estimated 12% to 22% of bulk materials (cement, quarry stone, rebar, ballast) are lost to unrecorded wastage, over-batching, or pilferage before back-office accountants detect variances.
3. **The Software Chasm:** 
   - **Global Construction Software** (Procore, Autodesk Construction Cloud, Buildertrend, Fieldwire) is priced in USD ($5,000 to $25,000+ per year), demands reliable broadband, requires credit card billing, enforces foreign (North American/European) contract workflows (AIA contracts, US mechanics liens), and completely lacks support for East African measurement conventions (EASMM 2008) and dual-moiety retention funds.
   - **Local / Regional Tools** either target enterprise contractors with exorbitant onboarding fees (Lobocon: KES 300,000 pilot + KES 100,000/month/project), charge punitive per-seat licenses that penalize field reporting (Strukchad: KES 2,000 to 5,000/user/month), or operate with closed pricing and legacy architectures (ManPro).

### MjengoLedger's Strategic Thesis
MjengoLedger occupies the vast, unserved mid-market by delivering an **opinionated, field-first, statutory-native project operating system** built specifically for Kenyan building contractors. By pricing at **KES 7,500/project/month** (or **KES 25,000/month portfolio** with unlimited users), MjengoLedger offers **10x lower Total Cost of Ownership (TCO)** than legacy enterprise tools while delivering Procore-grade field management, offline PWA resilience, and full statutory alignment with the National Construction Authority (NCA) and Board of Registration of Architects and Quantity Surveyors (BORAQS).

```mermaid
flowchart TD
    subgraph Global_Tools["Global Enterprise (Procore / ACC)"]
        G1["Price: $8,000 - $30,000 / yr (KES 1.2M - 4.5M)"]
        G2["Heavy Web Client (Needs Broadband WiFi/4G)"]
        G3["AIA / US Lien Waiver Workflow"]
        G4["No EASMM / BORAQS / NCA Concept"]
    end

    subgraph Local_Tools["Local Tools (Lobocon / Strukchad)"]
        L1["Lobocon: KES 1.2M/yr/project (Enterprise Only)"]
        L2["Strukchad: KES 2k-5k / user / mo (Seat Tax)"]
        L3["Desktop-First / Incomplete Offline Mobile PWA"]
    end

    subgraph MjengoLedger_Moat["MjengoLedger (Our Advantage)"]
        M1["Flat KES 7,500/mo/project (Zero User Seat Tax)"]
        M2["Offline-First PWA (Works on 2G/3G Safaricom)"]
        M3["Native EASMM 2008 + JBC 1999 Retention Ledger"]
        M4["Automated NCA Compliance & Concrete Quality Registry"]
    end
```

---

## 2. Kenyan Statutory & Regulatory Framework

To build software that contractors, quantity surveyors, architects, and structural engineers trust as an authoritative system of record, MjengoLedger must encode the precise statutory instruments governing construction in Kenya.

### 2.1 National Construction Authority (NCA) Act (Cap 499A)
The National Construction Authority (NCA) was established under Act No. 41 of 2011 (now codified under Cap 499A) and the National Construction Authority Regulations 2014 to oversee the construction industry and coordinate its development.

#### A. Contractor Registration & Capacity Categories
Under Section 17 of the NCA Act, no contractor may execute building or civil engineering works without a valid annual practicing license issued by the NCA. Contractors are categorized by technical scope and financial capability:

| NCA Class | Maximum Contract Value (KES) | Target Market & Firm Profile | MjengoLedger Value Proposition |
|---|---|---|---|
| **NCA 1** | **Unlimited** | Multi-billion infrastructure, Tier-1 multinational firms (e.g., CRBC, Epco Builders, Laxmanbhai, China Wu Yi). | Secondary target; enterprise division tracking. |
| **NCA 2** | Up to **KES 500,000,000** | Large commercial towers, university campuses, major hospital blocks. | High-value target; multi-site project controls. |
| **NCA 3** | Up to **KES 300,000,000** | Mid-rise residential apartments (Kilimani, Kileleshwa), commercial warehouses (Athi River, Tilisi). | **Primary Core Buyer**; actively upgrading from Excel. |
| **NCA 4** | Up to **KES 200,000,000** | Residential estates, multi-unit townhouses (Ruaka, Kikuyu, Syokimau), light industrial parks. | **Primary Core Buyer**; margin-sensitive, high fraud risk. |
| **NCA 5** | Up to **KES 100,000,000** | Strip malls, high-end private residences (Karen, Runda, Muthaiga), institutional buildings. | **Primary Core Buyer**; desperate for daily site diary control. |
| **NCA 6** | Up to **KES 50,000,000** | Gated community villas, go-downs, school blocks, perimeter infrastructure. | **Primary Core Buyer**; requires simple mobile daily logging. |
| **NCA 7** | Up to **KES 20,000,000** | Single luxury residences, boundary walls, minor structural retrofits. | Growth tier; low digital maturity. |
| **NCA 8** | Up to **KES 10,000,000** | Small subcontracts, specialized trade finishing, earthworks. | Growth tier; field mobile app usage. |

#### B. Mandatory Project Registration (OPRS)
Under Regulation 17 of the NCA Regulations, **every construction project with a contract value exceeding KES 5,000,000 must be registered with the Authority** before breaking ground:
1. **Online Project Registration System (OPRS):** Managed via `oprs.nca.go.ke`.
2. **Statutory Document Prerequisites for Registration Certificate:**
   - Approved County Government Architectural & Structural Drawings (stamped PPA2 approval form).
   - National Environment Management Authority (NEMA) Environmental Impact Assessment (EIA) License or Certificate of Exemption.
   - Appointed Main Contractor with a valid NCA Annual Practicing License matching the project value class.
   - Appointed Registered Consulting Team: Lead Architect (BORAQS), Quantity Surveyor (BORAQS), and Structural/Civil Engineer (Engineers Board of Kenya - EBK).
   - **Signed & Stamped BOQ Grand Summary Page** confirming the contractual tender sum.
   - Supervision commitment letters and Developer's KRA PIN.
3. **The NCA Compliance Certificate & Site Signboard:**
   - Upon approval, the NCA issues an official **Project Registration Certificate** and compliance sticker with an assigned **NCA Project ID** (e.g., `NCA-PR-2026-98124`).
   - The contractor is legally mandated to erect an official **Project Signboard** at the site entrance displaying:
     * County Approval Permit Number
     * NCA Project Registration Number
     * NEMA License Number
     * Developer / Employer Name
     * Lead Architect Name & BORAQS Registration Number
     * Quantity Surveyor Name & BORAQS Registration Number
     * Structural/Civil Engineer Name & EBK Registration Number
     * Mechanical & Electrical (M&E) Engineer Name & EBK Registration Number
     * Main Contractor Name & NCA Registration Category

#### C. Accredited Site Supervisors & Skilled Artisans
Under Section 5(2)(l) of the NCA Act and the 2021 NCA Accreditation Guidelines, all site foremen/supervisors and trade artisans (masons, steel fixers, carpenters, plumbers, electricians) must undergo trade testing and hold a valid **NCA Accreditation Card** with a unique accreditation number. MjengoLedger's Labor Headcount register tracks these accreditation IDs, shielding the contractor from regulatory closure during surprise NCA compliance audits.

---

### 2.2 BORAQS (Cap 525) & Legal Monopolies

The **Architects and Quantity Surveyors Act (Cap. 525 of the Laws of Kenya)** establishes the Board of Registration of Architects and Quantity Surveyors (BORAQS) and governs professional practice:

1. **The Statutory Practice Monopoly (Section 3 & 4):**
   - It is a criminal offense punishable by fine and imprisonment for any individual or corporate entity to use the title "Quantity Surveyor", "Registered QS", "Architect", or "Chartered QS", or to practice quantity surveying or architecture for fee or reward, unless registered and currently licensed by BORAQS.
   - The preparation of statutory Bills of Quantities, contractual interim valuations, variation determinations, and final accounts for public and commercial projects is reserved exclusively for registered Quantity Surveyors.
2. **The Product Boundaries for MjengoLedger:**
   - **Never market software as an "AI Quantity Surveyor" or "Automated QS".** This violates Cap 525 and alienates the consulting QS community whose buy-in is required for certificate approval.
   - MjengoLedger is strictly architected as a **Contractor Project Operating System & Financial Control Ledger**. The software acts as an analytical calculation engine, evidence repository, and measurement assistant.
   - Features are branded neutrally:
     * *BOQ Baseline Import & Parsing* (not "BOQ Generation")
     * *Contractor Progress Claim Assessment* (not "Statutory Valuation")
     * *Interim Valuation Recommendation & Evidence Pack* (submitted to the consulting QS for formal certification)

---

### 2.3 Standard Forms of Building Contract (JBC 1999 vs. FIDIC)

In the Kenyan building sector, commercial projects operate under strictly formalized contract conditions:

```
Contract Forms in Kenya:
├── JBC 1999 Edition (With Quantities) -> Dominant for Private Commercial & Residential Buildings (85%+)
├── FIDIC Red / Yellow Book -> Dominant for Civil Infrastructure, Roads, & Donor-Financed Works (10%)
└── PPRA Standard Tender Documents (PPADA 2015) -> Mandatory for Public / Parastatal Building Contracts (5%)
```

#### A. Joint Building Council (JBC) Standard Form of Building Contract (1999 Edition with Quantities)
The JBC agreement (sanctioned by the Architectural Association of Kenya [AAK] and the Kenya Association of Building and Civil Engineering Contractors [KABCEC]) is the default legal foundation for private building construction in Kenya:
- **Architect's Role:** Acts as the Contract Administrator and Lead Consultant. All design changes and instructions must be issued as a formal **Architect’s Instruction (AI)**. Verbal instructions on site must be confirmed in writing within 7 days.
- **Quantity Surveyor's Role:** Acts as the Independent Financial Arbiter. Evaluates monthly contractor claims, inspects physical work on site, remeasures provisional quantities, determines variation rates, and issues the **Interim Valuation Recommendation**.
- **Payment Certification (Clause 34):** Architect must issue the Interim Payment Certificate within 14 calendar days of the QS valuation. The Employer (Client) must disburse funds within 14 calendar days of certificate presentation.
- **Liquidated and Ascertained Damages (Clause 27):** Fixed daily or weekly penalties assessed if the contractor fails to achieve Practical Completion within the contractual completion date (or approved Extension of Time - EOT).

#### B. FIDIC Red Book (Conditions of Contract for Construction)
Used in large industrial complexes, civil works, or foreign developer projects (e.g., World Bank, AfDB, Tatu City, Konza Technopolis):
- Administered by the **Engineer** (rather than Architect).
- Governed by formal **Engineer's Instructions (EI)** and **Sub-Clause 20.1 Contractor Claims** (strict 28-day notice window for claims, failing which contractor rights are extinguished).
- Valuation cycles operate through **Interim Payment Certificates (IPC)** with detailed Statements at Completion and Final Statements.

---

### 2.4 East African Standard Method of Measurement (EASMM 2008)

The measurement of all building works in Kenya is standardized by the **Standard Method of Measurement of Building Works and Associated Civil Works for Eastern Africa (EASMM)**, 2nd Edition (June 2008), published by the AAK Quantity Surveyors Chapter and endorsed by BORAQS and the Institute of Quantity Surveyors of Kenya (IQSK).

#### A. The 8 Standard Elemental Sections
Kenyan Bills of Quantities follow a standardized elemental hierarchy:

```
EASMM 2008 Standard BOQ Structure:
├── Section 1: Preliminaries & General Conditions (Insurances, Water, Power, Site Office, Scaffolding)
├── Section 2: Substructure (Earthworks, Hardcore, Blinding, Termite Treatment, Foundation Concrete, DPM)
├── Section 3: Superstructure (Reinforced Concrete Frame, Machine-Cut Stone Walling, Roof Structure)
├── Section 4: Finishes (Floor Screeds & Tiles, Wall Plaster & Paint, Gypsum Ceilings)
├── Section 5: Openings (Timber Doors, Steel Casement / Aluminium Windows, Glazing, Ironmongery)
├── Section 6: Mechanical & Electrical (M&E) Services (Plumbing, Foul Drainage, Electrical Conduits & Fittings)
├── Section 7: External Works (Perimeter Walls, Cabro Paving, Storm Drains, Septic Tank / Soakaway)
├── Section 8: Prime Cost (PC) & Provisional Sums (Specialist Subcontracts, Unforeseen Structural Works)
└── Grand Summary (Subtotals of Sections 1–8 + Contingencies [typically 5%] + 16% Value Added Tax [VAT])
```

#### B. EASMM Measurement Principles Encoded in MjengoLedger
1. **Net Measurement Rule:** All work is measured net as fixed in position. No allowances are added to measured quantities for cutting, offcuts, lap, or waste. Contractors must calculate waste percentages (e.g., 5% rebar cutting scrap, 8% stone breakage) within their unit rates.
2. **Standard Metric Units:**
   - Linear meters (`LM` or `m`): Trench excavations, skirting, fascia boards, conduit runs.
   - Square meters (`SM` or `m2`): Formwork, stone walling, plastering, tiling, painting, slab DPM.
   - Cubic meters (`CM` or `m3`): Bulk excavations, foundation concrete, columns, beams, suspended slabs.
   - Weight (`KG` or `TON`): High-yield rebar (BS 4449 D8, D10, D12, D16, D20, D25, D32) and structural steel sections.
   - Item / Lump Sum (`ITEM` or `SUM`): Preliminaries, testing, setting out, dewatering.
   - Number (`NO`): Precast lintels, doors, sanitary appliances, inspection chambers.

---

### 2.5 Retention Fund Mechanics & Mathematical Formulation

Under JBC 1999 Clause 34 and general Kenyan construction practice, the **Retention Fund** protects the employer against non-performance, contractor abandonment, or latent structural defects.

#### A. Contractual Standard Rules
- **Retention Deduction Rate:** Universally set at **10.0%** of the gross certified valuation of works executed and unfixed materials on site.
- **Limit of Retention Fund (The Cap):** Capped at **5.0% of the Original Contract Sum**.
- **First Moiety (50% Release):** Released upon formal issuance of the **Certificate of Practical Completion** (Stage 7).
- **Second Moiety (Final 50% Release):** Released upon formal issuance of the **Certificate of Making Good Defects** at the expiration of the Defects Liability Period (Stage 8).

#### B. The Append-Only Retention Ledger Formulation (G1 Formulation)
Traditional software models retention naively as:
$$\text{Retention} = \min(\text{Gross Valuation} \times 10\%, \text{Cap})$$
This naive equation catastrophic fails after Practical Completion because it ignores releases already paid out, leading to double deductions or under-paying the contractor.

MjengoLedger models retention as an **append-only transaction ledger**:

$$\begin{aligned}
\text{Gross Valuation to Date} &= \sum (\text{Measured Permanent Works}) + \sum (\text{Approved Variations}) + 0.80 \times (\text{Unfixed Materials on Site}) \\[6pt]
\text{Gross Retention Target to Date} &= \min\Big(\text{Gross Valuation to Date} \times \text{Retention Rate (10\%)},\; \text{Retention Cap (5\% of Contract Sum)}\Big) \\[6pt]
\mathbf{\text{Current Retention Held in Reserve}} &= \mathbf{\text{Gross Retention Target to Date} - \text{Cumulative Retention Released to Date}} \\[6pt]
\text{Net Valuation to Date} &= \text{Gross Valuation to Date} - \text{Current Retention Held in Reserve} \\[6pt]
\mathbf{\text{Current Certificate Amount Due}} &= \mathbf{\text{Net Valuation to Date} - \text{Cumulative Net Previously Certified}}
\end{aligned}$$

#### C. Comprehensive 5-Certificate Worked Example (Contract Sum: KES 10,000,000.00)
- **Original Contract Sum:** KES 10,000,000.00
- **Retention Rate:** 10.0%
- **Retention Cap (5%):** KES 500,000.00
- **Materials on Site Allowance:** 80% of invoice value

| Metric / Step | Month 1: IPC 01 | Month 2: IPC 02 | Month 3: IPC 03 (Cap Hit) | Stage 7: Practical Completion | Stage 8: Final Account / Closeout |
|---|---|---|---|---|---|
| **Cumulative Work Executed** | KES 1,800,000 | KES 4,200,000 | KES 6,800,000 | KES 9,800,000 | KES 10,250,000 (Final Remeasured) |
| **Approved Variations** | KES 0 | KES 0 | KES 200,000 | KES 200,000 | KES 250,000 (Reconciled) |
| **Unfixed Materials (80%)** | KES 200,000 | KES 300,000 | KES 0 | KES 0 | KES 0 |
| **Gross Valuation to Date** | **KES 2,000,000** | **KES 4,500,000** | **KES 7,000,000** | **KES 10,000,000** | **KES 10,500,000** |
| 10% Raw Retention | KES 200,000 | KES 450,000 | KES 700,000 | KES 1,000,000 | KES 1,050,000 |
| **Gross Retention Target** | **KES 200,000** | **KES 450,000** | **KES 500,000 (CAP)** | **KES 500,000 (CAP)** | **KES 500,000 (CAP)** |
| Cumulative Retention Released | KES 0 | KES 0 | KES 0 | **KES 250,000 (50% Moiety)** | **KES 500,000 (100% Release)** |
| **Retention Held in Reserve** | **KES 200,000** | **KES 450,000** | **KES 500,000** | **KES 250,000** | **KES 0.00** |
| **Net Valuation to Date** | **KES 1,800,000** | **KES 4,050,000** | **KES 6,500,000** | **KES 9,750,000** | **KES 10,500,000** |
| Less: Previously Certified | KES 0 | KES 1,800,000 | KES 4,050,000 | KES 6,500,000 | KES 9,750,000 |
| **Current Amount Due (Excl VAT)** | **KES 1,800,000** | **KES 2,250,000** | **KES 2,450,000** | **KES 3,250,000** | **KES 750,000** |
| Add: 16% Value Added Tax | KES 288,000 | KES 360,000 | KES 392,000 | KES 520,000 | KES 120,000 |
| **Total Recommended Payment** | **KES 2,088,000** | **KES 2,610,000** | **KES 2,842,000** | **KES 3,770,000** | **KES 870,000** |

*Note on IPC 04 at Practical Completion:* The Amount Due of KES 3,250,000 mathematically includes both the newly completed gross work (KES 3,000,000 gross) and the released KES 250,000 retention moiety in a single, balanced ledger transaction without manual ledger patching.

---

## 3. Global & Regional SaaS Competitive Benchmark

### 3.1 Comprehensive Competitor Comparison Matrix

| Evaluation Vector | Procore (USA) | Autodesk Build (USA) | Fieldwire (Hilti - USA) | Lobocon (Kenya) | Strukchad (Kenya) | ManPro (Kenya) | MjengoLedger (Our Target) |
|---|---|---|---|---|---|---|---|
| **Primary Target Buyer** | Tier 1/2 General Contractors ($20M+ revenue) | Large Engineering & Design-Build Contractors | Subcontractors & Trade Crews | Commercial Contractors (>1 live project) | Commercial & Residential Contractors | Mid-Market Contractors & PMs | **NCA 3 to NCA 6 Kenyan Main Contractors** |
| **Pricing Model** | Annual contract based on construction volume ($8k–$30k+/yr) | Tiered seat + sheet count ($1,200–$3,600/user/yr) | Per user/mo ($39–$79/user/mo) | KES 300k pilot + KES 100k/mo/project (KES 1.2M/yr) | KES 2k–5k / user / month (Punitive seat tax) | Custom enterprise quote (Opaque, HTTP 404) | **Flat KES 7,500/mo/project or KES 25,000/mo portfolio (Unlimited Users)** |
| **Billing Currency & Rails** | USD via Wire Transfer / US Credit Card | USD via Corporate Credit Card | USD via Credit Card | KES via Invoicing / Bank EFT | KES via M-Pesa, Airtel, Pesalink | KES via Bank EFT | **KES via M-Pesa Till / Paybill & Card** |
| **Offline Field PWA** | Heavy native apps (requires 2GB+ cache) | Mobile app (sheet sync often fails in low coverage) | Fast mobile app (drawings focus) | Web-only (no documented offline PWA) | Mobile web (no robust offline sync) | Mobile app (offline claim, patchy sync) | **Lightweight Offline PWA (<15MB) with Dexie IndexedDB sync** |
| **EASMM 2008 BOQ Support** | None (CSI MasterFormat / UniFormat only) | None (US MasterFormat / Work Breakdown) | None (Drawing & task plan focus) | Custom Excel import (proprietary) | Basic Excel upload (unstructured) | Excel BOQ import | **Native EASMM 8-section parser & net measurement hierarchy** |
| **Kenyan JBC Retention Ledger** | US Retainage (complex, no dual moiety) | No automated JBC retention rules | None | Present (contract admin focus) | Basic deduction (no automated moiety ledger) | Basic cost deduction | **Automated JBC 1999 dual-moiety retention ledger** |
| **NCA Statutory Compliance** | Zero awareness of Kenyan regulatory bodies | Zero awareness | Zero awareness | Manual document storage | Manual document storage | Basic safety checklist | **Built-in NCA project registration, artisan card check, site signboard generator** |
| **Concrete Cube QA Registry** | Available via custom forms | Submittals & QA checklist add-ons | General checklist | Manual QA entries | Field notes | Field photos | **Automated 7-day & 28-day break schedule with WhatsApp alerts** |

---

### 3.2 The Global SaaS Failure Modes on Kenyan Sites

1. **The Cost & Currency Barrier:**
   - Procore costs $10,000 to $30,000+ USD per year. Autodesk Build charges $1,500+ per user. An NCA 4 contractor running two projects in Ruaka and Kilimani cannot justify spending KES 2,500,000+ annually on software licenses, payable in USD via foreign credit cards or Swift transfers subject to forex fluctuations.
2. **Bandwidth & Data Bundle Consumption:**
   - Global platforms assume site foremen carry LTE/5G iPads with unlimited broadband data. On Kenyan sites in peripheral industrial zones (Athi River, Tilisi, Ruiru, Naivasha), connectivity alternates between 2G, 3G, and zero signal. Procore's mobile app downloads hundreds of megabytes of BIM models and PDF drawings, consuming expensive daily Safaricom data bundles within hours and freezing up in low-connectivity areas.
3. **Mismatched Contract Standards:**
   - Procore and Autodesk Build enforce North American construction paradigms: AIA G702/G703 payment applications, CSI MasterFormat code structures, mechanics lien waivers, and 1099 payroll formats. They have no concept of East African Standard Method of Measurement (EASMM 2008), Joint Building Council (JBC 1999) interim payment certificates, County PPA2 statutory approvals, or NCA contractor licensing categories.

---

### 3.3 The Regional / Local Competitor Bottlenecks

1. **Lobocon (Lobocon Technologies):**
   - *Strengths:* Deep commercial construction intelligence, CPM scheduling, Earned Value Management (EVM), and contract RFI workflows.
   - *Bottleneck:* Prohibitive enterprise pricing. Lobocon demands a **KES 300,000 90-day pilot fee** followed by **KES 100,000 per month per project** (KES 1,038,000/year). This locks out 95% of Kenyan contractors in NCA categories 3 through 7. Additionally, Lobocon lacks a low-footprint, offline-first mobile PWA optimized for casual site supervisors.
2. **Strukchad:**
   - *Strengths:* Field attendance, delivery notes, and M-Pesa integration.
   - *Bottleneck:* The **Per-Seat License Trap**. Strukchad charges **KES 2,000 per user/month** for Lite mobile seats (foremen, storekeepers) and **KES 5,000 per user/month** for Professional office seats. A contractor managing three sites with 3 foremen, 3 storekeepers, 2 project managers, a QS, and an accountant faces a monthly bill of over KES 30,000 to 40,000. This seat tax actively discourages contractors from onboarding their full site team, resulting in delayed data entry and fragmented reporting.
3. **ManPro (Manpro Systems):**
   - *Strengths:* Pioneering local presence, material requisitions, and mobile attendance.
   - *Bottleneck:* Opaque pricing (public pricing page returns 404), legacy desktop/native silos, dated UI/UX, and lack of an open, modern API architecture.

---

### 3.4 MjengoLedger’s Unfair Strategic Advantage & Moat

```
MjengoLedger Strategic Pillars:
├── 1. Zero Seat Tax: Flat KES 7,500/project/month with UNLIMITED USERS (onboard every foreman & storekeeper)
├── 2. Native EASMM & JBC Engine: 100% compliant with Kenyan QS practice & dual-moiety retention math
├── 3. Ultra-Light Offline PWA: Less than 15MB initial bundle, background photo sync, runs on 2G/3G Safaricom
├── 4. Statutory Compliance Built-In: Auto-populated NCA project signs, artisan accreditation checks, cube logs
└── 5. M-Pesa Native Billing: Seamless local subscription checkout without corporate credit cards
```

---

## 4. The 8-Stage Contractor Project Lifecycle Architecture

The following section maps out the technical, operational, and commercial workflow of a Kenyan construction project from inception to final retention closeout.

```mermaid
flowchart TD
    S1["Stage 1: Inception, NCA Registration & BOQ Lock"] --> S2["Stage 2: Site Possession, Mobilization & Signage"]
    S2 --> S3["Stage 3: Substructure & Foundation (Cube Testing)"]
    S3 --> S4["Stage 4: Superstructure & MEP First-Fix (Pre-Pour Gates)"]
    S4 --> S5["Stage 5: Finishes & Services Second-Fix"]
    S5 --> S6["Stage 6: Commercial Admin (Site Diary, Variations & IPCs)"]
    S6 --> S7["Stage 7: Practical Completion & Snagging (1st Moiety Release)"]
    S7 --> S8["Stage 8: Defects Liability Period & Final Account (2nd Moiety Release)"]
```

---

### Stage 1: Inception, Statutory Approvals & BOQ Baseline Lock

#### A. Statutory Context & Prerequisites
1. **Developer & Architectural Concept:** Developer engages BORAQS-registered Lead Architect; produces preliminary schemes and submits drawings to County Government for building planning approval (stamped Form PPA2).
2. **Bill of Quantities Preparation:** Appointed consulting Quantity Surveyor measures architectural and structural engineering drawings in accordance with EASMM 2008. The unpriced tender BOQ is issued to bidding contractors.
3. **Tender Award & Contract Execution:** Contractor prices the BOQ, submits tender, undergoes tender evaluation, and executes the formal contract (JBC 1999 Edition with Quantities).
4. **NCA OPRS Project Registration:** The project is registered on `oprs.nca.go.ke`. The contractor's valid NCA practicing license, consultant registration numbers, NEMA license, and signed BOQ Grand Summary are uploaded to obtain the official **NCA Project Registration Number**.

#### B. MjengoLedger Operational Architecture
- **Tenant Project Setup:** Contractor inputs Project Name, Site Location (with GPS coordinates), Client Details, NCA Registration ID, and Contract Start/End Dates.
- **Master BOQ Baseline Import:**
  - Contractor uploads the contractual Excel BOQ.
  - The MjengoLedger parser normalizes rows into the standard 8 EASMM sections, validates item codes, units (`SM`, `LM`, `CM`, `KG`, `ITEM`), quantities, and unit rates.
  - Upon verification, the BOQ is **locked as Version 1 (Baseline)**. The schema marks this version immutable with a cryptographic SHA-256 hash. Any future scope adjustments must flow through formal Variation Orders.

---

### Stage 2: Site Possession, Mobilization & Signage

#### A. Operational Workflow
1. **Joint Site Handover Meeting:** Architect, Client, QS, and Contractor PM meet on site. Site boundaries, benchmark datum levels, and physical conditions are verified. A formal **Site Possession Certificate** is executed, establishing the official contract commencement date.
2. **Project Signboard Erection:** The contractor erects the mandatory NCA signboard at the main gate. Failure to display the signboard attracts immediate stop-work enforcement notices from NCA compliance officers.
3. **Site Mobilization:**
   - Construction of temporary site hoarding (timber or corrugated iron sheets).
   - Erection of site stores, lockable container, and site meeting office.
   - Installation of temporary 3-phase electricity (KPLC application or backup diesel generator).
   - Water supply connection (Nairobi City Water & Sewerage Company - NCWSC or private water bowser storage tanks).
   - Contractor onboards site staff: Project Manager, Site Agent/Supervisor, Storekeeper, Safety Officer, and head masons.

#### B. MjengoLedger Operational Architecture
- **NCA Signboard Generator:** Generates a printable, standardized vector PDF of the official project signboard populated with the recorded NCA ID, County Permit number, NEMA license number, registered consultants, and main contractor license details.
- **Site Team Roster & Role Assignment:** The PM invites site supervisors, storekeepers, and visiting engineers with specific project-level roles and offline sync permissions.
- **Initial Mobilization Checklist:** Digital inspection checklist covering site hoarding, security guards, water storage capacity, first aid station, and PPE distribution.

---

### Stage 3: Substructure & Foundation (Excavation to Cube Tests)

#### A. Technical & Structural Mechanics
The substructure encompasses all works up to the damp-proof course (DPC) level:
1. **Setting Out:** Surveyor and site agent establish building centerlines and offset pegs from the architect's setting-out plan.
2. **Bulk & Trench Excavation:** Excavating topsoil and trench excavations in normal soil, ripping rock, or hard rock. Shoring/timbering and continuous dewatering if water table is encountered.
3. **Foundation Base & Blinding:**
   - 50mm plain concrete blinding layer (Class 15/20) poured in trenches to provide a clean, level surface for reinforcement.
   - Setting out foundation column bases and strip footings.
4. **Substructure Rebar & Formwork:**
   - Fixing high-yield steel reinforcement (BS 4449 D10/D12/D16/D20/D25) according to structural bar bending schedules (BBS). Concrete spacer blocks (50mm cover) placed beneath bars.
5. **Concrete Cube Testing Protocol (BS EN 12390 / KS 02-598):**
   - For all structural pours (column bases, ground beams, foundation footings), concrete is either site-batched (1:2:4 for Class 20/20) or supplied via ready-mix trucks (e.g., Bamburi Special Products, Blue Triangle).
   - **Slump Test:** Performed at the point of discharge (typical slump 50mm–100mm).
   - **Cube Sampling:** Standard steel molds ($150 \times 150 \times 150\text{ mm}$) sampled in sets of 3 or 6 cubes per pour.
   - **Curing:** Cubes de-molded after 24 hours and submerged in on-site water curing tanks at $20^\circ\text{C} \pm 2^\circ\text{C}$.
   - **Laboratory Crushing Tests:** Conducted at an accredited materials laboratory (e.g., Ministry of Public Works Materials Testing Dept, University of Nairobi, or certified commercial lab).
     * **7-Day Break:** Compressive strength must achieve at least **65% to 70%** of specified 28-day characteristic strength (e.g., $\ge 16.5\text{ N/mm}^2$ for Class 25 concrete).
     * **28-Day Break:** Compressive strength must achieve **100%** of specified characteristic strength (e.g., $\ge 25.0\text{ N/mm}^2$).
6. **Hardcore Bed, Termite Treatment & DPM:**
   - 300mm approved stone hardcore hand-packed and blinded with fine stone quarry dust, compacted in 150mm layers with a roller or plate compactor.
   - Anti-termite soil treatment sprayed over hardcore (e.g., *Premise 200 SC* or *Gladiator* at manufacturer's rate).
   - 1000-gauge heavy-duty polythene Damp-Proof Membrane (DPM) laid with 300mm taped laps.
   - 150mm reinforced concrete ground floor slab poured with BRC mesh A142/A193 fabric.

#### B. MjengoLedger Operational Architecture
- **Concrete Cube Quality Registry:**
  - Automated creation of cube test batches linked to specific pours (e.g., "Foundation Bases Grid A1-D4").
  - Automated push notifications and calendar alerts when 7-day and 28-day break dates arrive.
  - Field logging of lab crush results (MPa/$\text{N/mm}^2$), crushing machine calibration certificate upload, and automated Pass/Fail calculation against design strength.
- **Pre-Pour Inspection Gate:** Digital sign-off required by Site Agent and Visiting Structural Engineer before concrete casting begins.

---

### Stage 4: Superstructure & MEP First-Fix (Frame, Walling & Pre-Pour Checklists)

#### A. Technical & Structural Mechanics
1. **Reinforced Concrete Frame:**
   - Columns, suspended beams, suspended floor slabs, and reinforced concrete staircases cast in repeating cycles.
   - Formwork shuttering inspected for alignment, plumb, rigidity, and oiling. Telescopic steel props inspected for verticality and bracing.
2. **Pre-Pour Checklist Gate:**
   - Mandatory inspection protocol prior to batching:
     * Verification of rebar sizes, spacing, laps, and cover block integrity.
     * Cleanliness of forms (sawdust, tying wire offcuts blown out with air compressor).
     * Embedded MEP conduit sleeves, downpipes, and electrical conduits cast into slab.
     * Formal digital signature from the Consulting Structural Engineer.
3. **Masonry Walling (Infill):**
   - Machine-cut quarry stone walling (9"x9" external loadbearing walls, 6"x9" internal partitions) sourced from Thika, Juja, or Ndula quarries.
   - Mortar mixed at 1:3 or 1:4 cement-to-sand ratio.
   - Heavy-duty hoop iron reinforcement strips ($25\text{ mm} \times 18\text{ gauge}$) bedded into mortar joints every second course.
   - Damp-Proof Course (DPC - bituminous felt Type 1B) laid on plinth walling.
4. **MEP First-Fix Services:**
   - **Electrical:** Wall chasing for PVC conduits, switch boxes, socket boxes, distribution board trunking.
   - **Plumbing & Drainage:** Wall chasing for PPR potable water pipework; installation of PVC soil and waste stacks (110mm soil stack, 40mm/50mm waste branches) with solvent cement joints, passing through cast floor sleeves.

#### B. MjengoLedger Operational Architecture
- **Pre-Pour Inspection Module:** Mobile form capturing photos of steel reinforcement, cover blocks, and MEP conduit conduits prior to pour authorization.
- **Physical Progress Tracking:** Measured completion of columns, slabs, and stone walling logged in square/cubic meters and mapped directly against corresponding BOQ line items.

---

### Stage 5: Finishes & Services Second-Fix (Architectural & M&E Enclosure)

#### A. Technical & Finishing Mechanics
1. **Wall Plastering & Rendering:**
   - Internal wall plastering: 15mm cement-sand (1:4) render finished with lime putty or skim coat smooth finish ready for paint.
   - External wall rendering: Roughcast or Tyrolene weather-proof render.
2. **Floor Finishes & Screeds:**
   - 32mm–50mm cement-sand screed (1:3).
   - Waterproofing application in wet areas (showers, bathrooms, balconies) using cementitious waterproofing slurry (e.g., SikaTop Seal 107) with upturns of 300mm on walls. Flood testing conducted for 24 hours.
   - Supply and laying of vitrified or porcelain floor tiles, ceramic wall tiles, grouted with anti-fungal epoxy grout.
3. **Ceiling Systems:**
   - Metal studs/furring channels suspended from soffit; 9mm or 12mm gypsum boards fixed with drywall screws, taped, jointed, and skimmed.
4. **MEP Second-Fix:**
   - **Electrical:** Wire pulling (1.5mm² for lighting, 2.5mm² for power ring circuits, 4.0mm² for water heaters, 6.0mm² for cooker units), installation of switches, sockets, consumer units, circuit breakers, and lighting fixtures.
   - **Plumbing:** Installation of vitreous china sanitary fixtures (water closets, wash hand basins, kitchen sinks, shower mixers). Hydrostatic pressure testing of PPR piping at 10 bar for 2 hours to confirm zero leakages before closing service shafts.
5. **Joinery, Windows & External Works:**
   - Solid core timber flush doors, heavy-duty steel external doors, aluminum powder-coated sliding windows, 6mm clear sheet glazing, architectural ironmongery (union 3-lever mortice locks, brass handles).
   - External cabro block paving ($60\text{ mm}$ or $80\text{ mm}$ heavy-duty paving blocks on sand bed), perimeter boundary walls, razor wire, and automated gate installation.

#### B. MjengoLedger Operational Architecture
- **Trade-Specific Quality Checklists:** Pre-configured inspection checklists for Tile Alignment, Waterproofing Flood Tests, Plumbing Pressure Tests, and Insulation Resistance (Megger) Tests.
- **Defect Tagging (Internal Contractor Snagging):** Site supervisor identifies and tags finishing flaws on mobile before presenting the project to the client’s consultants.

---

### Stage 6: Commercial Administration (Site Diary, Material Audit, Variations & IPCs)

Stage 6 runs continuously throughout the project and constitutes the primary commercial engine of MjengoLedger:

```mermaid
sequenceDiagram
    autonumber
    participant Site as Site Supervisor / Storekeeper
    participant ML as MjengoLedger Platform
    participant PM as Contractor PM / QS
    participant Lead as Consulting QS / Architect
    participant Client as Employer / Developer

    Site->>ML: Log Daily Site Diary, Labor Headcount & Material Deliveries
    Site->>ML: Attach Geotagged Delivery Note & Site Photos
    PM->>ML: Compile Monthly Valuation Claim & Verify Completed Quantities
    PM->>ML: Submit Variation Order with Architect's Instruction (AI)
    ML->>ML: Apply EASMM Math & Retention Ledger Formulation (G1)
    PM->>Lead: Export Professional Interim Payment Claim Pack (PDF)
    Lead->>ML: Joint Site Measurement & Certificate Approval
    Lead->>Client: Issue Interim Payment Certificate (IPC)
    Client->>ML: Confirm Disbursement & Record Bank/M-Pesa Reference
```

#### A. Daily Site Diary & Field Evidence
- **Weather Impact Logging:** Records sunshine, light showers, or torrential rain causing stoppage of work (crucial for defending future Extension of Time claims under JBC Clause 26).
- **Daily Labor Headcount Register:** Itemized headcounts by trade (Masons, Steel Fixers, Carpenters, Plumbers, Electricians, Casual Laborers).
- **Material Delivery Reconciliation:** Captures delivery note number, supplier name, vehicle registration number, and photographic evidence of delivery receipts for bulk supplies (Bamburi Cement, Devki Steel, Ndula Stone, Sand, Ballast).

#### B. Architect's Instructions & Variation Orders
- Under JBC 1999 Clause 13, no variation is recognized without a formal **Architect’s Instruction (AI)**.
- MjengoLedger pairs every contractor variation submission with:
  1. The AI reference document/photo.
  2. The specific BOQ items being omitted or added.
  3. Pro-rata rate justification derived from baseline BOQ unit rates.
  4. Cost impact on the contract sum and schedule impact (requested extension of time in days).

#### C. Monthly Interim Payment Certificate (IPC) Formulation
- MjengoLedger executes the exact mathematical formulation specified in Section 2.5:
  1. Cumulative measurement of permanent works executed to date.
  2. Approved variations to date.
  3. Value of eligible unfixed materials on site (certified at 80% of verified delivery value).
  4. Calculation of gross retention target capped at 5% of original contract sum.
  5. Deduction of cumulative retention held (incorporating prior releases).
  6. Deduction of cumulative net previously certified.
  7. Addition of 16% VAT.

---

### Stage 7: Practical Completion & Snagging (Joint Inspection & 1st Moiety Release)

#### A. The Legal & Operational Threshold
- Practical Completion (PC) is achieved when the works have been substantially completed, are structurally sound, and are safe and fit for human occupation, leaving only minor defects (snags) that do not interfere with the beneficial use of the building.
- **The Joint Handover Inspection:** Architect, Consulting QS, Structural Engineer, Services Engineer, Contractor PM, and Developer walk every square meter of the project.
- **Issuance of Certificate of Practical Completion:**
  1. The Architect issues the formal Certificate under JBC Clause 33.
  2. The site is legally handed back to the Developer.
  3. Contractor's liability for insurance and security ceases (transfers to Developer).
  4. Clock for Liquidated Damages stops permanently.
  5. **Defects Liability Period (DLP) begins** (standard 6 calendar months).
  6. **Release of First Moiety (50%) of Retention Fund:** Architect and QS certify the release of 50% of the accumulated retention fund to the contractor.

#### B. MjengoLedger Snagging Architecture
- **Digital Punch List / Snagging Engine:**
  - Fast mobile capture of defects (e.g., "Cracked tile in Master Ensuite", "Missing lock escutcheon on Bedroom 2 door", "Plaster hairline crack on external north elevation").
  - Geotagged, high-resolution before-photos with markup/drawing overlays.
  - Precise spatial assignment: Building Block $\rightarrow$ Floor Level $\rightarrow$ Room / Grid Line $\rightarrow$ Trade Responsible (e.g., Tiler, Painter).
  - Status progression: `OPEN` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `CONTRACTOR_RECTIFIED` $\rightarrow$ `CONSULTANT_VERIFIED_CLOSED`.

---

### Stage 8: Defects Liability Period (DLP) & Final Account Closeout

#### A. Operational & Financial Reconciliation
1. **The 6-Month DLP Rectification Window:**
   - Contractor maintains a skeletal maintenance crew to rectify all snags identified during the joint handover inspection or latent defects emerging during initial building occupation (e.g., plumbing leaks under pressure, roof leakages during the first rainy season).
2. **The Final Account Settlement (JBC Clause 34):**
   - The consulting QS and contractor QS reconcile the master contract:
     * Adjustment of Preliminaries (time-related vs. fixed lump sums).
     * Final remeasurement of provisional quantities (foundations, earthworks, external sewer connections).
     * Valuation of all approved variations (additions and omissions).
     * Reconciliation of Prime Cost (PC) sums and expenditure of Contingency allowances.
     * Execution of the agreed **Final Account Agreement Document**.
3. **Issuance of Certificate of Making Good Defects:**
   - At the expiration of the DLP, the Architect conducts a final re-inspection. Upon verifying that all snags have been rectified, the Architect issues the **Certificate of Making Good Defects**.
4. **Final Payment Certificate & Second Moiety Release:**
   - The Architect issues the Final Certificate releasing the remaining **50% of the retention fund** along with any outstanding final account balances.
   - Project status transitions to `CLOSED` in MjengoLedger, locking all operational ledgers into read-only archive status.

---

## 5. Prisma Data Model Specification (Extensions)

The following production-grade Prisma schema extensions integrate seamlessly with MjengoLedger's existing `packages/db/prisma/schema.prisma`. They introduce strict multi-tenant isolation, standard UUID primary keys, exact decimal precisions, and complete relational integrity.

```prisma
// =============================================================
// DOMAIN EXTENSION 1: TECHNICAL QUERIES & RFIs
// =============================================================

enum RfiStatus {
  DRAFT
  SUBMITTED
  UNDER_REVIEW
  ANSWERED
  REJECTED
  CLOSED
}

enum RfiPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL // Schedule/Structural stoppage
}

model RFI {
  id                  String       @id @default(uuid()) @db.Uuid
  tenant_id           String       @db.Uuid
  project_id          String       @db.Uuid
  rfi_number          Int          // Sequential per project: 1, 2, 3...
  title               String       @db.VarChar(255)
  question            String       @db.Text
  suggested_solution  String?      @db.Text
  drawing_reference   String?      @db.VarChar(100) // e.g. "STR-04 Rev C"
  specification_clause String?     @db.VarChar(100) // e.g. "EASMM Sec 3.4"
  priority            RfiPriority  @default(MEDIUM)
  status              RfiStatus    @default(SUBMITTED)
  cost_impact         Boolean      @default(false)
  schedule_impact_days Int         @default(0)
  assigned_to_role    String       @db.VarChar(50)  // "ARCHITECT", "STRUCTURAL_ENG", "SERVICES_ENG", "QS"
  created_by_id       String       @db.Uuid
  due_date            DateTime?    @db.Date
  closed_at           DateTime?    @db.Timestamptz
  created_at          DateTime     @default(now()) @db.Timestamptz
  updated_at          DateTime     @updatedAt @db.Timestamptz

  project             Project      @relation(fields: [project_id], references: [id], onDelete: Cascade)
  created_by          User         @relation("RfiAuthor", fields: [created_by_id], references: [id])
  responses           RFIResponse[]
  attachments         RFIAttachment[]

  @@unique([project_id, rfi_number])
  @@index([tenant_id, project_id, status])
  @@map("rfis")
}

model RFIResponse {
  id              String       @id @default(uuid()) @db.Uuid
  tenant_id       String       @db.Uuid
  rfi_id          String       @db.Uuid
  responder_id    String       @db.Uuid
  official_answer String       @db.Text
  is_accepted     Boolean      @default(true)
  created_at      DateTime     @default(now()) @db.Timestamptz

  rfi             RFI          @relation(fields: [rfi_id], references: [id], onDelete: Cascade)
  responder       User         @relation(fields: [responder_id], references: [id])

  @@index([tenant_id, rfi_id])
  @@map("rfi_responses")
}

model RFIAttachment {
  id          String       @id @default(uuid()) @db.Uuid
  tenant_id   String       @db.Uuid
  rfi_id      String       @db.Uuid
  storage_key String       @db.VarChar(500)
  filename    String       @db.VarChar(255)
  file_size   Int
  mime_type   String       @db.VarChar(100)
  created_at  DateTime     @default(now()) @db.Timestamptz

  rfi         RFI          @relation(fields: [rfi_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, rfi_id])
  @@map("rfi_attachments")
}

// =============================================================
// DOMAIN EXTENSION 2: QUALITY ASSURANCE & INSPECTION CHECKLISTS
// =============================================================

enum ChecklistType {
  PRE_POUR_CONCRETE
  SUBSTRUCTURE_EXCAVATION
  REBAR_VERIFICATION
  SCAFFOLDING_SAFETY
  WATERPROOFING_FLOOD_TEST
  MEP_PRESSURE_TEST
  PRE_PLASTER_WALLING
  PRE_HANDOVER_INSPECTION
}

enum InspectionStatus {
  PENDING
  IN_PROGRESS
  APPROVED_WITHOUT_COMMENTS
  APPROVED_WITH_CONDITIONS
  REJECTED
}

model InspectionChecklist {
  id              String            @id @default(uuid()) @db.Uuid
  tenant_id       String            @db.Uuid
  project_id      String            @db.Uuid
  checklist_type  ChecklistType
  title           String            @db.VarChar(255)
  location        String            @db.VarChar(255) // e.g. "Block B, 2nd Floor Slab"
  status          InspectionStatus  @default(PENDING)
  scheduled_date  DateTime          @db.Date
  inspected_at    DateTime?         @db.Timestamptz
  inspector_name  String?           @db.VarChar(255) // Consulting Engineer / Architect
  inspector_role  String?           @db.VarChar(100)
  signed_off_by_id String?          @db.Uuid
  summary_notes   String?           @db.Text
  created_at      DateTime          @default(now()) @db.Timestamptz
  updated_at      DateTime          @updatedAt @db.Timestamptz

  project         Project           @relation(fields: [project_id], references: [id], onDelete: Cascade)
  items           InspectionItem[]

  @@index([tenant_id, project_id, checklist_type])
  @@map("inspection_checklists")
}

model InspectionItem {
  id                   String              @id @default(uuid()) @db.Uuid
  tenant_id            String              @db.Uuid
  checklist_id         String              @db.Uuid
  order_idx            Int
  check_point          String              @db.VarChar(255) // e.g. "Reinforcement cover blocks minimum 25mm"
  is_mandatory         Boolean             @default(true)
  result               String              @default("PENDING") @db.VarChar(20) // "PASS", "FAIL", "N/A", "PENDING"
  deficiency_notes     String?             @db.Text
  photo_storage_key    String?             @db.VarChar(500)

  checklist            InspectionChecklist @relation(fields: [checklist_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, checklist_id])
  @@map("inspection_items")
}

// =============================================================
// DOMAIN EXTENSION 3: CONCRETE QUALITY & CUBE TEST REGISTRY
// =============================================================

enum ConcreteClass {
  CLASS_15_20 // Blinding
  CLASS_20_20 // Standard Structural (1:2:4)
  CLASS_25_20 // High-Strength Columns / Slabs
  CLASS_30_20 // Precast / Water-Retaining
  CLASS_35_20 // Specialized High-Load
}

model ConcreteCubeTest {
  id                    String            @id @default(uuid()) @db.Uuid
  tenant_id             String            @db.Uuid
  project_id            String            @db.Uuid
  batch_reference       String            @db.VarChar(100) // e.g. "POUR-2026-11-04-SLAB3"
  pour_location         String            @db.VarChar(255) // e.g. "Third Floor Slab & Beams Axis 1-6"
  pour_date             DateTime          @db.Date
  concrete_class        ConcreteClass     @default(CLASS_25_20)
  target_strength_mpa   Decimal           @db.Decimal(5, 2) // e.g. 25.00 MPa
  slump_tested_mm       Int?              // Measured slump in mm (e.g. 75mm)
  supplier_name         String?           @db.VarChar(255) // "Site Batch" or Ready-Mix Vendor
  delivery_docket_no    String?           @db.VarChar(100)
  curing_tank_id        String?           @db.VarChar(50)
  notes                 String?           @db.Text
  created_at            DateTime          @default(now()) @db.Timestamptz

  project               Project           @relation(fields: [project_id], references: [id], onDelete: Cascade)
  break_results         CubeBreakResult[]

  @@index([tenant_id, project_id, pour_date])
  @@map("concrete_cube_tests")
}

model CubeBreakResult {
  id                   String           @id @default(uuid()) @db.Uuid
  tenant_id            String           @db.Uuid
  cube_test_id         String           @db.Uuid
  cube_number          Int              // 1 to 6
  break_age_days       Int              // 7 or 28 (or 14)
  scheduled_break_date DateTime         @db.Date
  actual_break_date    DateTime?        @db.Date
  crushing_load_kn     Decimal?         @db.Decimal(8, 2) // Measured force in kN
  compressive_mpa      Decimal?         @db.Decimal(6, 2) // Load / (150mm * 150mm) = N/mm2 (MPa)
  is_pass              Boolean?
  lab_name             String?          @db.VarChar(255) // "Ministry of Works" or commercial lab
  certificate_key      String?          @db.VarChar(500) // S3 PDF storage key
  tested_by            String?          @db.VarChar(255)

  cube_test            ConcreteCubeTest @relation(fields: [cube_test_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, cube_test_id, scheduled_break_date])
  @@map("cube_break_results")
}

// =============================================================
// DOMAIN EXTENSION 4: HANDOVER & SNAGGING (PUNCH LIST)
// =============================================================

enum SnagSeverity {
  COSMETIC
  FUNCTIONAL
  CRITICAL_SAFETY
}

enum SnagStatus {
  OPEN
  IN_PROGRESS
  RECTIFIED_BY_CONTRACTOR
  VERIFIED_CLOSED
  CONTESTED
}

model SnagItem {
  id                  String       @id @default(uuid()) @db.Uuid
  tenant_id           String       @db.Uuid
  project_id          String       @db.Uuid
  snag_number         Int          // Sequential per project
  location_block      String?      @db.VarChar(100) // e.g. "Block A"
  location_floor      String       @db.VarChar(100) // e.g. "2nd Floor"
  location_room       String       @db.VarChar(100) // e.g. "Apartment A3 - Master Bath"
  trade_category      String       @db.VarChar(100) // "Tiling", "Painting", "Plumbing", "Electrical", "Joinery"
  description         String       @db.Text
  severity            SnagSeverity @default(COSMETIC)
  status              SnagStatus   @default(OPEN)
  assigned_trade_firm String?      @db.VarChar(255) // Subcontractor or internal crew
  due_date            DateTime?    @db.Date
  identified_by_name  String       @db.VarChar(255) // Architect / Client / QS / PM
  identified_at       DateTime     @default(now()) @db.Timestamptz
  rectified_at        DateTime?    @db.Timestamptz
  verified_at         DateTime?    @db.Timestamptz
  verified_by_name    String?      @db.VarChar(255)

  project             Project      @relation(fields: [project_id], references: [id], onDelete: Cascade)
  photos              SnagPhoto[]

  @@unique([project_id, snag_number])
  @@index([tenant_id, project_id, status])
  @@map("snag_items")
}

model SnagPhoto {
  id             String     @id @default(uuid()) @db.Uuid
  tenant_id      String     @db.Uuid
  snag_item_id   String     @db.Uuid
  photo_type     String     @db.VarChar(20) // "DEFECT" (before) or "RECTIFIED" (after)
  storage_key    String     @db.VarChar(500)
  caption        String?    @db.VarChar(255)
  gps_latitude   Decimal?   @db.Decimal(9, 6)
  gps_longitude  Decimal?   @db.Decimal(9, 6)
  captured_at    DateTime   @default(now()) @db.Timestamptz

  snag_item      SnagItem   @relation(fields: [snag_item_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, snag_item_id])
  @@map("snag_photos")
}

// =============================================================
// DOMAIN EXTENSION 5: DEFECTS LIABILITY & FINAL RETENTION CLOSEOUT
// =============================================================

enum CertificateType {
  PRACTICAL_COMPLETION
  MAKING_GOOD_DEFECTS
  FINAL_PAYMENT_CERTIFICATE
}

model DefectsLiabilityCertificate {
  id                      String          @id @default(uuid()) @db.Uuid
  tenant_id               String          @db.Uuid
  project_id              String          @db.Uuid
  certificate_type        CertificateType
  certificate_reference   String          @db.VarChar(100) // e.g. "CERT-PC-2026-001"
  issue_date              DateTime        @db.Date
  effective_date          DateTime        @db.Date
  dlp_duration_months     Int             @default(6) // Typically 6 months under JBC 1999
  dlp_expiry_date         DateTime?       @db.Date
  retention_amount_released Decimal       @db.Decimal(15, 2) // 50% moiety or final 50%
  architect_name          String          @db.VarChar(255)
  architect_boraqs_no     String?         @db.VarChar(50)
  qs_name                 String          @db.VarChar(255)
  qs_boraqs_no            String?         @db.VarChar(50)
  signed_certificate_key  String?         @db.VarChar(500) // S3 storage key of signed document
  notes                   String?         @db.Text
  created_at              DateTime        @default(now()) @db.Timestamptz

  project                 Project         @relation(fields: [project_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, project_id, certificate_type])
  @@map("defects_liability_certificates")
}
```

---

## 6. Achieving Procore Parity at 10x Lower TCO

### 6.1 Offline-First Architectural Blueprint (Dexie / Service Worker PWA)

To make MjengoLedger work reliably on remote Kenyan building sites where Safaricom 4G signal is intermittent or degraded, the architecture separates local UI interactions from background network synchronizations:

```mermaid
flowchart TD
    subgraph Mobile_PWA_Client["Mobile PWA (Foreman / Storekeeper Phone)"]
        UI["React 19 / Vite UI"]
        Dexie["Dexie.js (Client-Side IndexedDB)"]
        SW["Service Worker Cache & Background Sync Engine"]
        Queue["Local Mutation Queue (Outbox)"]
    end

    subgraph Network_Transport["Network Layer (Low-Bandwidth 2G/3G)"]
        Net{"Safaricom Connection Active?"}
        SyncPayload["Compressed Delta JSON + WebP Photos"]
    end

    subgraph Fastify_Backend["MjengoLedger Server (Railway / Docker)"]
        API["Fastify 5 REST API + Idempotency Middleware"]
        Postgres[("PostgreSQL 16 Multi-Tenant DB")]
        S3[("Wasabi / AWS S3 S3-Compatible Object Store")]
    end

    UI -->|Read/Write Instantaneous| Dexie
    Dexie --> Queue
    Queue --> SW
    SW --> Net
    Net -->|Yes| SyncPayload
    Net -->|No (Offline)| Dexie
    SyncPayload -->|HTTP POST with Idempotency Key| API
    API -->|withTenantTx Transaction| Postgres
    API -->|Direct Presigned Stream| S3
```

#### Key Technical Enablers:
1. **Zero Latency Field Logging:** Foremen create site diary logs, record daily headcount, and log material trucks in IndexedDB in less than 50 milliseconds. The UI never blocks on network connectivity.
2. **Idempotent Mutation Queue:** Every mutation created offline is tagged with a UUIDv4 idempotency key. When the phone reconnects to Safaricom data, the Service Worker drains the queue sequentially. The backend `idempotency_keys` table guarantees that duplicated or retransmitted requests are processed exactly once.
3. **Optimistic UI Reconciliation:** Conflict resolution follows the **Last-Write-Wins (LWW) with Server Authoritative Timestamps** strategy for operational logs, while financial and contract baseline changes (variations, valuations) require explicit server validation.

---

### 6.2 Safaricom Low-Bandwidth & Data Optimization (Edge / WebP / Delta Sync)

Mobile data bundles in Kenya (e.g., Safaricom Tunukiwa bundles) are bought in small daily buckets (e.g., 250MB to 1GB). Field software that wastes data is quickly uninstalled or abandoned by foremen. MjengoLedger enforces extreme data frugality:

1. **Client-Side Image Transcoding:**
   - High-resolution smartphone cameras take 12MP to 48MP photos (5MB to 15MB each).
   - Before uploading, MjengoLedger's client-side canvas engine downsizes photos to a maximum dimension of 1920px (Full HD) and transcodes them into **lossy WebP at 78% quality**.
   - Result: File size drops from **8.5MB to ~320KB** (a **96% reduction in bandwidth consumption**) without losing visual clarity for crack inspection or delivery note reading.
2. **Presigned Direct Object Storage Uploads:**
   - Photos upload directly from the mobile browser to S3-compatible storage (e.g., Cloudflare R2 or Wasabi) via short-lived presigned URLs, bypassing application servers and reducing API server bandwidth to zero.
3. **Brotli-Compressed Delta Payloads:**
   - Sync queries transfer only mutated row deltas using timestamp filters (`updated_at > :last_sync_timestamp`), with responses compressed using Brotli (`br`).

---

### 6.3 Pricing Model & Unit Economics Comparison

The financial breakdown below proves how MjengoLedger provides equivalent or superior field operational utility compared to Procore, while remaining 10x to 25x more accessible to Kenyan contractors:

#### Financial Scenario: Mid-Sized Contractor (NCA 4)
- **Active Projects:** 2 commercial/residential sites in Nairobi Metropolitan Area.
- **Project Team per Site:** 1 Project Manager, 1 Site Agent/Supervisor, 1 Storekeeper, 1 Consultant QS (Collaborator), 1 Developer Representative (Collaborator).
- **Total Software Users:** 10 active stakeholders.

| Cost Element | Procore Global Enterprise | Lobocon Enterprise (Local) | Strukchad Per-Seat (Local) | MjengoLedger Flat Plan |
|---|---|---|---|---|
| **Annual Base License Fee** | $12,000 USD (KES 1,560,000) | KES 1,038,000 / project $\times$ 2 = **KES 2,076,000** | KES 0 base | **KES 25,000 / month Portfolio Plan** |
| **User Seat Surcharges** | Included (unlimited) | Included | 4 Pro seats @ KES 5k + 6 Lite @ KES 2k = **KES 32,000 / month** | **KES 0 (Unlimited users included)** |
| **Mandatory Onboarding / Pilot** | $2,500 USD (KES 325,000) | **KES 300,000 pilot fee** | KES 0 | **KES 0 (Self-serve or free onboarding)** |
| **Total Year 1 Expenditure (Excl. VAT)** | **KES 1,885,000** | **KES 2,376,000** | **KES 384,000** | **KES 300,000** |
| **Monthly Equivalent Cash Outflow** | **~KES 157,000 / month** | **~KES 198,000 / month** | **KES 32,000 / month** | **KES 25,000 / month** |
| **Payment Terms** | Annual upfront USD credit card | Annual advance / Bank EFT | Monthly M-Pesa / Pesalink | **Monthly M-Pesa Till / Paybill** |
| **Cost Savings vs. Procore** | Baseline | -26% (More expensive!) | **80% Cheaper** | **84% Cheaper (10x lower TCO)** |

---

## 7. Engineering Implementation Roadmap & Governance

To implement this master lifecycle architecture systematically within MjengoLedger's existing codebase, engineering execution is structured into 4 sequential technical phases:

```
Engineering Roadmap Phasing:
├── Phase A (Milestone M4): BOQ Baseline Parser & EASMM Net Measurement Engine
├── Phase B (Milestone M5-M6): Offline-First Field PWA, Site Diary & Concrete Cube Registry
├── Phase C (Milestone M7-M8): JBC 1999 Interim Payment Certificate (IPC) & Retention Ledger Engine
└── Phase D (Milestone M9-M10): Snagging Engine, Practical Completion & Defects Liability Closeout
```

### Phase A: BOQ Engine & Baseline Integrity (M4)
- Deploy the EASMM 2008 Excel importer with 8-section normalization.
- Enforce cryptographic immutability (SHA-256) on active baseline BOQ versions.
- Connect BOQ line items to the measured physical progress tracking schema.

### Phase B: Field PWA & Quality Control (M5 - M6)
- Roll out Dexie.js IndexedDB schema in `@apps/web` with background sync service worker.
- Author Prisma migrations for `RFI`, `InspectionChecklist`, and `ConcreteCubeTest`.
- Implement client-side WebP image downscaling (1920px max, 78% quality) and direct presigned S3 uploads.
- Build automated 7-day and 28-day concrete cube crush notification alerts.

### Phase C: Commercial Valuation & Retention Ledger (M7 - M8)
- Implement the append-only retention ledger formulation (G1) in `@packages/money`.
- Build the 5-certificate calculation engine with 10% deduction, 5% contract cap, and 16% VAT handling.
- Automate professional PDF generation for Interim Payment Claims and Variation Orders formatted to JBC 1999 standard.

### Phase D: Handover, Snagging & Final Account (M9 - M10)
- Author Prisma migrations for `SnagItem`, `SnagPhoto`, and `DefectsLiabilityCertificate`.
- Build the mobile visual snagging UI with spatial tagging (Block $\rightarrow$ Floor $\rightarrow$ Room) and before/after photos.
- Implement the 50% first-moiety release workflow at Practical Completion and the second-moiety release workflow at Certificate of Making Good Defects.

---

## 8. Summary Conclusion

By uniting the statutory discipline of the **National Construction Authority (NCA Act Cap 499A)**, the professional precision of **BORAQS (Cap 525)**, the contractual mechanics of **JBC 1999 Edition with Quantities**, and the elemental rigor of **EASMM 2008**, MjengoLedger establishes an unassailable product moat. 

By delivering this functionality through a lightweight, offline-resilient mobile PWA priced at a transparent **KES 7,500/project/month** with zero user seat penalties, MjengoLedger delivers **Procore-level field and financial parity at 10x lower Total Cost of Ownership**, uniquely positioning it to become the definitive operating system for construction across East Africa.