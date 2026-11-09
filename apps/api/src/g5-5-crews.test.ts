import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

/**
 * Gate-5 G5-5: Crews — named trade crews, members, project assignment.
 */
describe('Gate-5 G5-5: Crews', () => {
  const server = buildServer();

  let adminCookie: string;
  let supervisorCookie: string;
  let clientCookie: string;
  let tenantAId: string;
  let projectId: string;
  let crewId: string;
  let memberId: string;

  beforeAll(async () => {
    await server.ready();
    const login = async (email: string) => {
      const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return { cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
    };
    const admin = await login('admin@apexbuilders.co.ke');
    adminCookie = admin.cookie;
    tenantAId = admin.body.user.tenant.id;
    supervisorCookie = (await login('supervisor@apexbuilders.co.ke')).cookie;
    clientCookie = (await login('client@apexbuilders.co.ke')).cookie;
    const proj = await withTenantTx(prisma, tenantAId, async (tx) => tx.project.findFirst({ where: { tenant_id: tenantAId } }));
    projectId = proj!.id;
  });

  it('creates crew with project + foreman, then adds members', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/crews', headers: { cookie: supervisorCookie },
      payload: { name: 'Masonry Crew Alpha', trade: 'Masonry', foremanName: 'Test Foreman', projectId },
    });
    expect(res.statusCode).toBe(201);
    crewId = JSON.parse(res.body).data.id;

    const m = await server.inject({
      method: 'POST', url: `/api/v1/crews/${crewId}/members`, headers: { cookie: supervisorCookie },
      payload: { name: 'Worker One', trade: 'Masonry', dailyRateKes: '850.00' },
    });
    expect(m.statusCode).toBe(201);
    memberId = JSON.parse(m.body).data.id;

    const m2 = await server.inject({
      method: 'POST', url: `/api/v1/crews/${crewId}/members`, headers: { cookie: supervisorCookie },
      payload: { name: 'Worker Two' },
    });
    expect(m2.statusCode).toBe(201);
  });

  it('lists crews with member_count + project filter', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/v1/crews?projectId=${projectId}`, headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const crew = body.data.find((c: any) => c.id === crewId);
    expect(crew).toBeTruthy();
    expect(crew.member_count).toBe(2);
    expect(crew.project.code).toBeTruthy();
    expect(parseFloat(crew.daily_cost_kes)).toBe(850);
  });

  it('updates crew fields + deactivates (no hard delete)', async () => {
    const upd = await server.inject({
      method: 'PATCH', url: `/api/v1/crews/${crewId}`, headers: { cookie: supervisorCookie },
      payload: { trade: 'Masonry & Stone', notes: 'Prime crew for facing works' },
    });
    expect(upd.statusCode).toBe(200);
    expect(JSON.parse(upd.body).data.trade).toBe('Masonry & Stone');

    const del = await server.inject({ method: 'DELETE', url: `/api/v1/crews/${crewId}`, headers: { cookie: supervisorCookie } });
    expect(del.statusCode).toBe(200);

    const list = await server.inject({ method: 'GET', url: '/api/v1/crews?status=ACTIVE', headers: { cookie: adminCookie } });
    expect(JSON.parse(list.body).data.some((c: any) => c.id === crewId)).toBe(false);
    const inactive = await server.inject({ method: 'GET', url: '/api/v1/crews?status=INACTIVE', headers: { cookie: adminCookie } });
    expect(JSON.parse(inactive.body).data.some((c: any) => c.id === crewId)).toBe(true);
  });

  it('removes member', async () => {
    const res = await server.inject({ method: 'DELETE', url: `/api/v1/crews/${crewId}/members/${memberId}`, headers: { cookie: supervisorCookie } });
    expect(res.statusCode).toBe(200);
  });

  it('RBAC: client cannot create crew or add member', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/crews', headers: { cookie: clientCookie },
      payload: { name: 'Nope', trade: 'X' },
    });
    expect(res.statusCode).toBe(403);
    // client CAN list (PROJECT_VIEW)
    const list = await server.inject({ method: 'GET', url: '/api/v1/crews', headers: { cookie: clientCookie } });
    expect(list.statusCode).toBe(200);
  });
});
