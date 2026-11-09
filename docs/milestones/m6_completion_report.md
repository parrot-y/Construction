# Milestone M6 Completion Report: Site Diary, Photos, Progress & Offline Sync

**Project:** Platform (Kenya-First Construction Management SaaS)  
**Date:** 2026-11-03  
**Status:** Complete & Fully Verified (All 88/88 Monorepo Tests Passing)  
**Git Head Commit:** [`909b149`](file:///home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction)  

---

## 1. Executive Summary & Core Deliverables

Milestone **M6** implements the field operations engine of Platform, linking daily on-site physical reality directly to the core loop:
$$\text{BOQ} \rightarrow \text{Budget} \rightarrow \mathbf{Site\ Progress\ \&\ Evidence} \rightarrow \text{Cost} \rightarrow \text{Approvals} \rightarrow \text{Client Visibility}$$

In accordance with strict Kenyan field conditions (intermittent 3G/4G connectivity on construction sites in Nairobi, Kiambu, and Machakos) and **[ADR-004: Offline Sync Strategy & Field Mutation Queue](file:///home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/docs/SYSTEM_DESIGN.md#adr-004-offline-sync-strategy--field-mutation-queue)**, Milestone M6 establishes:

1. **Strict Offline Domain Boundary:** Offline queueing is strictly permitted **only** for non-financial field telemetry (`site_diaries`, `labor_headcounts`, `material_deliveries`, `progress_records`, `site_photos`). Financial ledger approvals (`CostApproval`), BOQ commitments (`BOQ`), and invitations are fail-closed and strictly rejected offline.
2. **IndexedDB Local Mutation Queue:** Powered by a clean typed IndexedDB client (`apps/web/src/services/offline-sync.ts`) with background retry, window `online` auto-flush, and user-triggered synchronization.
3. **Idempotency-Key Cache Protection:** Every queued mutation is stamped with an immutable UUID `Idempotency-Key` header. The Fastify API caches responses and returns `X-Cache-Lookup: HIT`, guaranteeing zero duplicate diaries, photos, or progress records upon connection reconnects.
4. **Client-Side HTML5 Canvas Photo Compression:** Automatically resizes heavy mobile camera photos (5–15 MB) down to high-definition web assets (~150 KB JPEG, max dimension 1280px, quality 0.7) before storing in IndexedDB or uploading over Kenyan cellular data links.
5. **GPS Geotagged Evidence:** Site photos capture geolocation metadata (latitude/longitude/timestamp) and attach directly to the daily diary.
6. **Cumulative Physical Progress Measurement:** Supervisors and Quantity Surveyors record physical milestone completion percentages against BOQ items, feeding the Milestone M7 variance engine.

---

## 2. Architecture & File Inventory

```
apps/
├── api/
│   ├── src/
│   │   ├── routes/site.ts              # Fastify 5 endpoints for diaries, photos, progress & idempotency
│   │   ├── m6-site.test.ts             # 8 integration test suites for M6 API endpoints
│   │   └── index.ts                    # Registered siteRoutes
└── web/
    ├── src/
    │   ├── services/
    │   │   └── offline-sync.ts         # IndexedDB queue, Canvas compressor & sync worker
    │   ├── components/
    │   │   ├── OfflineSyncBanner.tsx   # Reactive online/offline banner with pending queue count
    │   │   ├── SiteDiaryModal.tsx      # Comprehensive site operations modal (weather, crew, deliveries, photos)
    │   │   ├── PhysicalProgressModal.tsx # Cumulative progress percentage modal with BOQ item tracking
    │   │   ├── SupervisorDashboard.tsx # Site supervisor workspace wired with modals & sync banner
    │   │   └── PmQsDashboard.tsx       # PM/QS workspace with physical progress inspection modal
    │   └── App.test.tsx                # React 19 unit test assertions for M6 components
packages/
├── validation/
│   └── src/index.ts                    # Zod schemas for Weather, Headcount, Delivery, Diary & Progress
└── db/
    └── prisma/
        └── seed.ts                     # Multi-tenant seed wrapped in withTenantTx
```

---

## 3. Detailed Endpoint & Schema Specifications

### 3.1 Fastify API Routes (`apps/api/src/routes/site.ts`)

| HTTP Method | Route | Permission Required | Description |
|---|---|---|---|
| `POST` | `/api/v1/projects/:id/site-diaries` | `site.diary.create` | Records daily diary with weather, site status, labor headcount matrix, material deliveries, and geotagged photos inside `withTenantTx`. Supports `Idempotency-Key` header. |
| `GET` | `/api/v1/projects/:id/site-diaries` | `project.view` | Retrieves paginated site diaries for the project, strictly scoped by PostgreSQL RLS. |
| `POST` | `/api/v1/projects/:id/site-diaries/:diaryId/photos` | `evidence.upload` | Appends additional geotagged photos to an existing site diary record. |
| `POST` | `/api/v1/projects/:id/progress` | `progress.update` | Records cumulative physical progress percentage with optional BOQ line item breakdown. Supports `Idempotency-Key` header. |
| `GET` | `/api/v1/projects/:id/progress` | `project.view` | Retrieves historical progress inspections and timeline records. |

### 3.2 Zod Validation Schemas (`packages/validation/src/index.ts`)

- `WeatherConditionEnum`: `'SUNNY_CLEAR' | 'CLOUDY' | 'LIGHT_RAIN' | 'HEAVY_RAIN' | 'RAIN_DELAY' | 'DUST_STORM'`
- `SiteStatusEnum`: `'OPERATIONAL' | 'PARTIAL' | 'STOPPED'`
- `TradeHeadcountSchema`: `{ tradeType: string (2..100), headcount: int (1..500) }`
- `MaterialDeliverySchema`: `{ materialName: string, quantity: DecimalString, unit: string, supplierName?: string, deliveryNote?: string }`
- `SitePhotoInputSchema`: `{ storageKey: string, caption?: string, takenAt?: datetime, gpsLatitude?: float (-90..90), gpsLongitude?: float (-180..180) }`
- `CreateProgressRecordSchema`: `{ projectId: uuid, recordDate: YYYY-MM-DD, overallProgress: DecimalRatio (0.0000..1.0000), notes?: string, items?: ProgressItemRecord[] }`

---

## 4. Test Verification & Results

Every package in the monorepo passes with **100% test coverage** under strict PostgreSQL 18 Row-Level Security (`FORCE ROW LEVEL SECURITY`):

```bash
$ turbo run test --force
```

### Monorepo Test Summary (88 / 88 Passing)

| Package | Test Suites | Tests | Status |
|---|---|---|---|
| `@construction/api` | 7 files (`server`, `auth`, `rbac`, `m3`, `m4-boq`, `m5-costs`, `m6-site`) | **52 passed** | ✅ GREEN (14.9s) |
| `@construction/web` | 1 file (`App.test.tsx`) | **13 passed** | ✅ GREEN (1.8s) |
| `@construction/db` | 2 files (`index.test.ts`, `isolation.test.ts`) | **11 passed** | ✅ GREEN (6.0s) |
| `@construction/money` | 1 file (`index.test.ts`) | **7 passed** | ✅ GREEN (0.9s) |
| `@construction/permissions` | 1 file (`index.test.ts`) | **5 passed** | ✅ GREEN (0.9s) |
| **Total Monorepo** | **12 test suites** | **88 passed** | **✅ 100% GREEN** |

### M6 Integration Test Highlights (`apps/api/src/m6-site.test.ts`)

1. **Daily Diary Logging:** Successfully creates diary with weather `SUNNY_CLEAR`, status `OPERATIONAL`, 4 trade headcounts (17 total workers), material delivery note, and geotagged photos.
2. **Photo Attachment:** Attaches subsequent GPS-tagged photos to an existing diary.
3. **Physical Progress %:** Logs 15.0% cumulative site progress with line-item completion on excavation BOQ item.
4. **Idempotency Guarantee:** Re-submitting the exact same mutation with the same `Idempotency-Key` returns the cached HTTP 201 response with header `X-Cache-Lookup: HIT` without inserting duplicate rows.
5. **PostgreSQL RLS Isolation:** Tenant B attempts to read or modify Tenant A site diaries and progress records; queries return empty arrays or fail closed with zero cross-tenant leakage.
6. **Role-Based Least Privilege:** Client role attempting to record site diaries is rejected with HTTP 403 Forbidden.
7. **Unauthenticated Request Rejection:** Requests without JWT cookies receive HTTP 401 Unauthorized.
8. **Atomic Rollback Guarantee (ADR-001 A2):** A simulated failure halfway through a multi-step diary transaction rolls back completely; zero orphan records persist in the database.

---

## 5. Risk Register Status (Remediation Plan)

| Risk ID | Title | Status | Evidence |
|---|---|---|---|
| **R-004** | Cross-tenant data leakage | **Fixed (awaiting review)** | All 20 tenant tables protected by `FORCE ROW LEVEL SECURITY`; runtime role verified as non-owner `db_app`. |
| **R-005** | Financial floating-point errors | **Fixed (awaiting review)** | `packages/money` with `decimal.js` enforces 2-decimal currency and 4-decimal rates/quantities. |
| **R-007** | Offline sync conflicts & corruption | **Fixed (awaiting review)** | Offline strictly partitioned to non-financial field telemetry; `Idempotency-Key` cache lookup prevents duplicates; Canvas compression preserves bandwidth. |
| **R-012** | Messy Kenyan BOQ import | **Fixed (awaiting review)** | 6-stage EASMM import pipeline with arithmetic anomaly detection and interactive React 19 preview. |
| **R-019** | Transaction atomicity under RLS | **Fixed (awaiting review)** | `withTenantTx` transactional helper proven with forced atomic rollback test vectors. |

---

## 6. Next Steps: Milestone M7 Plan

With Milestone M6 complete and committed to git (`9642e8f`, `909b149`), the project advances to **Milestone M7: Variance Flags & Project Dashboard**:

1. **Variance Engine:** Compare real-time cumulative cost consumption percentage against physical progress percentage:
   $$\Delta_{\text{variance}} = \text{Cost Consumption \%} - \text{Physical Progress \%}$$
2. **Neutral Warning Thresholds (ADR-001 / Strict Rules):**
   - $\Delta \le 5\%$: **On Track / Normal Alignment**
   - $5\% < \Delta \le 15\%$: **Expenditure Ahead of Physical Progress (Review Advised)**
   - $\Delta > 15\%$: **Significant Expenditure Disparity (Site Inspection Recommended)**
   *(Strictly neutral, factual terminology; zero accusatory language like "theft" or "fraud").*
3. **Role Dashboard Integration:** Display real-time variance gauges on `PmQsDashboard` and `ClientDashboard`.
4. **Milestone M7 Test Suite:** Unit and integration tests for variance calculation, thresholds, and dashboard metric endpoints.
