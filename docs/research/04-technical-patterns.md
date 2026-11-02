# Research Report 04: Technical Architecture & Integration Patterns

**Access Date:** 2026-10-27  
**Scope:** PostgreSQL Row-Level Security (RLS) and Prisma multi-tenancy architecture, PWA offline mutation queue with idempotent synchronization, Excel BOQ parsing pipeline using `exceljs`, server-side PDF report generation considerations on Railway, and Safaricom Daraja STK Push subscription billing specifications.

---

## 1. Multi-Tenancy: PostgreSQL RLS & Prisma Architecture

In a multi-tenant SaaS holding sensitive financial construction records, cross-tenant data leaks represent a fatal Critical defect (Remediation Plan R-004). The architecture combines typed application repository scoping with database-level PostgreSQL Row-Level Security (RLS).

### 1.1 PostgreSQL RLS Security Foundation

To guarantee tenant isolation at the database layer, the design adheres to PostgreSQL's formal security model [Tag: `VERIFIED` - PostgreSQL 16 Documentation: [Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)]:

> *"Table owners normally bypass row security policies... however, the table owner can be chosen to be subject to row security by using ALTER TABLE ... FORCE ROW LEVEL SECURITY."*
> — PostgreSQL Documentation, §5.8 Row Security Policies

Key architectural rules:
1. **Database Role Separation:**
   - Superusers and roles with `BYPASSRLS` bypass RLS unconditionally.
   - The database environment requires two distinct roles:
     - `db_migrator`: Table owner used only during schema migrations (`prisma migrate deploy`) in CI/CD.
     - `db_app`: Non-owner runtime role without `rolsuper` or `rolbypassrls`, used exclusively by the Fastify API.
2. **Mandatory `FORCE ROW LEVEL SECURITY`:**
   - Every tenant table must have `FORCE ROW LEVEL SECURITY` applied. This prevents accidental bypass even if table ownership changes or a migration role runs queries.
3. **Permissive Policy with `USING` and `WITH CHECK`:**
   - Restrictive policies only narrow access granted by permissive policies. If only a restrictive policy is defined with no permissive policy, all access is denied.
   - The policy must be a standard (permissive) policy and must include both `USING` (filtering reads, updates, deletes) and `WITH CHECK` (validating incoming inserts and updates).
4. **Fail-Closed Type Casting (`NULLIF`):**
   - Resetting or omitting a custom session variable causes `current_setting('app.current_tenant_id', true)` to return an empty string (`''`) or `NULL`. Casting an empty string directly (`''::uuid`) throws a database syntax error.
   - Using `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` safely converts empty strings to `NULL`. Since `tenant_id = NULL` evaluates to `NULL` (falsy), missing-tenant queries fail closed and return zero rows without throwing unhandled exceptions.

---

### 1.2 Prisma Transaction Caveats & The `withTenantTx` Pattern

