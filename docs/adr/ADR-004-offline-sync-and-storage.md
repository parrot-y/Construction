# ADR-004: Client-Side Offline Storage & Synchronization

- **Status:** Draft (Awaiting implementation in Milestone M6)
- **Date:** 2026-11-02
- **Deciders:** Engineering Lead (Gemini), Project Owner, Independent Reviewer (Claude)
- **Relevant Issues:** Remediation Plan R-007, Milestone M6 Scope

---

## 1. Context & Problem Statement

Kenyan construction sites (particularly peri-urban and upcountry developments in areas like Ruiru, Athi River, Kitengela, or Naivasha) suffer from intermittent cellular coverage, edge connectivity (2G/3G), and dead zones inside reinforced concrete structures.

Site supervisors and foremen must capture daily field records without being blocked by network failures. However, allowing offline writes in a multi-stakeholder financial application introduces severe risks:
1. **Financial Conflict Corruptions:** If two users edit budget records or approve variations offline, concurrent updates can lead to inconsistent ledger states or last-write-wins race conditions.
2. **Bandwidth Exhaustion:** Modern smartphone photos are 5MB–15MB each; uploading multiple raw photos over edge connections chokes field data bundles.

---

## 2. Decision

We mandate a **strict domain boundary for offline mutations**, powered by a client-side **Dexie.js (IndexedDB)** queue and server-side **Idempotent Synchronization**.

### 2.1 The Strict Offline Domain Boundary

| Operation | Offline Capable? | Rationale |
|---|---|---|
| **Daily Site Diary** (weather, notes, site status) | **YES** | Additive field logging; isolated per project/day. |
| **Daily Labor Headcount** | **YES** | Additive site record. |
| **Daily Physical Progress %** | **YES** | Field observation; does not mutate financial ledger. |
| **Site Photo Capture & Evidence** | **YES** | Local capture with client-side compression. |
| **Financial Approvals** | **NO (Strictly Online)** | Approval state changes alter payment liabilities. Must verify real-time state. |
| **BOQ Import & Line Edits** | **NO (Strictly Online)** | Modifies budget baseline. |
| **Variation Order Creation/Approval** | **NO (Strictly Online)** | Contractual change altering contract sum. |
| **User Role & Permission Changes** | **NO (Strictly Online)** | Security policy enforcement. |

---

### 2.2 Client-Side Architecture (Dexie.js + PWA)

- **Storage Engine:** Dexie.js (type-safe IndexedDB wrapper).
- **Client Queue Schema:**
  ```typescript
  interface OfflineMutationRecord {
    id: string;                    // Client UUIDv4
    idempotency_key: string;       // Client UUIDv4
    tenant_id: string;
    project_id: string;
    endpoint: string;              // e.g. '/api/v1/projects/:id/site-diary'
    method: 'POST' | 'PUT';
    payload: Record<string, unknown>;
    device_id: string;
    client_timestamp: string;      // ISO 8601
    status: 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';
    retry_count: number;
    last_error?: string;
  }
  ```

### 2.3 Client-Side Image Compression
- When a site photo is captured, it is processed client-side via HTML5 Canvas before touching IndexedDB:
  - Max dimension: `1280px` width/height (retaining aspect ratio).
  - Format: `image/jpeg` with quality factor `0.7`.
  - Exif metadata (timestamp and device orientation) preserved.
- Reduces raw photo size from **~8MB down to ~150KB** (98% bandwidth reduction) without losing crack or masonry detail.

### 2.4 Server-Side Idempotent Synchronization
- **PostgreSQL Table:** `idempotency_keys` with a unique constraint on `(tenant_id, idempotency_key)`.
- **Sync Protocol:**
  1. The client monitors `window.addEventListener('online', ...)`.
  2. When connectivity is restored, the client flushes queued mutations in chronological order, attaching the `Idempotency-Key` HTTP header.
  3. The Fastify API checks `idempotency_keys`:
     - If key exists and status is `COMPLETED`: Server returns the cached response status and payload immediately without re-executing logic.
     - If key does not exist: Server executes the mutation inside `withTenantTx`, stores the result in `idempotency_keys`, and commits.
  4. The client marks the item as `SYNCED` and purges it from local storage.

---

## 3. Consequences

### Positive
- Site supervisors experience zero-latency interaction; progress updates and photos save instantly even underground or in remote areas.
- Financial records are protected from offline conflict corruptions.
- Field data consumption is minimized through client-side image compression.

### Negative / Trade-offs
- Site supervisors cannot perform financial sign-offs while offline.
- Requires building a sync status UI ("3 updates pending sync") and error recovery screen for persistently failing mutations.
