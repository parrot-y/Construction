import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

/**
 * ROUND I4 — OWNER APPROVE GATE
 *
 * The owner dashboard must only offer Approve when a variation is actually
 * waiting in OWNER_REVIEW. Symmetrically, the API must refuse an APPROVE
 * attempt from an OWNER-role actor while the order is still in PM_REVIEW —
 * owner-side actors decide the owner stage, they do not pre-empt PM/QS review.
 */

describe('I4: owner approve gate', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let ownerCookie: string;
  let tenantId: string;
  let projectId: string;

  const login = async (email: string) => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'Password123!' },
    });
    expect(res.statusCode).toBe(200);
    return res.headers['set-cookie'] as string;
  };

  beforeAll(async () => {
    await server.ready();
    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    const adminBody = JSON.parse(adminRes.body);
    tenantId = adminBody.user.tenant.id;
    adminCookie = adminRes.headers['set-cookie'] as string;
    qsCookie = await login('qs@apexbuilders.co.ke');
    ownerCookie = await login('owner@apexbuilders.co.ke');

    // Fresh project so this suite never collides with other specs' data.
    const code = `I4-GATE-${Date.now().toString().slice(-6)}`;
    const proj = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { cookie: adminCookie },
      payload: {
        name: `I4 Gate Project ${code}`,
        code,
        location: 'Nairobi',
        contractValue: '50000000',
      },
    });
    expect(proj.statusCode, proj.body).toBeLessThan(300);
    const pb = JSON.parse(proj.body);
    projectId = pb.data?.id || pb.id || pb.project?.id;
    expect(projectId).toBeTruthy();

    // Variation endpoints are project-member gated — enroll QS and owner.
    for (const [email, role] of [
      ['qs@apexbuilders.co.ke', 'PM_QS'],
      ['owner@apexbuilders.co.ke', 'OWNER'],
    ] as const) {
      const u = await prisma.user.findUnique({ where: { email } });
      const m = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/members`,
        headers: { cookie: adminCookie },
        payload: { userId: u!.id, role },
      });
      expect([200, 201, 409]).toContain(m.statusCode);
    }
  });

  it('refuses OWNER approve while the variation is still in PM_REVIEW', async () => {
    // QS submits a variation → PM_REVIEW.
    const create = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/variations`,
      headers: { cookie: qsCookie },
      payload: {
        title: 'Additional boundary wall',
        reason: 'Client requested extended perimeter walling',
        timeExtensionDays: 3,
        items: [{ description: 'Boundary wall extension', unit: 'LM', quantity: '40.0000', unitRate: '12000.0000' }],
      },
    });
    expect(create.statusCode, create.body).toBe(201);
    const varId = JSON.parse(create.body).data.id;

    const submit = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/variations/${varId}/submit`,
      headers: { cookie: qsCookie },
    });
    expect(submit.statusCode, submit.body).toBeLessThan(300);

    // Owner attempts to approve during PM review — must be refused.
    const ownerApprove = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/variations/${varId}/review`,
      headers: { cookie: ownerCookie },
      payload: { action: 'APPROVE', comments: 'Owner pre-empting PM review' },
    });
    expect(ownerApprove.statusCode).toBe(409);

    // The order must remain in PM_REVIEW — no silent escalation either.
    const after = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/variations/${varId}`,
      headers: { cookie: adminCookie },
    });
    const status = JSON.parse(after.body).data?.status;
    expect(status).toBe('PM_REVIEW');
  });

  it('still lets the owner approve once the order reaches OWNER_REVIEW', async () => {
    // Reuse a fresh variation; escalate via PM_QS (no co_approval_limit).
    const create = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/variations`,
      headers: { cookie: qsCookie },
      payload: {
        title: 'Lobby finishes upgrade',
        reason: 'Client upgraded lobby stone specification',
        timeExtensionDays: 0,
        items: [{ description: 'Premium stone cladding', unit: 'SM', quantity: '120.0000', unitRate: '9500.0000' }],
      },
    });
    const varId = JSON.parse(create.body).data.id;
    await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/variations/${varId}/submit`,
      headers: { cookie: qsCookie },
    });
    const escalate = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/variations/${varId}/review`,
      headers: { cookie: qsCookie },
      payload: { action: 'APPROVE', comments: 'Escalating to owner' },
    });
    expect(JSON.parse(escalate.body).data.status).toBe('OWNER_REVIEW');

    // Give the owner a co-approval limit so they can finally decide.
    const owner = await prisma.user.findUnique({ where: { email: 'owner@apexbuilders.co.ke' } });
    await withTenantTx(prisma, tenantId, async (tx) => {
      await tx.membership.updateMany({
        where: { tenant_id: tenantId, user_id: owner!.id },
        data: { co_approval_limit: '5000000.00' },
      });
    });

    const ownerApprove = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/variations/${varId}/review`,
      headers: { cookie: ownerCookie },
      payload: { action: 'APPROVE', comments: 'Approved by owner' },
    });
    expect(ownerApprove.statusCode, ownerApprove.body).toBe(200);
    expect(JSON.parse(ownerApprove.body).data.status).toBe('APPROVED');
  });
});
