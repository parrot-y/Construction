import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import type { FastifyInstance } from 'fastify';

/** B1: per-tenant module flags — pilot tenant gets 404 on non-core modules. */
describe('Tenant module flags (B1)', () => {
  let server: FastifyInstance;
  let cookie: string;
  let tenantId: string;
  const OPERATOR_KEY = 'test-operator-key';

  beforeAll(async () => {
    process.env.OPERATOR_KEY = OPERATOR_KEY;
    server = buildServer();
    const login = await server.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    cookie = login.headers['set-cookie'] as string;
    const me = await server.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie } });
    tenantId = JSON.parse(me.body).user.tenant.id;
  });

  afterAll(async () => {
    await server.close();
    delete process.env.OPERATOR_KEY;
  });

  it('seed tenant has all gated modules enabled', async () => {
    const projects = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie } });
    const projectId = JSON.parse(projects.body).data[0].id;
    const res = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}/tenders`, headers: { cookie },
    });
    expect(res.statusCode).not.toBe(404);
  });

  it('operator can disable a module → API returns 404, core still works', async () => {
    const projects = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie } });
    const projectId = JSON.parse(projects.body).data[0].id;

    const put = await server.inject({
      method: 'PUT',
      url: `/api/v1/operator/tenants/${tenantId}/modules`,
      headers: { 'x-operator-key': OPERATOR_KEY, 'content-type': 'application/json' },
      payload: { modules: { tenders: false, telematics: false } },
    });
    expect(put.statusCode).toBe(200);

    const tenders = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}/tenders`, headers: { cookie },
    });
    expect(tenders.statusCode).toBe(404);
    const telematics = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}/telematics-devices`, headers: { cookie },
    });
    expect(telematics.statusCode).toBe(404);

    // Core module unaffected.
    const diaries = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}/site-diaries`, headers: { cookie },
    });
    expect(diaries.statusCode).not.toBe(404);

    // Re-enable for other tests.
    await server.inject({
      method: 'PUT',
      url: `/api/v1/operator/tenants/${tenantId}/modules`,
      headers: { 'x-operator-key': OPERATOR_KEY, 'content-type': 'application/json' },
      payload: { modules: { tenders: true, telematics: true } },
    });
    const again = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}/tenders`, headers: { cookie },
    });
    expect(again.statusCode).not.toBe(404);
  });

  it('absent flag row = OFF for non-core modules (pilot default)', async () => {
    // Simulate a pilot tenant: remove the flag rows entirely.
    await withTenantTx(prisma, tenantId, (tx) => tx.tenantModuleFlag.deleteMany({ where: { tenant_id: tenantId } }));
    const projects = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie } });
    const projectId = JSON.parse(projects.body).data[0].id;
    const tenders = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}/tenders`, headers: { cookie },
    });
    expect(tenders.statusCode).toBe(404);
    // Core still reachable.
    const projectsRes = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie } });
    expect(projectsRes.statusCode).toBe(200);
    // Restore seed state for subsequent suites.
    const GATED = ['equipment','telematics','soil','survey','tenders','steel','asphalt','geofence','rmc','muster','independent','rebar','safety','correspondence','inventory'];
    for (const m of GATED) {
      await withTenantTx(prisma, tenantId, (tx) => tx.tenantModuleFlag.upsert({
        where: { tenant_id_module: { tenant_id: tenantId, module: m } },
        update: { enabled: true },
        create: { tenant_id: tenantId, module: m, enabled: true, updated_by: 'test-restore' },
      }));
    }
  });

  it('company/modules endpoint reports enabled flags for the session tenant', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/company/modules', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const mods = JSON.parse(res.body).data.modules;
    expect(mods).toContain('tenders');
    expect(mods).toContain('telematics');
  });

  it('operator endpoints reject bad/missing key', async () => {
    const bad = await server.inject({
      method: 'GET', url: `/api/v1/operator/tenants/${tenantId}/modules`,
      headers: { 'x-operator-key': 'wrong' },
    });
    expect(bad.statusCode).toBe(403);
  });
});
