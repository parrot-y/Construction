import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx, hashPassword } from '@construction/db';
import { toDecimal } from '@construction/money';

describe('Milestone M8: Variations Workflow Suite', () => {
  const server = buildServer();

  let qsCookie: string;
  let supervisorCookie: string;
  let clientCookie: string;
  let tenantBCookie: string;

  let tenantAId: string;
  let projectAId: string;
  let sampleBoqItemId: string;

  let variation1Id: string;
  let variation2Id: string;

  beforeAll(async () => {
    await server.ready();

    // 1. Login as Apex Builders Admin
    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    const adminBody = JSON.parse(adminRes.body);
    tenantAId = adminBody.user.tenant.id;

    // 2. Login as QS
    const qsRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'qs@apexbuilders.co.ke', password: 'Password123!' },
    });
    qsCookie = qsRes.headers['set-cookie'] as string;

    // 3. Login as Site Supervisor
    const supRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'supervisor@apexbuilders.co.ke', password: 'Password123!' },
    });
    supervisorCookie = supRes.headers['set-cookie'] as string;

    // 4. Login as Client
    const clientRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'client@apexbuilders.co.ke', password: 'Password123!' },
    });
    clientCookie = clientRes.headers['set-cookie'] as string;

    // 5. Seed and Login as Tenant B (Kilimanjaro Contractors Ltd Admin)
    const defaultPasswordHash = await hashPassword('Password123!');
    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-b-m8' },
      update: {},
      create: {
        name: 'Kilimanjaro Contractors Ltd',
        slug: 'test-tenant-b-m8',
        currency: 'KES',
      },
    });

    const userB = await prisma.user.upsert({
      where: { email: 'admin@kilimanjarocontractors-m8.co.ke' },
      update: { password_hash: defaultPasswordHash },
      create: {
        email: 'admin@kilimanjarocontractors-m8.co.ke',
        password_hash: defaultPasswordHash,
        full_name: 'Juma Bakari',
        is_active: true,
      },
    });

    await withTenantTx(prisma, tenantB.id, async (tx) => {
      await tx.membership.upsert({
        where: {
          tenant_id_user_id: {
            tenant_id: tenantB.id,
            user_id: userB.id,
          },
        },
        update: { role: 'COMPANY_ADMIN' },
        create: {
          tenant_id: tenantB.id,
          user_id: userB.id,
          role: 'COMPANY_ADMIN',
        },
      });

      // Seed Project B for Tenant B
      await tx.project.upsert({
        where: { tenant_id_code: { tenant_id: tenantB.id, code: 'KIL-M8-01' } },
        update: {},
        create: {
          tenant_id: tenantB.id,
          name: 'Kilimanjaro Heights Tower',
          code: 'KIL-M8-01',
          original_contract_sum: '75000000.00',
          current_approved_budget: '75000000.00',
        },
      });
    });

    const tbRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@kilimanjarocontractors-m8.co.ke', password: 'Password123!' },
    });
    tenantBCookie = tbRes.headers['set-cookie'] as string;

    // Create dedicated Project and BOQ item for Tenant A Milestone M8 verification
    await withTenantTx(prisma, tenantAId, async (tx) => {
      const proj = await tx.project.upsert({
        where: { tenant_id_code: { tenant_id: tenantAId, code: 'M8-VAR-2026' } },
        update: {
          current_approved_budget: '45000000.00',
          original_contract_sum: '45000000.00',
          status: 'ACTIVE',
        },
        create: {
          tenant_id: tenantAId,
          code: 'M8-VAR-2026',
          name: 'Riverside Commercial Plaza M8',
          status: 'ACTIVE',
          current_approved_budget: '45000000.00',
          original_contract_sum: '45000000.00',
        },
      });
      projectAId = proj.id;

      // Clean existing variations for pristine test run
      await tx.variationItem.deleteMany({ where: { variation_order: { project_id: proj.id } } });
      await tx.variationOrder.deleteMany({ where: { project_id: proj.id } });

      // Clean and seed a dedicated BOQ item for this project
      const existingBoq = await tx.bOQ.findFirst({
        where: { project_id: proj.id },
      });
      let boqId = existingBoq?.id;
      if (!boqId) {
        const boq = await tx.bOQ.create({
          data: {
            tenant_id: tenantAId,
            project_id: proj.id,
            version: 1,
            total_amount: '45000000.00',
            status: 'APPROVED',
          },
        });
        boqId = boq.id;
      }

      const existingSec = await tx.bOQSection.findFirst({
        where: { boq_id: boqId },
      });
      let secId = existingSec?.id;
      if (!secId) {
        const sec = await tx.bOQSection.create({
          data: {
            tenant_id: tenantAId,
            boq_id: boqId,
            order_idx: 1,
            title: 'Substructure & Foundation',
          },
        });
        secId = sec.id;
      }

      const item = await tx.bOQItem.create({
        data: {
          tenant_id: tenantAId,
          section_id: secId,
          item_code: '2.1.1',
          description: 'Mass concrete blinding class 15/20',
          unit: 'CM',
          quantity: '100.0000',
          unit_rate: '8500.0000',
          total_amount: '850000.00',
        },
      });
      sampleBoqItemId = item.id;
    });
  });

  // ---------------------------------------------------------------------------
  // 1. PM_QS Submits Variation Order with Additions & Omissions
  // ---------------------------------------------------------------------------
  it('allows PM_QS to submit variation order with addition (+qty) and omission (-qty) items', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/variations`,
      headers: { cookie: qsCookie },
      payload: {
        title: 'VO-1: Foundation Deepening & Wall Spec Change',
        reason: 'Poor subsoil requires foundation deepening (+1,250,000.00) and omission of perimeter masonry (-350,000.00)',
        timeExtensionDays: 14,
        items: [
          {
            boqItemId: sampleBoqItemId,
            description: 'Additional mass concrete in raft foundation deepening',
            unit: 'CM',
            quantity: '125.0000',
            unitRate: '10000.0000',
          },
          {
            description: 'Omission of 200mm solid concrete blockwork perimeter wall',
            unit: 'SM',
            quantity: '-350.0000',
            unitRate: '1000.0000',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data).toBeDefined();
    expect(body.data.variation_no).toBe(1);
    expect(body.data.status).toBe('SUBMITTED');
    expect(body.data.time_extension_days).toBe(14);
    expect(body.data.items).toHaveLength(2);

    // Line totals:
    // Item 1: 125 * 10,000 = 1,250,000.00
    // Item 2: -350 * 1,000 = -350,000.00
    // Net: 1,250,000.00 - 350,000.00 = 900,000.00
    expect(body.data.net_amount).toBe('900000.00');

    variation1Id = body.data.id;

    // Verify audit log entry
    const auditLogs = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.auditLog.findMany({
        where: {
          entity_type: 'VariationOrder',
          entity_id: variation1Id,
          action: 'VARIATION_SUBMITTED',
        },
      });
    });
    expect(auditLogs).toHaveLength(1);
    expect((auditLogs[0]!.changes as any).netAmount).toBe('900000.00');
  });

  // ---------------------------------------------------------------------------
  // 2. Net Amount Calculation Precision & Auto-Increment Sequence
  // ---------------------------------------------------------------------------
  it('accurately calculates net negative amount for net omissions and auto-increments variation_no', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/variations`,
      headers: { cookie: qsCookie },
      payload: {
        title: 'VO-2: Timber Truss Omissions',
        reason: 'Client requested omission of timber roof trusses in favor of light-gauge steel',
        timeExtensionDays: 0,
        items: [
          {
            description: 'Addition of temporary structural bracing',
            unit: 'ITEM',
            quantity: '1.0000',
            unitRate: '100000.0000',
          },
          {
            description: 'Omission of treated sawn cypress rafters and purlins',
            unit: 'LM',
            quantity: '-500.0000',
            unitRate: '500.0000',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    // Sequence auto-increment
    expect(body.data.variation_no).toBe(2);
    // Calculation: 100,000.00 - 250,000.00 = -150,000.00
    expect(body.data.net_amount).toBe('-150000.00');
    expect(body.data.status).toBe('SUBMITTED');

    variation2Id = body.data.id;
  });

  // ---------------------------------------------------------------------------
  // 3. PM_QS Evaluates Variation Order -> Status Transitions to QS_EVALUATED
  // ---------------------------------------------------------------------------
  it('allows PM_QS to evaluate variation order, transitioning status to QS_EVALUATED without modifying project budget', async () => {
    // Record budget before review
    const projBefore = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.project.findUnique({ where: { id: projectAId } });
    });
    const budgetBefore = projBefore?.current_approved_budget.toString();

    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/variations/${variation1Id}/review`,
      headers: { cookie: qsCookie },
      payload: {
        action: 'EVALUATE',
        comments: 'Verified soil borehole logs and EASMM rates. Recommended for client approval.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('QS_EVALUATED');
    expect(body.data.approved_at).toBeNull();

    // Verify budget remains unchanged during evaluation
    const projAfter = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.project.findUnique({ where: { id: projectAId } });
    });
    expect(projAfter?.current_approved_budget.toString()).toBe(budgetBefore);

    // Verify audit log
    const auditLogs = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.auditLog.findMany({
        where: {
          entity_id: variation1Id,
          action: 'VARIATION_EVALUATE',
        },
      });
    });
    expect(auditLogs).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // 4. Client Approves Variation -> Critical Invariant: Budget Increased Atomically
  // ---------------------------------------------------------------------------
  it('allows Client to approve variation, transitioning status to APPROVED and atomically updating project approved budget', async () => {
    const projBefore = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.project.findUnique({ where: { id: projectAId } });
    });
    const originalBudgetDec = toDecimal(projBefore?.current_approved_budget.toString() || '45000000.00');

    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/variations/${variation1Id}/review`,
      headers: { cookie: clientCookie },
      payload: {
        action: 'APPROVE',
        comments: 'Approved foundation variation as recommended by PM Faith Achieng.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('APPROVED');
    expect(body.data.approved_at).not.toBeNull();

    // Verify project.current_approved_budget atomically incremented by 900,000.00
    const projAfter = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.project.findUnique({ where: { id: projectAId } });
    });
    const expectedBudget = originalBudgetDec.plus(toDecimal('900000.00')).toFixed(2);
    expect(toDecimal(projAfter?.current_approved_budget.toString() || '0').toFixed(2)).toBe(expectedBudget);

    // Verify AuditLog entry for approval
    const auditLogs = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.auditLog.findMany({
        where: {
          entity_id: variation1Id,
          action: 'VARIATION_APPROVE',
        },
      });
    });
    expect(auditLogs).toHaveLength(1);
    expect((auditLogs[0]!.changes as any).newBudget).toBe(expectedBudget);
  });

  // ---------------------------------------------------------------------------
  // 5. Rejection Workflow -> Budget Unaffected
  // ---------------------------------------------------------------------------
  it('allows rejection of variation order and leaves project approved budget completely unchanged', async () => {
    const projBefore = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.project.findUnique({ where: { id: projectAId } });
    });
    const budgetBefore = projBefore?.current_approved_budget.toString();

    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/variations/${variation2Id}/review`,
      headers: { cookie: clientCookie },
      payload: {
        action: 'REJECT',
        comments: 'Roof redesign rejected in favor of retaining original contract drawings.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('REJECTED');

    // Invariant: Budget must NOT change on rejection
    const projAfter = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.project.findUnique({ where: { id: projectAId } });
    });
    expect(projAfter?.current_approved_budget.toString()).toBe(budgetBefore);

    // Verify AuditLog entry for rejection
    const auditLogs = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.auditLog.findMany({
        where: {
          entity_id: variation2Id,
          action: 'VARIATION_REJECT',
        },
      });
    });
    expect(auditLogs).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // 6. Finalized Variations Cannot Be Re-Reviewed
  // ---------------------------------------------------------------------------
  it('rejects attempt to review already finalized (APPROVED or REJECTED) variation orders', async () => {
    // Attempt to reject already APPROVED variation 1
    const resApproved = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/variations/${variation1Id}/review`,
      headers: { cookie: clientCookie },
      payload: { action: 'REJECT', comments: 'Try to reject after approval' },
    });
    expect(resApproved.statusCode).toBe(400);
    expect(JSON.parse(resApproved.body).message).toContain('already approved');

    // Attempt to approve already REJECTED variation 2
    const resRejected = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/variations/${variation2Id}/review`,
      headers: { cookie: clientCookie },
      payload: { action: 'APPROVE', comments: 'Try to approve after rejection' },
    });
    expect(resRejected.statusCode).toBe(400);
    expect(JSON.parse(resRejected.body).message).toContain('already rejected');
  });

  // ---------------------------------------------------------------------------
  // 7. Least Privilege RBAC: Client Cannot Submit Variation Orders
  // ---------------------------------------------------------------------------
  it('enforces RBAC: Client cannot submit variation order (lacks VARIATION_REQUEST)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/variations`,
      headers: { cookie: clientCookie },
      payload: {
        title: 'Unauthorized Client Variation',
        reason: 'Client attempting direct submission',
        timeExtensionDays: 0,
        items: [
          {
            description: 'Unauthorized item',
            unit: 'ITEM',
            quantity: '1.0000',
            unitRate: '10000.0000',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('variation.request');
  });

  // ---------------------------------------------------------------------------
  // 8. Least Privilege RBAC: PM_QS Cannot Approve Variation Orders
  // ---------------------------------------------------------------------------
  it('enforces RBAC: PM_QS cannot approve variation order (lacks VARIATION_APPROVE)', async () => {
    // Submit a fresh variation to test
    const submitRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/variations`,
      headers: { cookie: qsCookie },
      payload: {
        title: 'VO-3: Additional Drainage Channels',
        reason: 'Stormwater drainage additions',
        timeExtensionDays: 2,
        items: [
          {
            description: 'Precast concrete inverted block drains',
            unit: 'LM',
            quantity: '80.0000',
            unitRate: '3500.0000',
          },
        ],
      },
    });
    expect(submitRes.statusCode).toBe(201);
    const var3Id = JSON.parse(submitRes.body).data.id;

    // PM_QS attempts approval
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/variations/${var3Id}/review`,
      headers: { cookie: qsCookie },
      payload: { action: 'APPROVE', comments: 'QS self-approving variation' },
    });

    expect(approveRes.statusCode).toBe(403);
    const body = JSON.parse(approveRes.body);
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('variation.approve');
  });

  // ---------------------------------------------------------------------------
  // 9. Least Privilege RBAC: Site Supervisor Has Zero Variation Authority
  // ---------------------------------------------------------------------------
  it('enforces RBAC: Site Supervisor cannot submit, evaluate, or approve variations', async () => {
    // 1. Attempt submit
    const submitRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/variations`,
      headers: { cookie: supervisorCookie },
      payload: {
        title: 'VO-Supervisor: Extra Cement',
        reason: 'Extra cement on site',
        timeExtensionDays: 0,
        items: [{ description: 'Cement', unit: 'BAGS', quantity: '50.0000', unitRate: '850.0000' }],
      },
    });
    expect(submitRes.statusCode).toBe(403);

    // 2. Attempt evaluate
    const evalRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/variations/${variation1Id}/review`,
      headers: { cookie: supervisorCookie },
      payload: { action: 'EVALUATE' },
    });
    expect(evalRes.statusCode).toBe(403);

    // 3. Attempt approve
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/variations/${variation1Id}/review`,
      headers: { cookie: supervisorCookie },
      payload: { action: 'APPROVE' },
    });
    expect(approveRes.statusCode).toBe(403);
  });

  // ---------------------------------------------------------------------------
  // 10. Multi-Tenant Isolation: Tenant B Cannot View Tenant A's Variations
  // ---------------------------------------------------------------------------
  it('enforces PostgreSQL RLS: Tenant B cannot list or access Tenant A variations', async () => {
    const listRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/variations`,
      headers: { cookie: tenantBCookie },
    });

    // RLS policy scopes project to Tenant B, resulting in 404 Not Found for Project A
    expect(listRes.statusCode).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // 11. Multi-Tenant Isolation: Tenant B Cannot Review Tenant A's Variations
  // ---------------------------------------------------------------------------
  it('enforces PostgreSQL RLS: Tenant B cannot review or approve Tenant A variation order', async () => {
    const reviewRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/variations/${variation1Id}/review`,
      headers: { cookie: tenantBCookie },
      payload: { action: 'APPROVE', comments: 'Cross-tenant malicious approval' },
    });

    expect(reviewRes.statusCode).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // 12. Atomic Rollback: Simulated Transaction Failure Reverts Budget Mutation
  // ---------------------------------------------------------------------------
  it('verifies atomic rollback: unhandled error in approval transaction leaves project budget unchanged', async () => {
    const projBefore = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.project.findUnique({ where: { id: projectAId } });
    });
    const budgetBefore = projBefore?.current_approved_budget.toString();

    // Execute atomic transaction simulation that mutates budget then throws
    await expect(
      withTenantTx(prisma, tenantAId, async (tx) => {
        await tx.project.update({
          where: { id: projectAId },
          data: { current_approved_budget: '999999999.00' },
        });

        // Simulated unexpected failure (e.g. database constraint, audit log failure)
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      }),
    ).rejects.toThrow('SIMULATED_TRANSACTION_FAILURE');

    // Confirm PostgreSQL transaction rolled back cleanly
    const projAfter = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.project.findUnique({ where: { id: projectAId } });
    });
    expect(projAfter?.current_approved_budget.toString()).toBe(budgetBefore);
  });

  // ---------------------------------------------------------------------------
  // 13. GET /api/v1/projects/:projectId/variations List Query
  // ---------------------------------------------------------------------------
  it('returns all variation orders for the project ordered by variation_no ascending', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/variations`,
      headers: { cookie: qsCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThanOrEqual(2);

    // Verify ordered by variation_no asc
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i].variation_no).toBeGreaterThan(body.data[i - 1].variation_no);
    }
  });

  // ---------------------------------------------------------------------------
  // 14. GET /api/v1/projects/:projectId/variations/:variationId Detail Query
  // ---------------------------------------------------------------------------
  it('returns single variation order with its items', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/variations/${variation1Id}`,
      headers: { cookie: qsCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(variation1Id);
    expect(body.data.title).toContain('Foundation Deepening');
    expect(body.data.items).toHaveLength(2);
    expect(body.data.items.some((i: any) => i.description.includes('Additional mass concrete'))).toBe(true);
    expect(body.data.items.some((i: any) => i.description.includes('Omission of 200mm solid concrete blockwork'))).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 15. Validation Schema Rejection
  // ---------------------------------------------------------------------------
  it('rejects malformed variation submission with empty items or invalid numbers', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/variations`,
      headers: { cookie: qsCookie },
      payload: {
        title: 'Empty items variation',
        reason: 'Should fail validation',
        items: [],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Bad Request');
    expect(body.message).toBe('Invalid variation order data');
  });
});
