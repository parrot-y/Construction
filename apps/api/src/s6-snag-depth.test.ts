import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { enrollAllTenantUsers } from './test-members';

/**
 * Gate-4 S6: Punch/snag list depth — 36-trade taxonomy fields, priority,
 * manager/final-approver accountability, distribution list, cost/schedule
 * impact, private flag, guarded status machine, comments.
 */
describe('Gate-4 S6: Punch list depth', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let tenantAId: string;
  let projectId: string;
  let snagId: string;
  let privateSnagId: string;

  async function createSnag(cookie: string, payload: any, projId = projectId) {
    return server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projId}/snags`,
      headers: { cookie },
      payload,
    });
  }

  async function setStatus(cookie: string, id: string, status: string, extra: any = {}) {
    return server.inject({
      method: 'PUT',
      url: `/api/v1/projects/${projectId}/snags/${id}/status`,
      headers: { cookie },
      payload: { status, ...extra },
    });
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
    qsCookie = (await login('qs@apexbuilders.co.ke')).cookie;

    await withTenantTx(prisma, tenantAId, async (tx) => {
      const proj = await tx.project.create({
        data: {
          tenant_id: tenantAId,
          code: `S6-SNG-${Date.now().toString().slice(-6)}`,
          name: 'S6 Punch List Test Project',
          status: 'ACTIVE',
          original_contract_sum: '5000000.00',
          current_approved_budget: '5000000.00',
        },
      });
      projectId = proj.id;

    });
        await enrollAllTenantUsers(projectId);
  });

  it('creates a full-depth snag with all S6 fields and distribution list', async () => {
    const res = await createSnag(qsCookie, {
      locationBlock: 'Block B',
      locationFloor: '3rd Floor',
      locationRoom: 'Room 310 (Guest Bath)',
      tradeCategory: 'Tiling & Flooring',
      description: 'Hollow-sounding porcelain tiles at shower threshold; re-bed and re-grout',
      severity: 'FUNCTIONAL',
      priority: 'HIGH',
      itemType: 'FINISHES',
      isPrivate: false,
      managerName: 'Site Foreman J. Otieno',
      finalApproverName: 'Arch. Client Rep',
      costImpactKes: '45000.00',
      scheduleImpactDays: 3,
      costCode: 'FIN-02',
      referenceDoc: 'A-310 Rev B',
      dueDate: '2026-08-15',
      identifiedByName: 'Lead QS',
      distributions: [
        { recipientName: 'Consulting Architect', channel: 'EMAIL' },
        { recipientName: 'Client Representative', channel: 'WHATSAPP' },
      ],
    });
    expect(res.statusCode).toBe(201);
    const snag = JSON.parse(res.body);
    snagId = snag.id;

    expect(snag.snag_number).toBe(1);
    expect(snag.status).toBe('OPEN');
    expect(snag.priority).toBe('HIGH');
    expect(snag.item_type).toBe('FINISHES');
    expect(snag.is_private).toBe(false);
    expect(snag.manager_name).toBe('Site Foreman J. Otieno');
    expect(snag.final_approver_name).toBe('Arch. Client Rep');
    expect(snag.cost_impact_kes).toBe('45000');
    expect(snag.schedule_impact_days).toBe(3);
    expect(snag.cost_code).toBe('FIN-02');
    expect(snag.reference_doc).toBe('A-310 Rev B');
    expect(snag.due_date.slice(0, 10)).toBe('2026-08-15');
    expect(snag.distributions).toHaveLength(2);
  });

  it('creates a private snag flagged is_private', async () => {
    const res = await createSnag(qsCookie, {
      locationFloor: 'Roof',
      locationRoom: 'Plant Room',
      tradeCategory: 'Electrical & ELV',
      description: 'Exposed LV panel earthing concern — internal review only',
      severity: 'CRITICAL_SAFETY',
      priority: 'CRITICAL',
      isPrivate: true,
      identifiedByName: 'Safety Officer',
    });
    expect(res.statusCode).toBe(201);
    privateSnagId = JSON.parse(res.body).id;
    expect(JSON.parse(res.body).is_private).toBe(true);
  });

  it('enforces the guarded status machine', async () => {
    // OPEN -> VERIFIED_CLOSED illegal (must pass through review)
    expect((await setStatus(adminCookie, snagId, 'VERIFIED_CLOSED')).statusCode).toBe(400);
    // OPEN -> IN_PROGRESS legal
    expect((await setStatus(qsCookie, snagId, 'IN_PROGRESS')).statusCode).toBe(200);
    // IN_PROGRESS -> READY_FOR_REVIEW
    expect((await setStatus(qsCookie, snagId, 'READY_FOR_REVIEW')).statusCode).toBe(200);
    // READY_FOR_REVIEW -> VERIFIED_CLOSED (final approver closes)
    const closed = await setStatus(adminCookie, snagId, 'VERIFIED_CLOSED', { verifiedByName: 'Arch. Client Rep' });
    expect(closed.statusCode).toBe(200);
    expect(JSON.parse(closed.body).verified_by_name).toBe('Arch. Client Rep');
    // VERIFIED_CLOSED is terminal
    expect((await setStatus(qsCookie, snagId, 'IN_PROGRESS')).statusCode).toBe(400);
    // REJECTED path: OPEN -> REJECTED legal on private snag
    expect((await setStatus(adminCookie, privateSnagId, 'REJECTED')).statusCode).toBe(200);
    expect((await setStatus(qsCookie, privateSnagId, 'IN_PROGRESS')).statusCode).toBe(400);
  });

  it('supports comments and additional distributions on a snag', async () => {
    const c = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/snags/${snagId}/comments`,
      headers: { cookie: qsCookie },
      payload: { body: 'Tile supplier confirmed replacement tiles arrive Friday.' },
    });
    expect(c.statusCode).toBe(201);

    const d = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/snags/${snagId}/distributions`,
      headers: { cookie: qsCookie },
      payload: { recipientName: 'Site Manager', recipientContact: 'site@apex.co.ke', channel: 'IN_APP' },
    });
    expect(d.statusCode).toBe(201);

    const detail = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/snags/${snagId}`,
      headers: { cookie: qsCookie },
    });
    expect(detail.statusCode).toBe(200);
    const body = JSON.parse(detail.body);
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0].body).toContain('replacement tiles');
    expect(body.distributions).toHaveLength(3);
    expect(body.cost_impact_kes).toBe('45000');
  });

  it('returns 404 for snag detail outside project scope', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/snags/00000000-0000-0000-0000-000000000000`,
      headers: { cookie: qsCookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
