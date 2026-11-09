import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { enrollAllTenantUsers } from './test-members';

/**
 * Gate-4 S8: Project onboarding & edit — observed Edit-project modal parity:
 * contract value + currency, map pin, money-at-risk, status lifecycle,
 * possession/completion dates, PM/Architect/QS assignment, manual progress.
 */
describe('Gate-4 S8: Project onboarding & edit', () => {
  const server = buildServer();

  let adminCookie: string;
  let supervisorCookie: string;
  let tenantAId: string;
  let projectId: string;
  let qsUserId: string;

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

    const qsUser = await prisma.user.findFirst({ where: { email: 'qs@apexbuilders.co.ke' } });
    qsUserId = qsUser!.id;
  });

  it('creates a project with the full onboarding payload', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { cookie: adminCookie },
      payload: {
        name: 'Kileleshwa Boutique Hotel',
        code: `KBH-${Date.now().toString().slice(-6)}`,
        description: '12-storey boutique hotel, Westlands',
        location: 'Kileleshwa, Nairobi',
        mapLatitude: '-1.2765',
        mapLongitude: '36.7820',
        contractValue: '48000000.00',
        contractCurrency: 'KES',
        moneyAtRiskKes: '2400000.00',
        ncaProjectNo: 'NCA/2026/0881',
        status: 'PLANNING',
        startDate: '2026-12-01',
        targetEndDate: '2028-06-30',
      },
    });
    expect(res.statusCode).toBe(201);
    const p = JSON.parse(res.body).data;
    projectId = p.id;
    await enrollAllTenantUsers(projectId);
    expect(p.status).toBe('PLANNING');
    expect(p.original_contract_sum).toBe('48000000');
    expect(p.current_approved_budget).toBe('48000000');
    expect(p.contract_currency).toBe('KES');
    expect(p.map_latitude).toBe('-1.2765');
    expect(p.map_longitude).toBe('36.782');
    expect(p.money_at_risk_kes).toBe('2400000');
    expect(p.start_date.slice(0, 10)).toBe('2026-12-01');
    expect(p.target_end_date.slice(0, 10)).toBe('2028-06-30');
    // Creator auto-assigned PROJECT_LEAD (verify via detail endpoint)
    const detail = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}`, headers: { cookie: adminCookie },
    });
    expect(JSON.parse(detail.body).data.members.some((m: any) => m.role === 'PROJECT_LEAD')).toBe(true);
  });

  it('PATCH updates contract value and syncs approved budget while un-diverged', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}`,
      headers: { cookie: adminCookie },
      payload: { contractValue: '50000000.00', status: 'ON_TRACK' },
    });
    expect(res.statusCode).toBe(200);
    const p = JSON.parse(res.body).data;
    expect(p.original_contract_sum).toBe('50000000');
    expect(p.current_approved_budget).toBe('50000000'); // still in sync (no variations yet)
    expect(p.status).toBe('ON_TRACK');
  });

  it('PATCH does NOT clobber approved budget once variations diverge it', async () => {
    await withTenantTx(prisma, tenantAId, async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { current_approved_budget: '51500000.00' },
      });
    });
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}`,
      headers: { cookie: adminCookie },
      payload: { contractValue: '52000000.00' },
    });
    const p = JSON.parse(res.body).data;
    expect(p.original_contract_sum).toBe('52000000');
    expect(p.current_approved_budget).toBe('51500000'); // preserved — variation-driven
  });

  it('PATCH progressPct writes a real ProgressRecord', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}`,
      headers: { cookie: adminCookie },
      payload: { progressPct: '42.5' },
    });
    expect(res.statusCode).toBe(200);
    const rec = await withTenantTx(prisma, tenantAId, async (tx) =>
      tx.progressRecord.findFirst({ where: { project_id: projectId }, orderBy: { created_at: 'desc' } }),
    );
    expect(rec).toBeTruthy();
    expect(parseFloat(rec!.overall_progress.toString())).toBeCloseTo(0.425, 4);

    // Out-of-range rejected
    const bad = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}`,
      headers: { cookie: adminCookie },
      payload: { progressPct: '150' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('PATCH validates payload: empty body, bad status, bad money', async () => {
    expect((await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}`, headers: { cookie: adminCookie }, payload: {},
    })).statusCode).toBe(400);
    expect((await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}`, headers: { cookie: adminCookie }, payload: { status: 'EXPLODED' },
    })).statusCode).toBe(400);
    expect((await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}`, headers: { cookie: adminCookie }, payload: { contractValue: 'abc' },
    })).statusCode).toBe(400);
  });

  it('assigns PM/Architect/QS roles via members endpoint and removes them', async () => {
    for (const role of ['QS', 'ARCHITECT'] as const) {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/members`,
        headers: { cookie: adminCookie },
        payload: { userId: qsUserId, role },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.role).toBe(role);
    }
    // empty role rejected
    expect((await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/members`, headers: { cookie: adminCookie },
      payload: { userId: qsUserId, role: '' },
    })).statusCode).toBe(400);

    const detail = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}`, headers: { cookie: adminCookie },
    });
    const members = JSON.parse(detail.body).data.members;
    expect(members.filter((m: any) => m.user_id === qsUserId || m.user?.id === qsUserId).length).toBeGreaterThanOrEqual(1);

    await server.inject({
      method: 'DELETE', url: `/api/v1/projects/${projectId}/members/${qsUserId}`, headers: { cookie: adminCookie },
    });
  });

  it('enforces RBAC: site supervisor cannot edit projects', async () => {
    const res = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}`, headers: { cookie: supervisorCookie },
      payload: { name: 'Hijacked Name' },
    });
    expect(res.statusCode).toBe(403);
  });
});
