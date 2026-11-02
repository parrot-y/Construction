# Research Report 03: Kenyan Regulation & Statutory Compliance

**Access Date:** 2026-10-27  
**Scope:** National Construction Authority (NCA) project and contractor registration, BORAQS (Cap 525) legal monopoly on BOQs, Kenya Data Protection Act 2019 compliance obligations, and Kenya Revenue Authority (KRA) eTIMS electronic tax invoicing requirements.

---

## 1. National Construction Authority (NCA) Framework

The construction industry in Kenya is regulated under the **National Construction Authority Act (No. 41 of 2011)** and the **National Construction Authority Regulations (2014)** [Tag: `UNVERIFIED — STATUTORY LEGISLATION`].

### 1.1 Contractor Classification & Licensing
All construction firms operating in Kenya must be registered and licensed by the NCA annually across defined categories (Building Works, Civil Works, Electrical, Mechanical, Water) and financial capacity limits [Tag: `UNVERIFIED — NCA REGULATIONS`]:
- **NCA 1:** Unlimited contract value.
- **NCA 2:** Up to KES 500,000,000.
- **NCA 3:** Up to KES 300,000,000.
- **NCA 4:** Up to KES 200,000,000.
- **NCA 5:** Up to KES 100,000,000.
- **NCA 6:** Up to KES 50,000,000.
- **NCA 7:** Up to KES 20,000,000.
- **NCA 8:** Up to KES 10,000,000.

### 1.2 Mandatory Project Registration
- **Statutory Threshold:** Under the NCA Regulations, **all construction projects whose contract value exceeds KES 5,000,000** must be registered with the NCA before physical site works commence.
- **Online Projects Registration System (OPRS):** Managed via the official portal at `oprs.nca.go.ke` [Tag: `UNVERIFIED — REGULATOR PORTAL`].
- **Mandatory Registration Documents:**
  1. Approved architectural and structural drawings with County Government stamps (e.g., PPA2 form).
  2. NEMA Environmental Impact Assessment license (where required).
  3. Appointed registered main contractor holding a valid annual NCA license.
  4. Appointed registered consultants:
     - Lead Architect (licensed by BORAQS).
     - Quantity Surveyor (licensed by BORAQS).
     - Structural/Civil Engineer (licensed by EBK).
  5. **Signed and stamped BOQ Grand Summary page** prepared by the registered Quantity Surveyor.
  6. Signed Contractor & Consultant commitment forms, supervision commitment letters, and Developer KRA PIN.
- **SaaS Implications:** The software can capture and display the project's official NCA Project Registration ID, contractor license tier, and compliance checklist as trust indicators for developers and financiers.

---

## 2. BORAQS / Cap 525 Scope (Who May Prepare BOQs)

The practice of Quantity Surveying and Architecture is governed by the **Architects and Quantity Surveyors Act (Cap. 525 of the Laws of Kenya)** and its subsidiary by-laws [Tag: `UNVERIFIED — STATUTORY ACT OF PARLIAMENT`].

### 2.1 Statutory Restrictions Under Cap 525
1. **Title & Practice Monopoly (Section 3):** Under Section 3 of Cap. 525, it is an offense for any person to adopt the title or style of "Quantity Surveyor" or "Registered QS", or to practice as such for fee or reward, unless they are formally registered and hold a valid practicing certificate issued by the **Board of Registration of Architects and Quantity Surveyors (BORAQS)** [Tag: `UNVERIFIED — LAWS OF KENYA`].
2. **Professional Scope:** The professional preparation of Bills of Quantities, tender measurement, contractual valuations, variation determinations, and final accounts for fee-earning construction contracts is legally reserved for registered professionals.
3. **Prohibition on Unregistered Certification:** By-laws prohibit registered quantity surveyors from signing or stamping BOQs or valuation certificates produced by unregistered entities without direct professional supervision.

### 2.2 Operational Boundary for Software
- **Software is a tool, not a professional body:** The SaaS platform provides calculation, data entry, budget tracking, and variance detection software for the project team. It does **not** prepare, certify, or sign BOQs in a professional legal capacity.
- **Strict Naming & Marketing Rule:** Never market features using terms like "AI Quantity Surveyor" or "Automated QS". Under Kenyan law, this violates Cap. 525. All documentation and user interfaces must use neutral terms: "Project Budget", "Cost Control", "BOQ Import", and "Progress vs. Spend Tracking".

---

## 3. Data Protection Act 2019 (ODPC) Obligations

Processing personal data in Kenya is regulated under the **Data Protection Act (No. 24 of 2019)** and subsidiary regulations enforced by the **Office of the Data Protection Commissioner (ODPC)** [Tag: `VERIFIED` - Data Protection Act, No. 24 of 2019].

### 3.1 Personal Data Handled by the Platform
- **Casual & Skilled Labor:** Full legal names, national identity card (ID) numbers, phone numbers (for mobile money payroll), daily wage rates, and facial photos in site diaries.
- **Tenant Staff:** Names, emails, passwords, mobile numbers, system access permissions.
- **Site Photos & Evidence:** Visual media capturing workers, bystanders, and adjacent properties.
- **Clients & Developers:** KRA PIN, billing contact details, and project location data.

### 3.2 Registration Threshold vs. Universal Compliance (F4 Correction)