#### The Transaction Atomicity Hazard (R-019)
Prisma Client Extensions that wrap operations in batch transactions (`prisma.$transaction([set_config, query])`) present severe transaction isolation caveats in financial software [Tag: `UNVERIFIED — REPOSITORY ISSUE & COMMUNITY FINDING` - [prisma-client-extensions issue #55](https://github.com/prisma/prisma-client-extensions/issues/55)]:
- Prisma Client Extensions are officially designated as examples and not hardened for production financial transactions.
- Issue #55 notes that batch-transaction client extensions can break interactive transaction rollbacks.
- Batch extensions do not propagate `set_config` into nested interactive transactions.
- **Why this is critical:** GEMINI.md Section 6 mandates that audit logs must be written **in the same transaction** as financial changes. If an extension executes queries outside the intended transaction scope, a "financial change committed, audit log missing" failure becomes possible.

#### Recommended Solution: The Explicit `withTenantTx` Helper (A1)
Rather than relying on client query extensions, all database mutations and financial writes must use an explicit interactive transaction helper that sets the tenant context at the start of the transaction and passes the transactional client `tx` to every repository method:

```typescript
import { PrismaClient, Prisma } from '@prisma/client';

export function withTenantTx<T>(
  prisma: PrismaClient,            // Base client connected as db_app
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // 1. Enforce tenant scope strictly within this leased connection/transaction
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, TRUE)`;
    
    // 2. Execute business operations using tx
    return fn(tx);
  });
}
```

#### Architectural Rules for `withTenantTx`:
- **Single Transaction Scope:** Multi-step writes (e.g. `CostEntry` creation + `AuditLog` entry + `IdempotencyKey` record) must run inside **one** `withTenantTx`.
- **Repository Signature:** Every repository method takes `tx: Prisma.TransactionClient` as an argument.
- **Raw SQL Restriction (A3):** Executing `$queryRaw` or `$executeRaw` outside `withTenantTx` is strictly forbidden (enforced via lint rule and unit tests) to prevent bypassing the tenant session setting.

---

### 1.3 Complete SQL DDL Example (A5)

```sql
-- Executed as db_migrator during migrations
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON "Project"
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE "CostEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CostEntry" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON "CostEntry"
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
```

---

### 1.4 Mandatory Verification Suite & Boot Checks (A2, A4, A6, A7)

During Milestone M2, the test suite must execute against real PostgreSQL and assert:

1. **Mandatory Rollback Test (A2):** Force a deliberate runtime failure halfway through a multi-step write (e.g. after inserting `CostEntry` but before committing `AuditLog`). Assert that the entire transaction rolled back and **nothing** persisted (no cost entry, no audit record, no idempotency key).
2. **Catalog Checks in CI (A4):**
   - As runtime role `db_app`: `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user` must return `false, false`.
   - Catalog query across `pg_class` and `pg_policies`: For every table containing a `tenant_id` column, assert `relrowsecurity = true`, `relforcerowsecurity = true`, at least one policy exists in `pg_policies`, and `tableowner != 'db_app'`. Fails CI build if a developer adds a table without RLS.
3. **Application Boot Check (A4):** The Fastify API must refuse to boot if `SELECT current_user` matches the database superuser or table owner, preventing deployment with misconfigured credentials.
4. **Cross-Tenant Isolation Tests:**
   - Tenant A cannot read, update, or delete Tenant B's data under `db_app`.
   - Missing tenant context (`current_setting` unset or empty) returns zero rows.
5. **Migrations & Backfills under FORCE (A6):** Data backfills and cross-tenant admin maintenance jobs must execute under an explicit per-tenant context loop or via a dedicated, audited maintenance script running under a separate role.
6. **Railway Staging Verification (A7):** Staging deployment in M0/M1 must verify that Railway's PostgreSQL environment supports separate role provisioning and that connection pooling does not retain leaked session variables across pooled connections.

---

## 2. PWA Offline Queue & Idempotent Sync

### 2.1 Scope Boundary
Financial approvals, BOQ imports, contract variations, and permission changes are strictly **online-only**. Offline functionality is limited to field observations [Tag: `INTERNAL DECISION — GEMINI.MD SECTION 6`]:
1. Daily site diary notes (weather conditions, site status).
2. Labor attendance headcounts.
3. Daily physical progress percentage updates.
4. Site photos and visual evidence notes.

### 2.2 Client-Side Architecture (Dexie.js + Service Worker)
- **Service Worker:** Managed via `@vite-pwa/vite-plugin-pwa` with Workbox to cache static UI assets (HTML/JS/CSS/SVG) [Tag: `UNVERIFIED — FRAMEWORK PATTERN`].
- **Local Storage:** Dexie.js (type-safe IndexedDB wrapper) [Tag: `UNVERIFIED — REPOSITORY PATTERN`].
- **Client Mutation Queue Schema:**

```typescript
interface OfflineQueueItem {
  id: string; // Client-generated UUIDv4
  idempotency_key: string; // Deterministic or UUIDv4
  device_id: string;
  client_timestamp: string; // ISO 8601
  endpoint: string; // e.g. '/api/v1/projects/:id/site-diary'
  method: 'POST' | 'PUT';
  payload: Record<string, unknown>;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  retry_count: number;
  last_error?: string;
}
```

### 2.3 Server-Side Idempotent Processing
- **Database Table:** `idempotency_keys` with a unique constraint on `(tenant_id, idempotency_key)`.
- **Sync Protocol:**
  1. Client listens for online events (`window.addEventListener('online', ...)`).
  2. When online, pending items are sent sequentially with header `Idempotency-Key: <key>`.
  3. Server pre-handler checks `idempotency_keys`. If already processed, returns the cached response status and payload immediately.
  4. If new, executes the mutation within a database transaction, records the result in `idempotency_keys`, and commits.
  5. Client marks the local item as `synced` and purges it after confirmation.

---

## 3. Excel BOQ Parsing & Handling Messy Sheets

### 3.1 Library Comparison: `exceljs` vs Alternatives
- **`xlsx` (SheetJS):** The npm distribution of SheetJS has had security warnings and dual-licensing complexity [Tag: `UNVERIFIED — COMMUNITY RECORD`].
- **`exceljs` (Recommended):** Fully open-source (MIT license), active community, full support for streaming read operations (`exceljs.stream.xlsx.WorkbookReader`), cell formula evaluation, formatted values, and explicit access to merged cell boundaries [Tag: `UNVERIFIED — OPEN-SOURCE LIBRARY`].

### 3.2 Real Kenyan BOQ Spreadsheet Realities & Failure Modes
Spreadsheets prepared under the East African Standard Method of Measurement (EASMM) commonly exhibit these layout quirks [Tag: `UNVERIFIED — GENERAL INDUSTRY PRACTICE`]:
1. **Merged Cells:** In Excel, only the top-left cell of a merged block contains the cell value; other cells in the merge range evaluate to `null` or empty strings.
2. **Subtotal Rows:** Rows labeled "Carried to Collection" or "Total Substructure" carry currency totals but no unit rates or item quantities.
3. **Provisional / PC Sums:** Lump sum items formatted with description text and an amount in the total column without a quantity or unit rate.
4. **Messy Currency Strings:** Text formatted as `"KSh 1,250,000.00"`, `"1,250,000/="`, or numbers with whitespace, commas, or parentheses for negatives.
5. **Formula Errors:** Uncomputed or broken formulas (`#REF!`, `#VALUE!`).

