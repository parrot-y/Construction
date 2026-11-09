import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { enrollAllTenantUsers } from './test-members';

/**
 * Gate-5 G5-10: Daily attendance — Today register, check-in/out,
 * leave/off-day reporting, history.
 */
describe('Gate-5 G5-10: Daily attendance', () => {
  const server = buildServer();

  let adminCookie: string;
  let supervisorCookie: string;
  let clientCookie: string;
  let projectId: string;
  let laborerId: string;
  let laborer2Id: string;

  beforeAll(async () => {
    await server.ready();
    const login = async (email: string) => {
      const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return { cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
    };
    adminCookie = (await login('admin@apexbuilders.co.ke')).cookie;
    supervisorCookie = (await login('supervisor@apexbuilders.co.ke')).cookie;
    clientCookie = (await login('client@apexbuilders.co.ke')).cookie;
    const res = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie: adminCookie } });
    projectId = JSON.parse(res.body).data[0].id;
    await enrollAllTenantUsers(projectId);
    // seed laborers directly (unique national_id avoids rerun collisions)
    const loginBody = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' } });
    const tenantId = JSON.parse(loginBody.body).user.tenant.id;
    const created = await withTenantTx(prisma, tenantId, async (tx) => {
      const l1 = await tx.siteLaborer.create({
        data: { tenant_id: tenantId, project_id: projectId, worker_code: 'WK-TEST-1', full_name: 'ZZ Attendance Worker One', national_id_no: `ATT-${Date.now()}-R1`, trade_category: 'CASUAL_LABORER', phone_number: '+254700000001', daily_rate_kes: 500 },
      });
      const l2 = await tx.siteLaborer.create({
        data: { tenant_id: tenantId, project_id: projectId, worker_code: 'WK-TEST-2', full_name: 'ZZ Attendance Worker Two', national_id_no: `ATT-${Date.now()}-R2`, trade_category: 'MASON', phone_number: '+254700000002', daily_rate_kes: 900 },
      });
      return [l1.id, l2.id];
    });
    laborerId = created[0]!;
    laborer2Id = created[1]!;
  });

  it('check-in creates PRESENT row; double check-in rejected; check-out computes hours', async () => {
    const ci = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/attendance/check-in`, headers: { cookie: supervisorCookie },
      payload: { laborerId },
    });
    expect(ci.statusCode).toBe(200);
    expect(JSON.parse(ci.body).data.status).toBe('PRESENT');
    expect(JSON.parse(ci.body).data.check_in_at).toBeTruthy();

    const dup = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/attendance/check-in`, headers: { cookie: supervisorCookie },
      payload: { laborerId },
    });
    expect(dup.statusCode).toBe(400);

    const co = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/attendance/check-out`, headers: { cookie: supervisorCookie },
      payload: { laborerId },
    });
    expect(co.statusCode).toBe(200);
    const row = JSON.parse(co.body).data;
    expect(row.check_out_at).toBeTruthy();
    expect(parseFloat(row.hours_worked)).toBeGreaterThanOrEqual(0);
  });

  it('records LEAVE + OFF_DAY + HALF_DAY statuses via upsert', async () => {
    for (const [laborer, status] of [[laborerId, 'LEAVE'], [laborer2Id, 'OFF_DAY']] as const) {
      const res = await server.inject({
        method: 'POST', url: `/api/v1/projects/${projectId}/attendance`, headers: { cookie: supervisorCookie },
        payload: { laborerId: laborer, status, notes: 'ZZ-RESEARCH test entry' },
      });
      expect([200, 201]).toContain(res.statusCode); // upsert: 201 new / 200 existing
    }
    // upsert same laborer to HALF_DAY → 200 update
    const upd = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/attendance`, headers: { cookie: supervisorCookie },
      payload: { laborerId, status: 'HALF_DAY' },
    });
    expect(upd.statusCode).toBe(200);
  });

  it('today register returns rows + laborers + summary counts', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/attendance`, headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.laborers.length).toBeGreaterThanOrEqual(2);
    expect(body.data.some((r: any) => r.laborer_id === laborerId)).toBe(true);
    expect(body.summary).toBeTruthy();
  });

  it('history range filter works', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/attendance?from=2020-01-01&to=2030-12-31`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.length).toBeGreaterThanOrEqual(2);
  });

  it('RBAC: client cannot record attendance', async () => {
    const res = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/attendance`, headers: { cookie: clientCookie },
      payload: { laborerId, status: 'PRESENT' },
    });
    expect(res.statusCode).toBe(403);
    // client CAN read
    const read = await server.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/attendance`, headers: { cookie: clientCookie } });
    expect(read.statusCode).toBe(200);
  });
});
