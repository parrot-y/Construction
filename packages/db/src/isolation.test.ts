import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { prisma, withTenantTx, recordAuditLog } from './index';

interface CatalogRow {
  relname: string;
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
}

interface CurrentUserRole {
  current_user: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
}

describe('PostgreSQL Row-Level Security & Multi-Tenancy Isolation Suite (ADR-001 / Milestone M2)', () => {
  let tenantAId: string;
  let tenantBId: string;
  let projectAId: string;
  let projectBId: string;

  beforeAll(async () => {
    // Clean up any test tenants from previous runs
    await prisma.tenant.deleteMany({
      where: {
        slug: { in: ['test-simba-corp', 'test-kilimanjaro-dev'] },
      },
    });

    // 1. Create Tenant A
    const tenantA = await prisma.tenant.create({
      data: {
        name: 'Simba Contractors Ltd',
        slug: 'test-simba-corp',
        kra_pin: 'P051111111A',
        nca_category: 'NCA 3',
        currency: 'KES',
      },
    });
    tenantAId = tenantA.id;

    // 2. Create Tenant B
    const tenantB = await prisma.tenant.create({
      data: {
        name: 'Kilimanjaro Developers Ltd',
        slug: 'test-kilimanjaro-dev',
        kra_pin: 'P052222222B',
        nca_category: 'NCA 1',
        currency: 'KES',
      },
    });
    tenantBId = tenantB.id;

    // 3. Seed Project A in Tenant A via withTenantTx
    await withTenantTx(prisma, tenantAId, async (tx) => {
      const projA = await tx.project.create({
        data: {
          tenant_id: tenantAId,
          name: 'Simba Heights Phase 1',
          code: 'SIMBA-01',
          status: 'ACTIVE',
          original_contract_sum: 50000000.0,
          current_approved_budget: 50000000.0,
        },
      });
      projectAId = projA.id;

      await recordAuditLog(tx, {
        tenantId: tenantAId,
        actorId: '00000000-0000-0000-0000-000000000001',
        action: 'PROJECT_CREATED',
        entityType: 'Project',
        entityId: projA.id,
      });
    });

    // 4. Seed Project B in Tenant B via withTenantTx
    await withTenantTx(prisma, tenantBId, async (tx) => {
      const projB = await tx.project.create({
        data: {
          tenant_id: tenantBId,
          name: 'Kilimanjaro Eco Villas',
          code: 'KILI-01',
          status: 'ACTIVE',
          original_contract_sum: 120000000.0,
          current_approved_budget: 120000000.0,
        },
      });
      projectBId = projB.id;

      await recordAuditLog(tx, {
        tenantId: tenantBId,
        actorId: '00000000-0000-0000-0000-000000000002',
        action: 'PROJECT_CREATED',
        entityType: 'Project',
        entityId: projB.id,
      });
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.tenant.deleteMany({
      where: {
        slug: { in: ['test-simba-corp', 'test-kilimanjaro-dev'] },
      },
    });
    await prisma.$disconnect();
  });

  it('A4 Catalog Verification: asserts that EVERY table with tenant_id has ENABLE and FORCE RLS active', async () => {
    const unsecureTables = await prisma.$queryRaw<CatalogRow[]>`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
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
    `;

    expect(unsecureTables).toHaveLength(0);
  });

  it('A4 Runtime Role Verification: asserts that db_app has NO superuser and NO bypassrls privileges', async () => {
    const roleInfo = await prisma.$queryRaw<CurrentUserRole[]>`
      SELECT current_user, rolsuper, rolbypassrls 
      FROM pg_roles 
      WHERE rolname = current_user
    `;

    expect(roleInfo.length).toBeGreaterThan(0);
    const { rolsuper, rolbypassrls } = roleInfo[0]!;
    expect(rolsuper).toBe(false);
    expect(rolbypassrls).toBe(false);
  });

  it('A5 Isolation: Tenant A context can only see Tenant A projects; Tenant B projects are completely invisible', async () => {
    await withTenantTx(prisma, tenantAId, async (tx) => {
      const projects = await tx.project.findMany();
      const projectIds = projects.map((p) => p.id);

      expect(projectIds).toContain(projectAId);
      expect(projectIds).not.toContain(projectBId);

      // Explicit lookup of Tenant B project by UUID returns null
      const crossTenantLookup = await tx.project.findUnique({
        where: { id: projectBId },
      });
      expect(crossTenantLookup).toBeNull();
    });
  });

  it('A5 Isolation: Tenant B context can only see Tenant B projects; Tenant A projects are completely invisible', async () => {
    await withTenantTx(prisma, tenantBId, async (tx) => {
      const projects = await tx.project.findMany();
      const projectIds = projects.map((p) => p.id);

      expect(projectIds).toContain(projectBId);
      expect(projectIds).not.toContain(projectAId);

      // Explicit lookup of Tenant A project by UUID returns null
      const crossTenantLookup = await tx.project.findUnique({
        where: { id: projectAId },
      });
      expect(crossTenantLookup).toBeNull();
    });
  });

  it('A5 Audit Isolation: Tenant A context can only see Tenant A audit records', async () => {
    await withTenantTx(prisma, tenantAId, async (tx) => {
      const logs = await tx.auditLog.findMany();
      expect(logs.length).toBeGreaterThan(0);

      for (const log of logs) {
        expect(log.tenant_id).toBe(tenantAId);
      }
    });
  });

  it('A5 Cross-Tenant Write Rejection: writing with mismatched tenant_id throws PostgreSQL RLS error', async () => {
    // Scoped to Tenant A, but attempting to insert a row with tenant_id = tenantBId
    await expect(
      withTenantTx(prisma, tenantAId, async (tx) => {
        await tx.project.create({
          data: {
            tenant_id: tenantBId,
            name: 'Malicious Cross-Tenant Injection',
            code: 'INJECT-01',
          },
        });
      }),
    ).rejects.toThrow();
  });

  it('A5 Fail-Closed: direct query without tenant context sees 0 rows in tenant-owned tables', async () => {
    // When executing directly without set_config('app.current_tenant_id'), current_setting evaluates to ''
    // NULLIF('', '') evaluates to NULL, and tenant_id = NULL evaluates to false.
    const unscopedProjects = await prisma.project.findMany();
    expect(unscopedProjects).toHaveLength(0);

    const unscopedLogs = await prisma.auditLog.findMany();
    expect(unscopedLogs).toHaveLength(0);
  });

  it('A2 Rollback Atomicity: unhandled error in withTenantTx rolls back BOTH business record AND audit log', async () => {
    const doomedProjectCode = 'DOOMED-99';

    await expect(
      withTenantTx(prisma, tenantAId, async (tx) => {
        // Step 1: Create project
        const doomedProj = await tx.project.create({
          data: {
            tenant_id: tenantAId,
            name: 'Doomed Project',
            code: doomedProjectCode,
          },
        });

        // Step 2: Write audit log
        await recordAuditLog(tx, {
          tenantId: tenantAId,
          actorId: '00000000-0000-0000-0000-000000000001',
          action: 'PROJECT_CREATED',
          entityType: 'Project',
          entityId: doomedProj.id,
        });

        // Step 3: Throw midway error
        throw new Error('Simulated midway transactional failure for A2 rollback test');
      }),
    ).rejects.toThrow('Simulated midway transactional failure');

    // Assert neither the project nor the audit log was committed
    await withTenantTx(prisma, tenantAId, async (tx) => {
      const proj = await tx.project.findFirst({
        where: { code: doomedProjectCode },
      });
      expect(proj).toBeNull();

      const log = await tx.auditLog.findFirst({
        where: {
          action: 'PROJECT_CREATED',
          changes: { path: ['code'], equals: doomedProjectCode },
        },
      });
      expect(log).toBeNull();
    });
  });
});