> [!IMPORTANT]
> **Key Legal Distinction: Registration Exemption ≠ Compliance Exemption**  
> Under Regulation 13(2) of the *Data Protection (Registration of Data Controllers and Data Processors) Regulations, 2021*, an exemption from mandatory *registration* applies where:
> 
> *"A data controller or data processor whose annual turnover or revenue is below five million shillings and employs fewer than ten employees is exempt from mandatory registration under these Regulations... provided that the exemption shall not apply to a data controller or data processor processing personal data for the purposes set out in the Third Schedule."*  
> — [Data Protection Regulations 2021, Regulation 13(2) & 13(4)](https://www.odpc.go.ke/wp-content/uploads/2024/03/THE-DATA-PROTECTION-REGISTRATION-OF-DATA-CONTROLLERS-AND-DATA-PROCESSORS-REGULATIONS-2021.pdf) [Tag: `VERIFIED`]

#### The 12 Mandatory Registration Purposes (Third Schedule):
Under Regulation 13(4), entities processing personal data for any of the following 12 purposes **must register with the ODPC regardless of turnover or employee count**:
1. Political canvassing
2. Crime prevention (including the operation of CCTV monitoring systems)
3. Gambling
4. Operating an educational institution
5. Health administration and provision of healthcare
6. Hospitality industry
7. **Property management including the selling of land**
8. Financial services
9. Telecommunications network or service providers
10. Direct marketing
11. Transport services (including passenger transport)
12. Processing genetic data

#### Critical Product Strategy Consequence:
- **Core V1 Scope (Construction Management):** An early-stage startup with turnover < KES 5M and < 10 employees focusing strictly on construction project tracking is exempt from mandatory *registration*.
- **Scope Creep Trigger (Property Management & CCTV):** If the software later introduces **property management modules** (e.g. rent collection, property leasing, landlord statements like Strukchad's add-on) or **site CCTV/security surveillance**, it immediately triggers mandatory registration under items (2) or (7) of the Third Schedule.
- **Universal Substantive Compliance:** Regardless of registration status, Regulation 13(3) explicitly mandates compliance with Parts IV and VI of the Act (data protection principles, lawful processing, and security safeguards).

### 3.3 Core Statutory Obligations for the SaaS
1. **Roles:** The construction company (tenant) acts as the **Data Controller** (deciding which workers to record). The SaaS platform operates as a **Data Processor** (storing and processing data on behalf of tenants), and as a **Data Controller** for its own direct subscriber accounts.
2. **Mandatory 72-Hour Breach Notification (Section 43):**
   - Under Section 43 of the Data Protection Act 2019, a Data Controller or Processor must notify the ODPC within **72 hours** of becoming aware of any personal data breach [Tag: `VERIFIED` - Data Protection Act 2019, Section 43].
   - If user credentials or worker identity records are compromised, the incident response plan must immediately initiate ODPC notification.
3. **Statutory Retention Limits:**
   - Under Section 23(1) of the Tax Procedures Act (No. 29 of 2015) [Tag: `VERIFIED` - [Tax Procedures Act 2015, Section 23](https://www.kra.go.ke/images/publications/TaxProceduresAct29of2015.pdf)]:
     > *"A person who is required to keep books of account or records under a tax law shall maintain the books of account or records in Kenya for a period of at least five years."*
   - General contract claims carry a 6-year limitation period under the Limitation of Actions Act (Cap. 22) [Tag: `UNVERIFIED — SUBJECT TO LEGAL CONFIRMATION`]. Personal data beyond these statutory periods must be purged or anonymized.
4. **Mandatory Action:**
   - Confirm final registration triggers, terms of service, and privacy policy with a qualified Kenyan data protection advocate prior to commercial billing.

---

## 4. Tax & Invoicing Touchpoints (KRA eTIMS)

The Kenya Revenue Authority enforces mandatory electronic tax invoicing under **Section 23A of the Tax Procedures Act** and the **Tax Procedures (Electronic Tax Invoice) Regulations** [Tag: `UNVERIFIED — STATUTORY TAX FRAMEWORK`].

### 4.1 Legal Mandate
- **Universal Electronic Invoicing:** All businesses registered for tax in Kenya must generate and transmit electronic tax invoices through **eTIMS** for all business sales transactions.
- **Expense Deductibility:** Expenses incurred by Kenyan businesses that are not supported by a valid eTIMS electronic tax invoice with a verifiable KRA QR code are non-deductible for corporate income tax purposes.

### 4.2 System-to-System Architectures
KRA provides two integration paths for automated business software [Tag: `UNVERIFIED — KRA TECHNICAL SPECIFICATIONS`]:
1. **Online Sales Control Unit (OSCU):**
   - Cloud-to-cloud REST API communication over HTTPS to `https://etims-api.kra.go.ke`.
   - Each invoice JSON payload is transmitted in real time; KRA returns the fiscal signature and verification QR code.
   - Optimal for cloud-hosted SaaS applications with permanent internet connectivity.
2. **Virtual Sales Control Unit (VSCU):**
   - Middleware bridge (a local Java `.jar` distribution package) hosted on taxpayer premises.
   - Buffers transactions locally during network outages and syncs with KRA servers upon reconnection.

### 4.3 SaaS Touchpoints & Pre-Billing Requirement
- **Prerequisite for Subscription Billing:** Before the platform charges subscribing construction companies (via M-Pesa or bank transfer), the operating SaaS entity must be configured on eTIMS so it can issue valid electronic tax invoices. Without eTIMS invoices, corporate tenants cannot deduct their subscription fees as a business expense.
- **Future In-Project Invoicing (Phase 2/3 — Out of V1 Scope):** For future contractor valuation and payment certificate features, the data model should store contractor KRA PIN, taxable base, 16% VAT, and withholding tax fields now, avoiding database schema migrations when eTIMS integration is added later.
