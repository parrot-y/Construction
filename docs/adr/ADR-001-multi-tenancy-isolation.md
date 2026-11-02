# ADR-001: Multi-Tenancy Isolation Strategy & Transactional Atomicity

- **Status:** Draft (Awaiting independent review before Milestone M2)
- **Date:** 2026-11-02
- **Deciders:** Engineering Lead (Gemini), Project Owner, Independent Reviewer (Claude)
- **Relevant Issues:** Remediation Plan R-004, R-014, R-019

---

## 1. Context & Problem Statement

The platform is a multi-tenant SaaS serving construction companies in Kenya. Tenancy spans companies, projects, BOQs, actual costs, and audit logs. Cross-tenant data leakage is a **Critical** defect class.

A naive approach of relying solely on application-layer filtering (`where: { tenant_id }`) risks accidental developer omission in queries. However, a naive PostgreSQL Row-Level Security (RLS) implementation in combination with Prisma introduces severe failure modes:
1. **Silent RLS Bypass:** Superusers, roles with `rolbypassrls`, and **table owners** bypass RLS by default unless `FORCE ROW LEVEL SECURITY` is set. If Prisma connects as the table owner, RLS policies are silently ignored in production.
2. **Transaction Rollback Hazards (Issue #55):** Prisma Client Extensions using batch transactions (`prisma.$transaction([set_config, query])`) break when nested inside interactive transactions and do not propagate `set_config` reliably, creating a risk that financial changes commit while audit logs fail to commit (or vice-versa).
3. **Connection Pool Leaks:** Session variables set via global `SET app.current_tenant_id = 'xxx'` bleed across pooled connections (e.g. PgBouncer or Prisma connection pool).
4. **Empty String Casting Failures:** Casting an uninitialized custom setting (`''::uuid`) causes PostgreSQL runtime syntax errors rather than failing closed safely.

---

## 2. Decision

We mandate a **two-layer defense-in-depth isolation architecture** with an explicit transactional helper:

### Layer 1: Application-Layer Scoping & Repository Pattern
- Every query at the application layer must include `tenant_id`.
- Routes delegate to services, and services delegate to repositories.
- Every repository method requires a typed `TenantContext` and a transactional client `tx: Prisma.TransactionClient`.

### Layer 2: PostgreSQL Row-Level Security with Mandatory Role Separation
- Two distinct database roles:
  - `db_migrator`: Table owner, used exclusively during CI/CD migrations (`prisma migrate deploy`).
  - `db_app`: Non-owner runtime role without `rolsuper` and without `rolbypassrls`, used exclusively by the Fastify API.
- `FORCE ROW LEVEL SECURITY` applied to every tenant table.
- Standard permissive policies with identical `USING` and `WITH CHECK` clauses.
- Safe fail-closed casting: `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`.
- Session configuration scoped strictly to transaction duration via `is_local = true` (`SELECT set_config('app.current_tenant_id', $1, TRUE)`).

### The Transaction Execution Pattern: Explicit `withTenantTx`
Instead of using Prisma query extensions (which break interactive transaction rollbacks), all database operations must execute through an explicit interactive helper:

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

---

## 3. Concrete Implementation Specifications (Amendments A1–A7)

### A1. Single-Transaction Scope for Mutations
All multi-step writes (e.g. `CostEntry` write + `AuditLog` entry + `IdempotencyKey` record) must run inside **one** `withTenantTx` call:
```typescript
await withTenantTx(prisma, tenantId, async (tx) => {
  const cost = await costRepo.create(tx, costData);
  await auditRepo.log(tx, { action: 'COST_CREATED', entityId: cost.id });
  await idempotencyRepo.record(tx, idempotencyKey);
});
```

### A2. Mandatory Rollback Verification Test
The automated test suite in M2 must force an unhandled error midway through a multi-step transaction and assert that:
- The financial record was rolled back.
- The audit log record was rolled back.
- The idempotency key was rolled back.
- Database state remains completely unchanged.

### A3. Raw SQL Restriction Policy
Executing `$queryRaw` or `$executeRaw` directly on the base `prisma` instance outside `withTenantTx` is strictly forbidden. This will be enforced via an ESLint/TypeScript rule and CI static analysis.

### A4. Catalog & Startup Boot Guards
1. **API Startup Boot Guard:**
   On server initialization, the Fastify API executes:
   ```sql
   SELECT current_user, rolsuper, rolbypassrls 
   FROM pg_roles 
   WHERE rolname = current_user;
   ```
   If `rolsuper = true`, `rolbypassrls = true`, or `current_user` matches the migration table owner, the API immediately throws a fatal exception and refuses to bind the HTTP port.
2. **CI Catalog Verification Suite:**
   A test executes against `pg_class` and `pg_policies` inspecting all tables with a `tenant_id` column:
   ```sql
   SELECT c.relname
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND EXISTS (
       SELECT 1 FROM information_schema.columns 
       WHERE table_schema = 'public' 
         AND table_name = c.relname 
         AND column_name = 'tenant_id'
     )
     AND (c.relrowsecurity = false OR c.relforcerowsecurity = false);
   ```
   If any tenant table has `relrowsecurity = false` or `relforcerowsecurity = false`, CI fails.

### A5. Complete SQL Migration Schema
Every tenant-owned table in migrations must include:
```sql
-- Example for Project table
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

-- Example for CostEntry table
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

### A6. Maintenance & Backfills Under FORCE
Because `FORCE ROW LEVEL SECURITY` applies to the table owner (`db_migrator`) as well:
- Schema migrations that alter structure run without tenant context.
- Data migrations and batch backfills must explicitly iterate through tenants, calling `set_config('app.current_tenant_id', tenant.id, true)` for each tenant chunk.
- Cross-tenant operational analytics (e.g., system-wide backups or administrative reporting) run via an audited, dedicated read-only role granted `BYPASSRLS`, which is never used by the runtime API.

### A7. Cloud Environment (Railway) Validation
During Milestone M0/M1 setup on Railway PostgreSQL:
1. Verify role creation commands:
   ```sql
   CREATE ROLE db_app WITH LOGIN PASSWORD '...';
   GRANT CONNECT ON DATABASE postgres TO db_app;
   GRANT USAGE ON SCHEMA public TO db_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO db_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO db_app;
   ```
2. Verify that Railway connection poolers (PgBouncer or container-managed pools) do not persist `app.current_tenant_id` across subsequent client leases when using `is_local = true`.

---

## 4. Consequences

### Positive
- Cross-tenant data leaks are mathematically impossible at the database engine level, even if an application repository query omits a `where` clause.
- Financial transactions, audit entries, and idempotency states are guaranteed to commit or rollback atomically.
- Automated CI catalog checks prevent developer oversight when introducing new database entities.

### Negative / Trade-offs
- Every database mutation requires wrapping within `withTenantTx`.
- Slightly higher connection round-trip overhead on first transaction query (mitigated by pipelining or connection locality).
- Integration test setup requires seeding test databases with separate `db_migrator` and `db_app` credentials.
