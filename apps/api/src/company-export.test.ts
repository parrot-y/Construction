import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

/**
 * Staging hardening — company data export (COMPANY_ADMIN only, audit-logged)
 * and list pagination defaults.
 */
describe('Company data export + pagination', () => {
  const server = buildServer();
  let adminCookie: string;
  let viewerCookie: string;
  let tenantId: string;

  const login = async (email: string, password: string) => {
    const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } });
    return { status: res.statusCode, cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
  };

  beforeAll(async () => {
    await server.ready();
    const admin = await login('admin@apexbuilders.co.ke', 'Password123!');
    expect(admin.status).toBe(200);
    adminCookie = admin.cookie;
    tenantId = admin.body.user.tenant.id;
    const viewer = await login('viewer@apexbuilders.co.ke', 'Password123!');
    expect(viewer.status).toBe(200);
    viewerCookie = viewer.cookie;
  });

  it('rejects non-admin roles', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/company/export', headers: { cookie: viewerCookie } });
    expect(res.statusCode).toBe(403);
  });

  it('exports full company data as JSON for COMPANY_ADMIN', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/company/export?format=json', headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const body = JSON.parse(res.body);
    expect(body.tenantId).toBe(tenantId);
    expect(body.tenant).toBeTruthy();
    expect(Array.isArray(body.memberships)).toBe(true);
    expect(Array.isArray(body.projects)).toBe(true);
    expect(Array.isArray(body.invoices)).toBe(true);
  });

  it('exports a flat CSV per entity', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/company/export?format=csv&entity=projects', headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.body.trim().split('\n');
    expect(lines[0]).toContain('code');
    expect(lines[0]).toContain('name');
    expect(lines.length).toBeGreaterThan(1);
  });

  it('rejects CSV without a known entity', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/company/export?format=csv', headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(400);
  });

  it('writes an audit log entry for each export', async () => {
    const rows = await withTenantTx(prisma, tenantId, (tx) =>
      tx.auditLog.findMany({
        where: { tenant_id: tenantId, action: 'COMPANY_DATA_EXPORTED' },
        orderBy: { created_at: 'desc' },
        take: 5,
      }),
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]!.entity_type).toBe('Tenant');
  });

  it('list endpoints paginate with default limit and page metadata', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.page).toBeTruthy();
    expect(body.page.limit).toBeLessThanOrEqual(200);
    expect(body.page.page).toBe(1);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('limit above 200 is clamped', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/projects?limit=9999', headers: { cookie: adminCookie } });
    const body = JSON.parse(res.body);
    expect(body.page.limit).toBe(200);
  });

  it('/health is liveness and /ready proves DB reachability', async () => {
    const health = await server.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(JSON.parse(health.body).status).toBe('ok');

    const ready = await server.inject({ method: 'GET', url: '/ready' });
    expect(ready.statusCode).toBe(200);
    expect(JSON.parse(ready.body).status).toBe('ready');
  });
});
