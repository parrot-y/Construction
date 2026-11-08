import { describe, expect, it, beforeAll } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { toDecimal } from '@construction/money';
import { enrollAllTenantUsersTx } from './test-members';

/**
 * Gate-4 S3: ADR-010 change-order engine — triggers, assignees, approval
 * limits, OWNER_REVIEW escalation, COEvent trail, client token approval.
 */
describe('Gate-4 S3: Change-order approval limits & lifecycle', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let clientCookie: string;

  let tenantAId: string;
  let projectId: string;
  let qsMembershipId: string;
  let projectMemberId: string;
  let rfiId: string;

  const createdCoIds: string[] = [];

  async function createCo(cookie: string, overrides: any = {}) {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/variations`,
      headers: { cookie },
      payload: {
        title: `CO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        reason: 'Test change order justification',
        items: [{ description: 'Test item', unit: 'ITEM', quantity: '1.0000', unitRate: '10000.0000' }],
        ...overrides,
      },
    });
    return res;
  }

  async function submitCo(cookie: string, coId: string) {
    return server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/variations/${coId}/submit`,
      headers: { cookie },
    });
  }

  async function reviewCo(cookie: string, coId: string, action: string, comments?: string) {
    return server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/variations/${coId}/review`,
      headers: { cookie },
      payload: { action, comments },
    });
  }

  async function projectBudget(): Promise<string> {
    const p = await withTenantTx(prisma, tenantAId, async (tx) =>
      tx.project.findUnique({ where: { id: projectId } }),
    );
    return p!.current_approved_budget.toString();
  }

  beforeAll(async () => {
    await server.ready();

    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    const adminBody = JSON.parse(adminRes.body);
    tenantAId = adminBody.user.tenant.id;
    adminCookie = adminRes.headers['set-cookie'] as string;

    const qsRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'qs@apexbuilders.co.ke', password: 'Password123!' },
    });
    qsCookie = qsRes.headers['set-cookie'] as string;

    const clientRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'client@apexbuilders.co.ke', password: 'Password123!' },
    });
    clientCookie = clientRes.headers['set-cookie'] as string;

    await withTenantTx(prisma, tenantAId, async (tx) => {
      const proj = await tx.project.create({
        data: {
          tenant_id: tenantAId,
          code: `S3-CO-${Date.now().toString().slice(-6)}`,
          name: 'S3 Change Order Test Project',
          status: 'ACTIVE',
          current_approved_budget: '10000000.00',
          original_contract_sum: '10000000.00',
        },
      });
      projectId = proj.id;
    await enrollAllTenantUsersTx(tx, tenantAId, projectId);

      const qsUserRow = await tx.user.findUnique({ where: { email: 'qs@apexbuilders.co.ke' } });
      const qsMembership = await tx.membership.findFirst({
        where: { tenant_id: tenantAId, user_id: qsUserRow!.id },
      });
      qsMembershipId = qsMembership!.id;

      const qsUser = await tx.user.findUnique({ where: { id: qsMembership!.user_id } });
      const pm = await tx.projectMember.upsert({
        where: { project_id_user_id: { project_id: projectId, user_id: qsUser!.id } },
        update: { role: 'PM_QS' },
        create: {
          tenant_id: tenantAId,
          project_id: projectId,
          user_id: qsUser!.id,
          role: 'PM_QS',
        },
      });
      projectMemberId = pm.id;

      const rfi = await tx.rFI.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectId,
          rfi_number: 1,
          title: 'Foundation level query',
          question: 'Confirm founding level for raft?',
          assigned_to_role: 'QS',
          created_by_id: qsUser!.id,
        },
      });
      rfiId = rfi.id;
    });
  });

  // -------------------------------------------------------------------------
  it('creates a CO as DRAFT with trigger, linked RFI, requester and assignees', async () => {
    const res = await createCo(qsCookie, {
      triggerType: 'UNFORESEEN_CONDITION',
      linkedRfiId: rfiId,
      assigneeIds: [projectMemberId],
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body).data;
    expect(body.status).toBe('DRAFT');
    expect(body.trigger_type).toBe('UNFORESEEN_CONDITION');
    expect(body.linked_rfi_id).toBe(rfiId);
    expect(body.requested_by_id).toBeTruthy();
    expect(body.assignees).toHaveLength(1);
    expect(body.events.some((e: any) => e.event === 'CREATED')).toBe(true);
    createdCoIds.push(body.id);
  });

  it('rejects a linked RFI from another project', async () => {
    const res = await createCo(qsCookie, { linkedRfiId: '00000000-0000-0000-0000-000000000000' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects assignees who are not project members', async () => {
    const res = await createCo(qsCookie, { assigneeIds: ['00000000-0000-0000-0000-000000000000'] });
    expect(res.statusCode).toBe(400);
  });

  it('cannot submit a non-draft CO twice (illegal transition)', async () => {
    const create = await createCo(qsCookie);
    const coId = JSON.parse(create.body).data.id;
    createdCoIds.push(coId);

    expect((await submitCo(qsCookie, coId)).statusCode).toBe(200);
    const second = await submitCo(qsCookie, coId);
    expect(second.statusCode).toBe(400);
    expect(JSON.parse(second.body).message).toContain('PM_REVIEW');
  });

  it('PM approves within configured limit; boundary is inclusive', async () => {
    // CO net = 10,000.00 — set QS limit exactly at that amount via company endpoint
    const limitRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/company/members/${qsMembershipId}/co-approval-limit`,
      headers: { cookie: adminCookie },
      payload: { limit: 10000 },
    });
    expect(limitRes.statusCode).toBe(200);
    expect(JSON.parse(limitRes.body).data.coApprovalLimit).toBe('10000.00');

    const budgetBefore = await projectBudget();
    const create = await createCo(qsCookie, {
      items: [{ description: 'Boundary item', unit: 'ITEM', quantity: '1.0000', unitRate: '10000.0000' }],
    });
    const coId = JSON.parse(create.body).data.id;
    createdCoIds.push(coId);
    await submitCo(qsCookie, coId);

    const approve = await reviewCo(qsCookie, coId, 'APPROVE', 'Within limit');
    expect(approve.statusCode).toBe(200);
    const body = JSON.parse(approve.body).data;
    expect(body.status).toBe('APPROVED');
    expect(body.approved_at).not.toBeNull();

    const budgetAfter = await projectBudget();
    expect(toDecimal(budgetAfter).minus(toDecimal(budgetBefore)).toFixed(2)).toBe('10000.00');
  });

  it('PM approval above limit escalates to OWNER_REVIEW without budget change', async () => {
    // Limit is 10,000; this CO is 50,000
    const budgetBefore = await projectBudget();
    const create = await createCo(qsCookie, {
      items: [{ description: 'Large item', unit: 'ITEM', quantity: '1.0000', unitRate: '50000.0000' }],
    });
    const coId = JSON.parse(create.body).data.id;
    createdCoIds.push(coId);
    await submitCo(qsCookie, coId);

    const approve = await reviewCo(qsCookie, coId, 'APPROVE', 'Trying to self-approve large CO');
    expect(approve.statusCode).toBe(200);
    expect(JSON.parse(approve.body).data.status).toBe('OWNER_REVIEW');

    expect(await projectBudget()).toBe(budgetBefore);

    // PM cannot decide OWNER_REVIEW stage
    const pmSecond = await reviewCo(qsCookie, coId, 'APPROVE', 'Still trying');
    expect(pmSecond.statusCode).toBe(403);

    // Owner (client role via review endpoint) approves OWNER_REVIEW
    const ownerApprove = await reviewCo(clientCookie, coId, 'APPROVE', 'Owner approved');
    expect(ownerApprove.statusCode).toBe(200);
    expect(JSON.parse(ownerApprove.body).data.status).toBe('APPROVED');

    const budgetAfter = await projectBudget();
    expect(toDecimal(budgetAfter).minus(toDecimal(budgetBefore)).toFixed(2)).toBe('50000.00');
  });

  it('PM without any configured limit always escalates', async () => {
    await withTenantTx(prisma, tenantAId, async (tx) => {
      await tx.membership.update({ where: { id: qsMembershipId }, data: { co_approval_limit: null } });
    });

    const create = await createCo(qsCookie);
    const coId = JSON.parse(create.body).data.id;
    createdCoIds.push(coId);
    await submitCo(qsCookie, coId);

    const approve = await reviewCo(qsCookie, coId, 'APPROVE');
    expect(JSON.parse(approve.body).data.status).toBe('OWNER_REVIEW');
  });

  it('rejection requires a reason', async () => {
    const create = await createCo(qsCookie);
    const coId = JSON.parse(create.body).data.id;
    createdCoIds.push(coId);
    await submitCo(qsCookie, coId);

    const noReason = await reviewCo(qsCookie, coId, 'REJECT', '');
    expect(noReason.statusCode).toBe(400);

    const rejected = await reviewCo(qsCookie, coId, 'REJECT', 'Not needed per latest drawings');
    expect(rejected.statusCode).toBe(200);
    expect(JSON.parse(rejected.body).data.status).toBe('REJECTED');
  });

  it('void works pre-decision and blocks further transitions', async () => {
    const create = await createCo(qsCookie);
    const coId = JSON.parse(create.body).data.id;
    createdCoIds.push(coId);

    const voided = await reviewCo(qsCookie, coId, 'VOID', 'Duplicate of CO-0001');
    expect(voided.statusCode).toBe(200);
    expect(JSON.parse(voided.body).data.status).toBe('VOID');

    const late = await submitCo(qsCookie, coId);
    expect(late.statusCode).toBe(400);
  });

  it('records a complete COEvent trail', async () => {
    const create = await createCo(qsCookie);
    const coId = JSON.parse(create.body).data.id;
    createdCoIds.push(coId);
    await submitCo(qsCookie, coId);
    await reviewCo(clientCookie, coId, 'REJECT', 'Declined by owner');

    const detail = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/variations/${coId}`,
      headers: { cookie: qsCookie },
    });
    const events = JSON.parse(detail.body).data.events.map((e: any) => e.event);
    expect(events).toEqual(['CREATED', 'SUBMITTED', 'REJECTED']);
  });

  it('client token portal lists COs and approves OWNER_REVIEW with signature', async () => {
    // Escalate a CO to OWNER_REVIEW via PM (no limit configured)
    const create = await createCo(qsCookie);
    const co = JSON.parse(create.body).data;
    createdCoIds.push(co.id);
    await submitCo(qsCookie, co.id);
    await reviewCo(qsCookie, co.id, 'APPROVE');

    // Create CLIENT-type portal link directly (hashed token)
    const rawToken = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await withTenantTx(prisma, tenantAId, async (tx) => {
      await tx.portalAccessLink.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectId,
          portal_type: 'CLIENT',
          stakeholder_name: 'Portal Client',
          token_hash: tokenHash,
          is_active: true,
          expires_at: new Date(Date.now() + 86400000),
        },
      });
    });

    const list = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/client/${rawToken}/change-orders`,
    });
    expect(list.statusCode).toBe(200);
    const listBody = JSON.parse(list.body).data;
    expect(listBody.project.id).toBe(projectId);
    const portalCo = listBody.changeOrders.find((c: any) => c.id === co.id);
    expect(portalCo.status).toBe('OWNER_REVIEW');

    const budgetBefore = await projectBudget();
    const respond = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/client/${rawToken}/change-orders/${co.id}/respond`,
      payload: { action: 'APPROVE', signedName: 'Portal Client', comments: 'Approved via link' },
    });
    expect(respond.statusCode).toBe(200);
    expect(JSON.parse(respond.body).data.status).toBe('APPROVED');

    const budgetAfter = await projectBudget();
    expect(toDecimal(budgetAfter).minus(toDecimal(budgetBefore)).toFixed(2)).toBe('10000.00');

    // Second response rejected — no longer OWNER_REVIEW
    const again = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/client/${rawToken}/change-orders/${co.id}/respond`,
      payload: { action: 'REJECT', signedName: 'Portal Client', comments: 'Changed mind' },
    });
    expect(again.statusCode).toBe(400);
  });

  it('client token portal cannot touch COs outside its project', async () => {
    const rawToken = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await withTenantTx(prisma, tenantAId, async (tx) => {
      await tx.portalAccessLink.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectId,
          portal_type: 'CLIENT',
          stakeholder_name: 'Scoped Client',
          token_hash: tokenHash,
          is_active: true,
          expires_at: new Date(Date.now() + 86400000),
        },
      });
    });

    // CO from the m8 project (different project, same tenant)
    const other = await withTenantTx(prisma, tenantAId, async (tx) => {
      const otherProject = await tx.project.findFirst({ where: { code: { startsWith: 'M8-VAR-' } } });
      if (!otherProject) return null;
      return tx.variationOrder.findFirst({ where: { project_id: otherProject.id } });
    });
    if (!other) return; // m8 suite may not have run yet in this worker

    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/client/${rawToken}/change-orders/${other.id}/respond`,
      payload: { action: 'APPROVE', signedName: 'Scoped Client' },
    });
    expect(res.statusCode).toBe(404);
  });
});
