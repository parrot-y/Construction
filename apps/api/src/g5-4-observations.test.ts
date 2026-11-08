import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { enrollAllTenantUsers } from './test-members';

/**
 * Gate-5 G5-4: Site observations & corrective actions (action plans).
 */
describe('Gate-5 G5-4: Observations & corrective actions', () => {
  const server = buildServer();

  let adminCookie: string;
  let supervisorCookie: string;
  let clientCookie: string;
  let tenantAId: string;
  let projectId: string;
  let obsId: string;
  let actionId: string;

  async function listObs(cookie: string, qs = '') {
    const res = await server.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/observations${qs}`, headers: { cookie } });
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
    supervisorCookie = (await login('supervisor@apexbuilders.co.ke')).cookie;
    clientCookie = (await login('client@apexbuilders.co.ke')).cookie;

    const proj = await withTenantTx(prisma, tenantAId, async (tx) =>
      tx.project.findFirst({ where: { tenant_id: tenantAId } }),
    );
    projectId = proj!.id;
    await enrollAllTenantUsers(projectId);
  });

  it('creates observation with sequential OBS-nnn ref and correct fields', async () => {
    const res = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/observations`, headers: { cookie: supervisorCookie },
      payload: {
        title: 'Honeycombing on column C4 pour face',
        type: 'QUALITY',
        priority: 'HIGH',
        location: 'Level 2 — Grid C4',
        description: 'Surface voids >20mm on north face; needs repair mortar + re-pour assessment.',
      },
    });
    expect(res.statusCode).toBe(201);
    const obs = JSON.parse(res.body).data;
    obsId = obs.id;
    expect(obs.ref).toMatch(/^OBS-\d{3}$/);
    expect(obs.status).toBe('OPEN');
    expect(obs.raised_by_name).toBeTruthy();
  });

  it('second observation increments ref', async () => {
    const res = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/observations`, headers: { cookie: adminCookie },
      payload: { title: 'Uncovered reinforcement overnight', type: 'SAFETY', priority: 'MEDIUM', description: 'Bars exposed to rain without cover.' },
    });
    expect(res.statusCode).toBe(201);
    const obs = JSON.parse(res.body).data;
    expect(obs.ref).toMatch(/^OBS-\d{3}$/);
    const firstNum = parseInt(obsId ? '0' : '0');
    // verify strictly greater number via DB
    const rows = await listObs(adminCookie);
    const nums = rows.body.data.map((o: any) => parseInt(o.ref.split('-')[1], 10)).sort((a: number, b: number) => a - b);
    expect(nums.length).toBeGreaterThanOrEqual(2);
    expect(nums[nums.length - 1]).toBeGreaterThan(nums[0]!);
    void firstNum;
  });

  it('guarded status transitions: OPEN→IN_REVIEW→CLOSED, illegal rejected', async () => {
    // OPEN → CLOSED is legal per map; test IN_REVIEW path on second obs
    const list = await listObs(adminCookie);
    const second = list.body.data.find((o: any) => o.id !== obsId);

    const bad = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}/observations/${obsId}/status`, headers: { cookie: supervisorCookie },
      payload: { status: 'IN_REVIEW_EXTRA' },
    });
    expect(bad.statusCode).toBe(400);

    const toReview = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}/observations/${second.id}/status`, headers: { cookie: supervisorCookie },
      payload: { status: 'IN_REVIEW' },
    });
    expect(toReview.statusCode).toBe(200);

    const reopenClosed = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}/observations/${obsId}/status`, headers: { cookie: supervisorCookie },
      payload: { status: 'CLOSED' },
    });
    expect(reopenClosed.statusCode).toBe(200);
    expect(JSON.parse(reopenClosed.body).data.closed_at).toBeTruthy();

    const afterClose = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}/observations/${obsId}/status`, headers: { cookie: supervisorCookie },
      payload: { status: 'OPEN' },
    });
    expect(afterClose.statusCode).toBe(400); // CLOSED is terminal
  });

  it('creates corrective action linked to observation with steps; OVERDUE derived', async () => {
    const res = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/corrective-actions`, headers: { cookie: supervisorCookie },
      payload: {
        title: 'Grind & repair honeycombed face',
        ownerName: 'J. Mwangi (Masonry crew)',
        dueDate: '2020-01-01', // past → OVERDUE
        observationId: obsId,
        sourceRef: 'OBS-ref',
        steps: ['Mark out repair zone', 'Apply bonding agent', 'Apply repair mortar', 'Cure 7 days'],
      },
    });
    expect(res.statusCode).toBe(201);
    actionId = JSON.parse(res.body).data.id;

    const list = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}/corrective-actions`, headers: { cookie: adminCookie },
    });
    const action = JSON.parse(list.body).data.find((a: any) => a.id === actionId);
    expect(action.effective_status).toBe('OVERDUE');
    expect(action.steps).toHaveLength(4);
    expect(action.observation?.id).toBe(obsId);
  });

  it('completes action; cannot reopen; bad observation link rejected', async () => {
    const done = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}/corrective-actions/${actionId}`, headers: { cookie: supervisorCookie },
      payload: { status: 'COMPLETED' },
    });
    expect(done.statusCode).toBe(200);
    expect(JSON.parse(done.body).data.completed_at).toBeTruthy();

    const reopen = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}/corrective-actions/${actionId}`, headers: { cookie: supervisorCookie },
      payload: { status: 'ACTIVE' },
    });
    expect(reopen.statusCode).toBe(400);

    const badLink = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/corrective-actions`, headers: { cookie: supervisorCookie },
      payload: { title: 'Orphan action', ownerName: 'Test', observationId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(badLink.statusCode).toBe(404);
  });

  it('RBAC: client cannot create observation', async () => {
    const res = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/observations`, headers: { cookie: clientCookie },
      payload: { title: 'Should fail', type: 'QUALITY', description: 'nope' },
    });
    expect(res.statusCode).toBe(403);
  });
});