### 3.3 The Safe 6-Stage Staged Import Pipeline
The application must **never** perform direct unvalidated imports of financial files:

```
[ Excel Upload ] 
       │
       ▼
1. Extract Raw Cells & Resolve Merged Ranges (exceljs)
       │
       ▼
2. Column Mapping (Auto-detect Item No, Description, Unit, Qty, Rate, Total + User Confirmation)
       │
       ▼
3. Server-Side Row Validation (Check positive numbers, rate * qty = total check, flag anomalies)
       │
       ▼
4. Preview Table (Show valid rows in green, rejected rows in amber/red with specific line errors)
       │
       ▼
5. User Explicit Confirmation (User reviews and accepts summary counts)
       │
       ▼
6. Atomic Database Transaction (Insert BOQ, Sections, and Items; log audit record)
```

---

## 4. Server-Side PDF Report Generation

### 4.1 Architecture Options for Cloud Hosting
Generating formal payment certificates, budget reports, and site diaries requires careful selection of the PDF rendering engine:

| Engine | Execution Architecture | Resource Profile | Assessment for Railway Hosting |
|---|---|---|---|
| **`@react-pdf/renderer`** | Pure Node.js rendering using Yoga layout engine; no browser binary [Tag: `UNVERIFIED — LIBRARY PATTERN`]. | Runs entirely within the Node.js process. | Highly suitable for containerized micro-instances. Low overhead; generates binary PDF streams directly to Fastify response. |
| **Puppeteer / Playwright** | Spawns headless Chromium process to render HTML/CSS to PDF via Chrome DevTools Protocol [Tag: `UNVERIFIED — LIBRARY PATTERN`]. | Requires Chromium binary installation and launches external multi-threaded browser processes. | High risk of Out-Of-Memory (OOM) failures on low-memory container tiers. Container images are significantly larger. |

> [!NOTE]
> **Status:** `UNVERIFIED — TO BE BENCHMARKED IN M10`  
> While `@react-pdf/renderer` is the architectural recommendation due to its lightweight Node.js footprint, exact memory consumption, rendering latency, and font metrics must be measured on real Railway staging containers during Milestone M10 before freezing the implementation.

---

## 5. Safaricom Daraja STK Push (Subscription Billing)

*Note: Researched for architecture alignment; subscription billing implementation occurs after pilot validation per GEMINI.md Section 9.*

### 5.1 API Endpoint & Protocol
- **Endpoint:** `POST /mpesa/stkpush/v1/processrequest` [Tag: `UNVERIFIED — VENDOR SPECIFICATION` - Safaricom Daraja API Portal].
- **Authentication:** OAuth 2.0 Bearer Token obtained via client credentials.

### 5.2 STK Push Payload Specification

| Parameter | Type | Value & Constraint |
|---|---|---|
| `BusinessShortCode` | String | Organization Paybill or Till number. |
| `Password` | String | Base64-encoded string: `Base64(BusinessShortCode + Passkey + Timestamp)`. |
| `Timestamp` | String | Format: `YYYYMMDDHHmmss`. |
| `TransactionType` | String | `CustomerPayBillOnline` or `CustomerBuyGoodsOnline`. |
| `Amount` | Number | Exact integer or decimal amount in KES. |
| `PartyA` | String | Customer mobile phone number: `2547XXXXXXXX`. |
| `PartyB` | String | Shortcode receiving the payment (same as `BusinessShortCode`). |
| `PhoneNumber` | String | Mobile number to receive SIM toolkit prompt (`2547XXXXXXXX`). |
| `CallBackURL` | String | Public HTTPS endpoint on Fastify API to receive asynchronous webhook. |
| `AccountReference` | String | Tenant ID or Subscription Invoice ID. |
| `TransactionDesc` | String | Description shown on prompt. |

### 5.3 Asynchronous Callback & Webhook Verification
- Safaricom calls the `CallBackURL` asynchronously upon customer PIN entry or timeout.
- Response payload structure:
  - `ResultCode: 0`: Transaction successful.
  - `ResultCode != 0`: Transaction failed.
  - `CallbackMetadata`: Contains `MpesaReceiptNumber`, `Amount`, `TransactionDate`, and `PhoneNumber`.
- **Security Rule:** Webhook endpoint must validate the callback authenticity, enforce idempotency against `MpesaReceiptNumber`, and update tenant subscription status inside an atomic database transaction.
