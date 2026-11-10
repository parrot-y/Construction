import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx, hashPassword } from '@construction/db';
import { toDecimal } from '@construction/money';
import { enrollAllTenantUsers } from './test-members';

describe('Milestone M5: Budget, Append-Only Costs & Approvals Suite', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let supervisorCookie: string;
  let clientCookie: string;
  let tenantBCookie: string;

  let tenantAId: string;
  let tenantBId: string;
  let projectAId: string;
  let sampleBoqItemId: string;

  beforeAll(async () => {
    await server.ready();

    // 1. Login as Apex Builders Admin
    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = adminRes.headers['set-cookie'] as string;
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
      where: { slug: 'test-tenant-b-m5' },
      update: {},
      create: {
        name: 'Kilimanjaro Contractors Ltd',
        slug: 'test-tenant-b-m5',
        currency: 'KES',
      },
    });
    tenantBId = tenantB.id;

    const userB = await prisma.user.upsert({
      where: { email: 'admin@kilimanjarobuilders.co.ke' },
      update: { password_hash: defaultPasswordHash, email_verified_at: new Date() },
      create: {
        email: 'admin@kilimanjarobuilders.co.ke',
        password_hash: defaultPasswordHash,
        full_name: 'Juma Bakari',
        is_active: true,
        email_verified_at: new Date(),
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
    });

    const tbRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@kilimanjarobuilders.co.ke', password: 'Password123!' },
    });
    tenantBCookie = tbRes.headers['set-cookie'] as string;

    // Retrieve Project A for Tenant A
    const projA = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.project.findFirst({
        where: { tenant_id: tenantAId, code: 'RCP-2026' },
        include: {
          boqs: {
            where: { status: 'APPROVED' },
            include: {
              sections: {
                include: {
                  items: true,
                },
              },
            },
          },
        },
      });
    });

    if (!projA) {
      throw new Error('Project A (RCP-2026) not found in seed');
    }
    projectAId = projA.id;
      await enrollAllTenantUsers(projectAId);

    // Retrieve or seed a sample BOQ item for project A
    const existingItem = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.bOQItem.findFirst({
        where: {
          section: {
            boq: {
              project_id: projectAId,
            },
          },
        },
      });
    });

    if (existingItem) {
      sampleBoqItemId = existingItem.id;
    } else {
      const latestBoq = await withTenantTx(prisma, tenantAId, async (tx) => {
        return tx.bOQ.findFirst({
          where: { project_id: projectAId },
          orderBy: { version: 'desc' },
        });
      });
      const nextVersion = (latestBoq?.version ?? 0) + 1;
      const seededItem = await withTenantTx(prisma, tenantAId, async (tx) => {
        const boq = await tx.bOQ.create({
          data: {
            tenant_id: tenantAId,
            project_id: projectAId,
            version: nextVersion,
            total_amount: '5000000.00',
            status: 'APPROVED',
          },
        });
        const sec = await tx.bOQSection.create({
          data: {
            tenant_id: tenantAId,
            boq_id: boq.id,
            order_idx: 1,
            title: 'Substructure',
          },
        });
        return tx.bOQItem.create({
          data: {
            tenant_id: tenantAId,
            section_id: sec.id,
            item_code: '1.01',
            description: 'Foundation Excavation',
            unit: 'CM',
            quantity: '100.0000',
            unit_rate: '1500.0000',
            total_amount: '150000.00',
          },
        });
      });
      sampleBoqItemId = seededItem.id;
    }

  });

  // ---------------------------------------------------------------------------
  // 1. Cost Entry Creation
  // ---------------------------------------------------------------------------
  it('allows Site Supervisor to log a cost entry in PENDING status with Decimal precision', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs`,
      headers: { cookie: supervisorCookie },
      payload: {
        costCategory: 'MATERIAL',
        amount: '45000.50',
        vendorName: 'Bamburi Cement Ltd',
        invoiceRef: 'INV-BAMB-2026-01',
        description: '50 bags of Simba 32.5 cement for foundation blinding',
        receipts: [
          {
            filename: 'bamburi_receipt_scan.pdf',
            fileSize: 450200,
            mimeType: 'application/pdf',
            storageKey: 'receipts/test/bamburi_receipt.pdf',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('PENDING');
    expect(body.data.amount).toBe('45000.50');
    expect(body.data.cost_category).toBe('MATERIAL');
    expect(body.data.vendor_name).toBe('Bamburi Cement Ltd');
    expect(body.data.receipts).toHaveLength(1);
    expect(body.data.receipts[0].filename).toBe('bamburi_receipt_scan.pdf');
  });

  it('allows logging a cost entry linked to a valid BOQ item', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs`,
      headers: { cookie: qsCookie },
      payload: {
        boqItemId: sampleBoqItemId,
        costCategory: 'LABOR',
        amount: '18500.00',
        vendorName: 'Fundi Kazi Casuals',
        invoiceRef: 'VOUCHER-088',
        description: 'Site leveling and excavation labor payout for week 12',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.boq_item_id).toBe(sampleBoqItemId);
    expect(body.data.boq_item.id).toBe(sampleBoqItemId);
    expect(body.data.status).toBe('PENDING');
  });

  it('rejects zero or negative cost amounts fail-closed', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs`,
      headers: { cookie: qsCookie },
      payload: {
        costCategory: 'PLANT',
        amount: '-5000.00',
        description: 'Invalid negative plant cost',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('greater than zero');
  });

  // ---------------------------------------------------------------------------
  // 2. Receipt Attachment
  // ---------------------------------------------------------------------------
  it('allows attaching additional receipts to an existing cost entry', async () => {
    // 1. Create a cost entry without receipts
    const createRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs`,
      headers: { cookie: supervisorCookie },
      payload: {
        costCategory: 'PRELIMINARY',
        amount: '8500.00',
        description: 'Nairobi City County site hoarding permit fee',
      },
    });
    const costId = JSON.parse(createRes.body).data.id;

    // 2. Attach receipt
    const attachRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs/${costId}/receipts`,
      headers: { cookie: supervisorCookie },
      payload: {
        filename: 'county_permit_receipt.jpg',
        fileSize: 102400,
        mimeType: 'image/jpeg',
      },
    });

    expect(attachRes.statusCode).toBe(201);
    const attachBody = JSON.parse(attachRes.body);
    expect(attachBody.data.filename).toBe('county_permit_receipt.jpg');
    expect(attachBody.data.cost_entry_id).toBe(costId);
  });

  // ---------------------------------------------------------------------------
  // 3. Multi-Step Approval Workflow
  // ---------------------------------------------------------------------------
  it('allows PM/QS to APPROVE a pending cost entry and writes atomic audit record', async () => {
    // 1. Log a cost entry
    const createRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs`,
      headers: { cookie: supervisorCookie },
      payload: {
        costCategory: 'MATERIAL',
        amount: '120000.00',
        vendorName: 'Apex Steel Mills',
        invoiceRef: 'INV-STEEL-441',
        description: 'High tensile reinforcement bars D16 & D12',
      },
    });
    const costId = JSON.parse(createRes.body).data.id;

    // 2. PM/QS approves
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs/${costId}/approve`,
      headers: { cookie: qsCookie },
      payload: {
        action: 'APPROVED',
        comments: 'Verified against delivery note DN-8812 and certified by site engineer.',
      },
    });

    expect(approveRes.statusCode).toBe(200);
    const approveBody = JSON.parse(approveRes.body);
    expect(approveBody.data.updated.status).toBe('APPROVED');
    expect(approveBody.data.approval.action).toBe('APPROVED');
    expect(approveBody.data.approval.comments).toContain('Verified against delivery note');

    // 3. Verify detail endpoint shows approval history
    const detailRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/costs/${costId}`,
      headers: { cookie: qsCookie },
    });
    const detailBody = JSON.parse(detailRes.body);
    expect(detailBody.data.status).toBe('APPROVED');
    expect(detailBody.data.approvals).toHaveLength(1);
    expect(detailBody.data.approvals[0].action).toBe('APPROVED');
  });

  it('allows PM/QS to REJECT a pending cost entry with explanation', async () => {
    // 1. Log a cost entry
    const createRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs`,
      headers: { cookie: supervisorCookie },
      payload: {
        costCategory: 'PLANT',
        amount: '75000.00',
        description: 'Excavator hire overbilled for weekend standing time',
      },
    });
    const costId = JSON.parse(createRes.body).data.id;

    // 2. Reject
    const rejectRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs/${costId}/approve`,
      headers: { cookie: qsCookie },
      payload: {
        action: 'REJECTED',
        comments: 'Standing time log missing plant operator countersignature.',
      },
    });

    expect(rejectRes.statusCode).toBe(200);
    const rejectBody = JSON.parse(rejectRes.body);
    expect(rejectBody.data.updated.status).toBe('REJECTED');
    expect(rejectBody.data.approval.action).toBe('REJECTED');
  });

  // ---------------------------------------------------------------------------
  // 4. Strict Append-Only Invariant: Voiding (No Hard Deletions)
  // ---------------------------------------------------------------------------
  it('enforces append-only rule: voids cost entry with reason without deleting the row', async () => {
    // 1. Log a cost entry
    const createRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs`,
      headers: { cookie: supervisorCookie },
      payload: {
        costCategory: 'SUBCONTRACT',
        amount: '65000.00',
        description: 'Duplicate plumbing subcontract advance',
      },
    });
    const costId = JSON.parse(createRes.body).data.id;

    // 2. Void the entry
    const voidRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs/${costId}/void`,
      headers: { cookie: qsCookie },
      payload: {
        reason: 'Duplicate entry created in error. Replaced by voucher V-902.',
      },
    });

    expect(voidRes.statusCode).toBe(200);
    const voidBody = JSON.parse(voidRes.body);
    expect(voidBody.data.status).toBe('VOIDED');

    // 3. Row still exists in DB (never hard deleted)
    const dbRecord = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.costEntry.findUnique({ where: { id: costId } });
    });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.status).toBe('VOIDED');

    // 4. Attempting to approve a voided entry is strictly forbidden
    const reApproveRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs/${costId}/approve`,
      headers: { cookie: qsCookie },
      payload: { action: 'APPROVED' },
    });
    expect(reApproveRes.statusCode).toBe(400);
    expect(JSON.parse(reApproveRes.body).message).toContain('Cannot approve or reject a voided cost entry');
  });

  // ---------------------------------------------------------------------------
  // 5. Role-Based Access Control (RBAC)
  // ---------------------------------------------------------------------------
  it('forbids Site Supervisor from approving costs (least-privilege RBAC)', async () => {
    // 1. Create a cost
    const createRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs`,
      headers: { cookie: supervisorCookie },
      payload: {
        costCategory: 'LABOR',
        amount: '12000.00',
        description: 'Masonry daily wages',
      },
    });
    const costId = JSON.parse(createRes.body).data.id;

    // 2. Supervisor tries to self-approve
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs/${costId}/approve`,
      headers: { cookie: supervisorCookie },
      payload: { action: 'APPROVED' },
    });

    expect(approveRes.statusCode).toBe(403);
    const body = JSON.parse(approveRes.body);
    expect(body.error).toBe('Forbidden');
  });

  it('forbids Client role from creating internal contractor cost entries', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs`,
      headers: { cookie: clientCookie },
      payload: {
        costCategory: 'MATERIAL',
        amount: '50000.00',
        description: 'Unauthorized client direct expense',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  // ---------------------------------------------------------------------------
  // 6. Cross-Tenant RLS Multi-Tenant Isolation
  // ---------------------------------------------------------------------------
  it('guarantees Tenant B cannot view, approve, or void Tenant A cost entries', async () => {
    // 1. Create a cost entry in Tenant A
    const createRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs`,
      headers: { cookie: adminCookie },
      payload: {
        costCategory: 'MATERIAL',
        amount: '95000.00',
        description: 'Confidential Tenant A marble floor tiles',
      },
    });
    const costAId = JSON.parse(createRes.body).data.id;

    // 2. Tenant B admin tries to view cost detail for Tenant A
    const viewRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/costs/${costAId}`,
      headers: { cookie: tenantBCookie },
    });
    expect(viewRes.statusCode).toBe(404);

    // 3. Tenant B admin tries to approve cost in Tenant A
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs/${costAId}/approve`,
      headers: { cookie: tenantBCookie },
      payload: { action: 'APPROVED' },
    });
    expect(approveRes.statusCode).toBe(404);

    // 4. Tenant B admin lists costs for project A
    const listRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/costs`,
      headers: { cookie: tenantBCookie },
    });
    // Due to RLS, query for projectAId returns 0 items for Tenant B
    expect(listRes.statusCode).toBe(200);
    expect(JSON.parse(listRes.body).data).toHaveLength(0);

    // 5. Direct DB query using withTenantTx under Tenant B context returns 0 rows
    const dbCrossCheck = await withTenantTx(prisma, tenantBId, async (tx) => {
      return tx.costEntry.findMany({
        where: { project_id: projectAId },
      });
    });
    expect(dbCrossCheck).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // 7. Budget vs Actual Summary & Progress Variance
  // ---------------------------------------------------------------------------
  it('computes accurate decimal budget summary, consumption ratio, and category breakdown', async () => {
    const summaryRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/budget/summary?progressRatio=0.10`,
      headers: { cookie: qsCookie },
    });

    expect(summaryRes.statusCode).toBe(200);
    const body = JSON.parse(summaryRes.body);
    const summary = body.data;

    expect(summary.projectId).toBe(projectAId);
    expect(summary.currency).toBe('KES');
    expect(parseFloat(summary.approvedCost)).toBeGreaterThan(0);
    expect(parseFloat(summary.pendingCost)).toBeGreaterThan(0);

    // Verify Remaining = Budget - Approved Cost
    const budgetDec = toDecimal(summary.approvedBudget);
    const approvedDec = toDecimal(summary.approvedCost);
    const remainingDec = toDecimal(summary.remainingBudget);
    expect(budgetDec.minus(approvedDec).toString()).toBe(remainingDec.toString());

    // Verify Category Breakdown exists
    expect(summary.categoryBreakdown).toHaveProperty('MATERIAL');
    expect(summary.categoryBreakdown).toHaveProperty('LABOR');
    expect(summary.categoryBreakdown).toHaveProperty('PLANT');
    expect(summary.categoryBreakdown).toHaveProperty('SUBCONTRACT');
    expect(summary.categoryBreakdown).toHaveProperty('PRELIMINARY');

    // Verify neutral variance alert format (no judgmental language)
    expect(summary.varianceAlert).toHaveProperty('hasWarning');
    if (summary.varianceAlert.hasWarning) {
      expect(summary.varianceAlert.message).not.toMatch(/fraud|theft|corrupt|steal/i);
    }
  });

  // ---------------------------------------------------------------------------
  // 8. Atomic Rollback Verification
  // ---------------------------------------------------------------------------
  it('guarantees rollback on approval failure: no status change and no orphan approval', async () => {
    // 1. Create a cost
    const createRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/costs`,
      headers: { cookie: supervisorCookie },
      payload: {
        costCategory: 'MATERIAL',
        amount: '33000.00',
        description: 'Timber for scaffolding',
      },
    });
    const costId = JSON.parse(createRes.body).data.id;

    // 2. Perform a failing transaction on withTenantTx directly
    try {
      await withTenantTx(prisma, tenantAId, async (tx) => {
        await tx.costEntry.update({
          where: { id: costId },
          data: { status: 'APPROVED' },
        });

        await tx.costApproval.create({
          data: {
            tenant_id: tenantAId,
            cost_entry_id: costId,
            reviewer_id: '00000000-0000-0000-0000-000000000000', // Non-existent user triggers FK violation
            action: 'APPROVED',
          },
        });
      });
    } catch {
      // Expected rollback
    }

    // 3. Verify cost remains PENDING and zero approvals were inserted
    const verifyRecord = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.costEntry.findUnique({
        where: { id: costId },
        include: { approvals: true },
      });
    });

    expect(verifyRecord?.status).toBe('PENDING');
    expect(verifyRecord?.approvals).toHaveLength(0);
  });
});
