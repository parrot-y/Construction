import { describe, expect, it, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { createPrismaClient } from '@construction/db';

describe('Milestone M10: Hardening & Backup-Restore Verification Suite', () => {
  const PG_BIN = process.env.PG_BIN || '/usr/lib/postgresql/18/bin';
  const PG_SOCKET = '/tmp';
  const PG_PORT = '54329';
  const SOURCE_DB = 'construction_test';
  const RESTORE_DB = 'construction_restore_test';
  const SUPERUSER = 'maskgod';

  const runPsql = (db: string, sql: string, user = SUPERUSER): string => {
    return execSync(`${PG_BIN}/psql -h ${PG_SOCKET} -p ${PG_PORT} -U ${user} -d ${db} -t -A -c "${sql.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
    }).trim();
  };

  afterAll(async () => {
    try {
      execSync(`${PG_BIN}/dropdb -h ${PG_SOCKET} -p ${PG_PORT} -U ${SUPERUSER} --if-exists ${RESTORE_DB}`, {
        stdio: 'ignore',
      });
    } catch {
      // ignore
    }
  });

  it('successfully creates a full dump of construction_test using pg_dump', () => {
    const dumpCmd = `${PG_BIN}/pg_dump -h ${PG_SOCKET} -p ${PG_PORT} -U ${SUPERUSER} -d ${SOURCE_DB}`;
    const dumpOutput = execSync(dumpCmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });

    expect(dumpOutput).toContain('PostgreSQL database dump');
    expect(dumpOutput).toContain('CREATE TABLE public.tenants');
    expect(dumpOutput).toContain('CREATE TABLE public.projects');
    expect(dumpOutput).toContain('ALTER TABLE ONLY public.projects FORCE ROW LEVEL SECURITY');
    expect(dumpOutput).toContain('CREATE POLICY tenant_isolation_policy ON public.projects');
  });

  it('restores the dumped schema and data into construction_restore_test', () => {
    // 1. Drop existing restore db if any and recreate clean database
    execSync(`${PG_BIN}/dropdb -h ${PG_SOCKET} -p ${PG_PORT} -U ${SUPERUSER} --if-exists ${RESTORE_DB}`);
    execSync(`${PG_BIN}/createdb -h ${PG_SOCKET} -p ${PG_PORT} -U ${SUPERUSER} ${RESTORE_DB}`);

    // 2. Dump and stream restore via pipe
    const pipeCmd = `${PG_BIN}/pg_dump -h ${PG_SOCKET} -p ${PG_PORT} -U ${SUPERUSER} -d ${SOURCE_DB} | ${PG_BIN}/psql -h ${PG_SOCKET} -p ${PG_PORT} -U ${SUPERUSER} -d ${RESTORE_DB} -q`;
    execSync(pipeCmd, { shell: '/bin/bash' });

    const tableCount = runPsql(RESTORE_DB, "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';");
    expect(parseInt(tableCount, 10)).toBeGreaterThanOrEqual(20);
  });

  it('verifies all tables and RLS policies survived the dump/restore perfectly', () => {
    const tenantScopedTables = [
      'projects',
      'project_members',
      'boqs',
      'boq_sections',
      'boq_items',
      'cost_entries',
      'cost_receipts',
      'cost_approvals',
      'site_diaries',
      'site_photos',
      'labor_headcounts',
      'material_deliveries',
      'progress_records',
      'progress_items',
      'variation_orders',
      'variation_items',
      'audit_logs',
      'idempotency_keys',
    ];

    // 1. Check relrowsecurity and relforcerowsecurity on all tenant scoped tables
    for (const table of tenantScopedTables) {
      const rowSec = runPsql(RESTORE_DB, `SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = '${table}';`);
      const forceSec = runPsql(RESTORE_DB, `SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = '${table}';`);

      expect(rowSec, `Table ${table} must have relrowsecurity = t`).toBe('t');
      expect(forceSec, `Table ${table} must have relforcerowsecurity = t`).toBe('t');
    }

    // 2. Verify tenant_isolation_policy on all tenant scoped tables
    const policiesList = runPsql(RESTORE_DB, "SELECT tablename FROM pg_policies WHERE schemaname = 'public' AND policyname = 'tenant_isolation_policy';");
    const foundTables = policiesList.split('\n').map((s) => s.trim());

    for (const table of tenantScopedTables) {
      expect(foundTables).toContain(table);
    }
  });

  it('verifies strict fail-closed tenancy and non-superuser role enforcement on restored database', async () => {
    // 1. Verify db_app attributes on restored DB
    const superuserStatus = runPsql(RESTORE_DB, "SELECT rolsuper FROM pg_roles WHERE rolname = 'db_app';");
    const bypassStatus = runPsql(RESTORE_DB, "SELECT rolbypassrls FROM pg_roles WHERE rolname = 'db_app';");
    expect(superuserStatus).toBe('f');
    expect(bypassStatus).toBe('f');

    // 2. Querying projects via db_app without setting tenant context returns 0 rows (fail-closed)
    const restoreDbUrl = `postgresql://db_app:app_secret@localhost:${PG_PORT}/${RESTORE_DB}?host=${PG_SOCKET}&schema=public`;
    const restoreClient = createPrismaClient(restoreDbUrl);

    try {
      // Direct raw query without tenant context
      const emptyProjects = await restoreClient.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM projects`;
      expect(Number(emptyProjects[0]?.count || 0)).toBe(0);

      // 3. Find source tenant with projects
      const sourceTenantRes = runPsql(SOURCE_DB, 'SELECT tenant_id FROM projects GROUP BY tenant_id ORDER BY COUNT(*) DESC LIMIT 1;');
      const targetTenantId = sourceTenantRes.trim();

      if (targetTenantId) {
        const expectedCountStr = runPsql(SOURCE_DB, `SELECT COUNT(*) FROM projects WHERE tenant_id = '${targetTenantId}';`);
        const expectedCount = parseInt(expectedCountStr, 10);

        // Execute inside transaction setting tenant context
        const result = await restoreClient.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${targetTenantId}, TRUE)`;
          const res = await tx.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM projects`;
          return Number(res[0]?.count || 0);
        });

        expect(result).toBe(expectedCount);
      }
    } finally {
      await restoreClient.$disconnect();
    }
  });
});
