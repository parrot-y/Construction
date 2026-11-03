# Stakeholder Portals & Zero-Seat-Tax Architecture Completion Report

**Milestone Identifier:** `FEAT-PORTALS-ZERO-SEAT-TAX`  
**Date:** 2026-11-03  
**Status:** Complete & Self-Verified  
**Branch:** `main`  
**Monorepo Test Suite:** **243 / 243 passing tests across 6 packages**  
**Typecheck:** **7 / 7 packages clean (0 errors)**  
**Production Build:** **3 / 3 packages successful (Turbo + Vite PWA + Fastify API)**

---

## 1. Executive Summary & Architecture Overview

To eliminate the predatory "seat tax" prevalent in enterprise construction ERPs (where contractors are billed $50–$250/user/month for giving read-only access to architects, sub-contractors, suppliers, or county planning inspectors), `MjengoLedger` now provides a **Zero Seat Tax Architecture** across **8 Stakeholder Portals**:

1. **Contractor Executive / Company Admin** (Full portfolio oversight, tenant management, audit trail).
2. **Commercial PM / Quantity Surveyor** (EASMM 2008 BOQ baseline, valuations, variation register, cost control, IPC generation).
3. **Site Supervisor Mobile PWA** (Daily site diary, labor headcount matrix, material receiving, offline mutations, geo-tagged photos).
4. **Client / Property Developer Portal** (Plain-language Decimal financials, milestone timeline, verified photo evidence gallery).
5. **Consultant (Architect & Structural Engineer) Portal** (Zero Seat Tax token access: BORAQS Cap 525 technical RFI responses, BS EN 12390 concrete cube crush verification, Pre-Pour QA sign-offs).
6. **Subcontractor & Specialist Trade Portal** (Zero Seat Tax token access: Trade-filtered snagging punch lists, after-repair photo uploads, GPS coordinates, rectification status updates).
7. **Material Supplier & Batching Plant Portal** (Zero Seat Tax token access: Concrete batching schedule, electronic delivery ticket/docket numbers, volume reconciliations, site receiving signatures).
8. **NCA & County Regulatory Compliance Portal** (Zero Seat Tax token access: NCA Cap 499A project registration certificate, 0.5% statutory construction levy proof, certified site supervisor accreditation, independent concrete cube test registers).

---

## 2. PostgreSQL 18 Row-Level Security & Token Isolation

### Database Model (`packages/db/prisma/schema.prisma`)
```prisma
model PortalAccessLink {
  id               String      @id @default(uuid()) @db.Uuid
  tenant_id        String      @db.Uuid
  project_id       String      @db.Uuid
  portal_type      PortalType  // CLIENT, CONSULTANT, SUBCONTRACTOR, SUPPLIER, COMPLIANCE
  stakeholder_name String      @db.VarChar(255)
  stakeholder_role String?     @db.VarChar(255)
  token            String      @unique @db.VarChar(128)
  is_active        Boolean     @default(true)
  expires_at       DateTime    @db.Timestamptz
  created_at       DateTime    @default(now()) @db.Timestamptz

  project          Project     @relation(fields: [project_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, project_id])
  @@index([token])
  @@map("portal_access_links")
}
```

### RLS Security Policies (`packages/db/prisma/rls.sql`)
1. **Public Token Lookup Isolation:**
   ```sql
   CREATE POLICY portal_access_links_lookup_policy ON portal_access_links
     FOR SELECT
     TO db_app
     USING (
       current_setting('app.auth_context', TRUE) = 'portal'
       OR tenant_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
     );
   ```
2. **Fail-Closed Execution:** When a public token request arrives, the route sets `app.auth_context = 'portal'` to look up the valid link without joining tables. Once the link and its `tenant_id` are identified, all data fetching runs strictly inside `withTenantTx(prisma, link.tenant_id, ...)` so PostgreSQL 18 guarantees no tenant data leaks across tenants.

---

## 3. Endpoints Implemented (`apps/api/src/routes/externalPortals.ts`)

| HTTP Method | Route | Description | Auth / Security |
|---|---|---|---|
| `POST` | `/api/v1/projects/:projectId/portals/links` | Generates 32-byte crypto token access link for any external stakeholder | Authenticated (Admin, PM/QS, `PROJECT_VIEW`) |
| `GET` | `/api/v1/projects/:projectId/portals/links` | Lists all active token links for a project | Authenticated |
| `GET` | `/api/v1/portals/validate/:token` | Validates token authenticity, expiration, and returns stakeholder role & project | Public / Zero Seat Tax |
| `GET` | `/api/v1/portals/consultant/:token` | Retrieves RFIs, concrete cube tests, and pre-pour inspection checklists | Token-authorized |
| `POST` | `/api/v1/portals/consultant/:token/rfis/:rfiId/reply` | Submits official architect/engineer answer with BORAQS registration | Token-authorized |
| `GET` | `/api/v1/portals/subcontractor/:token` | Retrieves trade-scoped snags (e.g. Plumbing, Electrical, Joinery) | Token-authorized |
| `POST` | `/api/v1/portals/subcontractor/:token/snags/:snagId/rectify` | Marks snag rectified with after-photo storage key and GPS coordinates | Token-authorized |
| `GET` | `/api/v1/portals/supplier/:token` | Retrieves concrete batch schedule, delivery dockets, and site receiving notes | Token-authorized |
| `GET` | `/api/v1/portals/compliance/:token` | Retrieves NCA project pack, 0.5% levy status, cube strength pass rate | Token-authorized |

---

## 4. React 19 Frontend Components (`apps/web/src/components/`)

- **`portals/ConsultantPortalView.tsx`**: Architect / Structural Engineer review portal for technical RFIs, concrete cube tests with BS EN 12390 MPa calculations, and pre-pour inspection sign-offs.
- **`portals/SubcontractorPortalView.tsx`**: Trade contractor defect punch list with severity badges, location breadcrumbs, and photo proof rectification workflow.
- **`portals/SupplierPortalView.tsx`**: Batching plant and supplier delivery log with docket numbers, truck volumes, and site receiving supervisor signatures.
- **`portals/CompliancePortalView.tsx`**: Statutory compliance overview for NCA and County planning inspectors with statutory levy badges, accredited supervisor verification, and cube pass rate registers.
- **`PortalAccessLinkManager.tsx`**: Instant link generator and clipboard manager embedded in PM/QS and Company Admin dashboards allowing 1-click preview and token link generation.
- **`App.tsx` & `Dashboard.tsx` Integration**: Direct token link landing via URL query parameters (`?portal=<type>&token=<token>`) allowing unauthenticated access, plus seamless in-dashboard preview for contractor staff.

---

## 5. Verification & Test Metrics

- **`apps/api/src/external-portals.test.ts`**: 13/13 passing tests covering link generation, RBAC restrictions, public validation, consultant RFI answers, subcontractor rectification, supplier delivery dockets, compliance auditing, and cross-tenant / cross-portal fail-closed security.
- **`apps/web/src/App.test.tsx`**: 49/49 passing tests verifying server-side and client-side rendering of all stakeholder portal views, link manager, and unauthenticated entry.
- **Full Monorepo Status:** 243/243 tests green across all 6 packages.
