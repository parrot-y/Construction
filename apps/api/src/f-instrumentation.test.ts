import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

// F1/F2: pilot instrumentation — problem reports + operator adoption.
describe('F1/F2: pilot instrumentation', () => {
  const server = buildServer();
  let cookie: string;
  let tenantId: string;

  beforeAll(async () => {
    process.env.OPERATOR_KEY = 'f-test-operator-key';
    await server.ready();
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    cookie = res.headers['set-cookie'] as string;
    tenantId = JSON.parse(res.body).user.tenant.id;
  });

  it('POST /problem-reports stores an audit entry and returns a reference', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/problem-reports',
      headers: { cookie },
      payload: { route: '/projects/abc/costs', description: 'Button did nothing', appVersion: 'test-1.0', lastSentryEventId: 'evt-123' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.reportId).toBeTruthy();
    const logs = await withTenantTx(prisma, tenantId, (tx) =>
      tx.auditLog.findMany({ where: { tenant_id: tenantId, action: 'PROBLEM_REPORT' }, orderBy: { created_at: 'desc' }, take: 1 }),
    );
    expect(logs.length).toBe(1);
    expect((logs[0].changes as Record<string, unknown>).route).toBe('/projects/abc/costs');
  });

  it('POST /problem-reports rejects empty payloads and requires auth', async () => {
    const empty = await server.inject({ method: 'POST', url: '/api/v1/problem-reports', headers: { cookie }, payload: {} });
    expect(empty.statusCode).toBe(400);
    const anon = await server.inject({ method: 'POST', url: '/api/v1/problem-reports', payload: { route: '/x' } });
    expect([401, 403]).toContain(anon.statusCode);
  });

  it('GET /operator/adoption requires the operator key and returns per-tenant metrics', async () => {
    const denied = await server.inject({ method: 'GET', url: '/api/v1/operator/adoption' });
    expect(denied.statusCode).toBe(403);
    const bad = await server.inject({ method: 'GET', url: '/api/v1/operator/adoption', headers: { 'x-operator-key': 'wrong' } });
    expect(bad.statusCode).toBe(403);
    const ok = await server.inject({ method: 'GET', url: '/api/v1/operator/adoption', headers: { 'x-operator-key': 'f-test-operator-key' } });
    expect(ok.statusCode).toBe(200);
    const body = JSON.parse(ok.body);
    const t = body.data.tenants.find((x: { tenant: { id: string } }) => x.tenant.id === tenantId);
    expect(t).toBeTruthy();
    expect(t.users.length).toBeGreaterThan(0);
    expect(typeof t.diaryEntries30d).toBe('number');
    expect(typeof t.invoices30d).toBe('number');
    expect(typeof t.certificates).toBe('number');
  });
});
