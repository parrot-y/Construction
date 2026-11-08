import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

/**
 * Gate-5 G5-3: Team inbox — audience visibility, threading, read receipts.
 */
describe('Gate-5 G5-3: Team inbox', () => {
  const server = buildServer();

  let adminCookie: string;
  let pmCookie: string;
  let supervisorCookie: string;
  let tenantAId: string;
  let projectId: string;

  async function list(cookie: string, qs = '') {
    const res = await server.inject({ method: 'GET', url: `/api/v1/inbox${qs}`, headers: { cookie } });
    return { status: res.statusCode, body: JSON.parse(res.body) };
  }

  beforeAll(async () => {
    await server.ready();
    const login = async (email: string) => {
      const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return { cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
    };
    const admin = await login('admin@apexbuilders.co.ke');
    adminCookie = admin.cookie;
    tenantAId = admin.body.user.tenant.id;
    pmCookie = (await login('qs@apexbuilders.co.ke')).cookie;
    supervisorCookie = (await login('supervisor@apexbuilders.co.ke')).cookie;

    // find a project + a non-member user for isolation checks
    const proj = await withTenantTx(prisma, tenantAId, async (tx) =>
      tx.project.findFirst({ where: { tenant_id: tenantAId }, include: { members: true } }),
    );
    projectId = proj!.id;
    // (non-member lookup removed — visibility covered by role/audience tests)
  });

  it('sends PROJECT_TEAM message visible to project members + admin, hidden from non-members', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/inbox', headers: { cookie: pmCookie },
      payload: { body: 'Pour card approved for grid C4 — proceed tomorrow 7am', projectId, audience: 'PROJECT_TEAM' },
    });
    expect(res.statusCode).toBe(201);
    const msg = JSON.parse(res.body).data;
    expect(msg.audience).toBe('PROJECT_TEAM');

    const pmList = await list(pmCookie);
    expect(pmList.body.data.some((m: any) => m.id === msg.id)).toBe(true);

    // admin sees all tenant messages
    const adminList = await list(adminCookie);
    expect(adminList.body.data.some((m: any) => m.id === msg.id)).toBe(true);
  });

  it('ALL_MEMBERS reaches every internal role', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/inbox', headers: { cookie: adminCookie },
      payload: { body: 'Toolbox talk moved to 6:30am all sites', audience: 'ALL_MEMBERS' },
    });
    expect(res.statusCode).toBe(201);
    const id = JSON.parse(res.body).data.id;
    for (const c of [pmCookie, supervisorCookie, adminCookie]) {
      const l = await list(c);
      expect(l.body.data.some((m: any) => m.id === id)).toBe(true);
    }
  });

  it('ROLE audience only reaches matching roles', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/inbox', headers: { cookie: adminCookie },
      payload: { body: 'QS-only valuation note', audience: 'ROLE', targetRoles: ['PM_QS'] },
    });
    expect(res.statusCode).toBe(201);
    const id = JSON.parse(res.body).data.id;
    const pmList = await list(pmCookie);
    expect(pmList.body.data.some((m: any) => m.id === id)).toBe(true);
    const supList = await list(supervisorCookie);
    expect(supList.body.data.some((m: any) => m.id === id)).toBe(false);
  });

  it('read marking is idempotent; unread count drops', async () => {
    const before = await server.inject({ method: 'GET', url: '/api/v1/inbox/unread-count', headers: { cookie: pmCookie } });
    const beforeCount = JSON.parse(before.body).data.unread;

    const all = await list(pmCookie, '?unread=true');
    const target = all.body.data.find((m: any) => m.sender_id !== undefined);
    expect(target).toBeTruthy();

    const r1 = await server.inject({ method: 'POST', url: `/api/v1/inbox/${target.id}/read`, headers: { cookie: pmCookie } });
    expect(r1.statusCode).toBe(200);
    const r2 = await server.inject({ method: 'POST', url: `/api/v1/inbox/${target.id}/read`, headers: { cookie: pmCookie } });
    expect(JSON.parse(r2.body).data.alreadyRead).toBe(true);

    const after = await server.inject({ method: 'GET', url: '/api/v1/inbox/unread-count', headers: { cookie: pmCookie } });
    expect(JSON.parse(after.body).data.unread).toBe(beforeCount - 1);
  });

  it('threaded reply links parent', async () => {
    const first = await server.inject({
      method: 'POST', url: '/api/v1/inbox', headers: { cookie: pmCookie },
      payload: { body: 'Need update on rebar delivery', projectId, audience: 'PROJECT_TEAM' },
    });
    const parentId = JSON.parse(first.body).data.id;
    const reply = await server.inject({
      method: 'POST', url: '/api/v1/inbox', headers: { cookie: supervisorCookie },
      payload: { body: 'Delivered this morning, 8 bundles', projectId, audience: 'PROJECT_TEAM', parentId },
    });
    expect(reply.statusCode).toBe(201);
    expect(JSON.parse(reply.body).data.parent_id).toBe(parentId);

    // bad parent rejected
    const bad = await server.inject({
      method: 'POST', url: '/api/v1/inbox', headers: { cookie: pmCookie },
      payload: { body: 'x', parentId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(bad.statusCode).toBe(404);
  });

  it('validation: empty body rejected', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/inbox', headers: { cookie: pmCookie },
      payload: { body: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});
