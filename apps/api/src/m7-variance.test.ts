import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx, hashPassword } from '@construction/db';
import { enrollAllTenantUsersTx } from './test-members';

describe('Milestone M7: Variance Flags, Section Breakdown & Project Dashboard Suite', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let supervisorCookie: string;
  let clientCookie: string;
  let tenantBCookie: string;

  let tenantAId: string;
  let tenantBId: string;
  let projectAId: string;
  let adminAId: string;

  let section1Id: string;
  let section2Id: string;
  let section3Id: string;
  let item11Id: string;
  let item12Id: string;
  let item21Id: string;
  let item31Id: string;

  beforeAll(async () => {
    await server.ready();

    // 1. Login as Apex Builders Admin (Tenant A)
    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = adminRes.headers['set-cookie'] as string;
    const adminBody = JSON.parse(adminRes.body);
    tenantAId = adminBody.user.tenant.id;
    adminAId = adminBody.user.id;

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

    // 5. Seed and Login as Tenant B (Kilimanjaro Operations Ltd)
    const defaultPasswordHash = await hashPassword('Password123!');
    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-b-m7' },
      update: {},
      create: {
        name: 'Kilimanjaro Variance Auditing Ltd',
        slug: 'test-tenant-b-m7',
        currency: 'KES',
      },
    });
    tenantBId = tenantB.id;

    const userB = await prisma.user.upsert({
      where: { email: 'auditor@kilimanjarovariance.co.ke' },
      update: { password_hash: defaultPasswordHash, email_verified_at: new Date() },
      create: {
        email: 'auditor@kilimanjarovariance.co.ke',
        password_hash: defaultPasswordHash,
        full_name: 'David Omondi',
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
      payload: { email: 'auditor@kilimanjarovariance.co.ke', password: 'Password123!' },
    });
    tenantBCookie = tbRes.headers['set-cookie'] as string;

    const testProjectCode = `M7-VAR-${Date.now().toString().slice(-6)}`;

    // 6. Create dedicated Project and BOQ structure for Tenant A Milestone M7 verification
    await withTenantTx(prisma, tenantAId, async (tx) => {
      const proj = await tx.project.create({
        data: {
          tenant_id: tenantAId,
          code: testProjectCode,
          name: `M7 Variance Testing Plaza ${testProjectCode}`,
          status: 'ACTIVE',
          current_approved_budget: '20000000.00',
          original_contract_sum: '20000000.00',
        },
      });
      projectAId = proj.id;
      await enrollAllTenantUsersTx(tx, tenantAId, projectAId);

      // Create Active BOQ with 3 Sections
      const boq = await tx.bOQ.create({
        data: {
          tenant_id: tenantAId,
          project_id: proj.id,
          version: 1,
          status: 'ACTIVE',
          total_amount: '20000000.00',
          sections: {
            create: [
              {
                tenant_id: tenantAId,
                order_idx: 1,
                title: 'Section 1: Substructure',
                total_amount: '5000000.00',
                items: {
                  create: [
                    {
                      tenant_id: tenantAId,
                      item_code: '1.1',
                      description: 'Excavation & Earthworks',
                      unit: 'CM',
                      quantity: '500.0000',
                      unit_rate: '6000.0000',
                      total_amount: '3000000.00',
                    },
                    {
                      tenant_id: tenantAId,
                      item_code: '1.2',
                      description: 'Concrete Foundation Footing',
                      unit: 'CM',
                      quantity: '200.0000',
                      unit_rate: '10000.0000',
                      total_amount: '2000000.00',
                    },
                  ],
                },
              },
              {
                tenant_id: tenantAId,
                order_idx: 2,
                title: 'Section 2: Reinforced Concrete Frame',
                total_amount: '10000000.00',
                items: {
                  create: [
                    {
                      tenant_id: tenantAId,
                      item_code: '2.1',
                      description: 'Columns & Beams Class 25/20',
                      unit: 'CM',
                      quantity: '500.0000',
                      unit_rate: '14000.0000',
                      total_amount: '7000000.00',
                    },
                    {
                      tenant_id: tenantAId,
                      item_code: '2.2',
                      description: 'High Tensile Steel Reinforcement',
                      unit: 'KG',
                      quantity: '20000.0000',
                      unit_rate: '150.0000',
                      total_amount: '3000000.00',
                    },
                  ],
                },
              },
              {
                tenant_id: tenantAId,
                order_idx: 3,
                title: 'Section 3: Walling & Finishes',
                total_amount: '5000000.00',
                items: {
                  create: [
                    {
                      tenant_id: tenantAId,
                      item_code: '3.1',
                      description: 'Internal & External Stone Walling',
                      unit: 'SM',
                      quantity: '2500.0000',
                      unit_rate: '2000.0000',
                      total_amount: '5000000.00',
                    },
                  ],
                },
              },
            ],
          },
        },
        include: {
          sections: {
            orderBy: { order_idx: 'asc' },
            include: { items: true },
          },
        },
      });

      section1Id = boq.sections[0]!.id;
      section2Id = boq.sections[1]!.id;
      section3Id = boq.sections[2]!.id;

      item11Id = boq.sections[0]!.items[0]!.id;
      item12Id = boq.sections[0]!.items[1]!.id;
      item21Id = boq.sections[1]!.items[0]!.id;
      item31Id = boq.sections[2]!.items[0]!.id;
    });
  });

  // ---------------------------------------------------------------------------
  // 1. Automatic Pickup of Latest Physical Progress Record
  // ---------------------------------------------------------------------------
  it('automatically queries and uses the latest progressRecord when progressRatio query param is omitted', async () => {
    // Seed two progress records on different dates
    await withTenantTx(prisma, tenantAId, async (tx) => {
      await tx.progressRecord.deleteMany({ where: { project_id: projectAId } });

      await tx.progressRecord.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          record_date: new Date('2026-10-01T00:00:00.000Z'),
          overall_progress: '0.2000', // 20%
          notes: 'Initial substructure inspection',
        },
      });

      await tx.progressRecord.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          record_date: new Date('2026-11-01T00:00:00.000Z'),
          overall_progress: '0.4500', // 45% (Latest)
          notes: 'Substructure completed and ground floor slab inspection',
        },
      });
    });

    // Call GET summary WITHOUT progressRatio parameter
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/budget/summary`,
      headers: { cookie: qsCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const data = body.data;

    // Must have automatically picked up the latest record (45%, not 20%)
    expect(data.physicalProgressRatio).toBe('0.4500');
    expect(data.physicalProgressPercentage).toBe('45.00');
    expect(data.latestProgressRecordDate).toBe('2026-11-01');
    expect(data.detailedVariance.physicalProgressPercentage).toBe('45.00');

    // When progressRatio IS provided as a query param, it overrides the DB record
    const overrideRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/budget/summary?progressRatio=0.60`,
      headers: { cookie: qsCookie },
    });

    expect(overrideRes.statusCode).toBe(200);
    const overrideData = JSON.parse(overrideRes.body).data;
    expect(overrideData.physicalProgressRatio).toBe('0.6000');
    expect(overrideData.physicalProgressPercentage).toBe('60.00');
    expect(overrideData.detailedVariance.physicalProgressPercentage).toBe('60.00');
  });

  // ---------------------------------------------------------------------------
  // 2. Section-by-Section BOQ Spend & Variance Breakdown
  // ---------------------------------------------------------------------------
  it('accurately computes section breakdown with NORMAL, WATCH, and OVERRUN statuses', async () => {
    // Seed cost entries mapped to section items:
    // Section 1 (Allocated: 5,000,000):
    //   - Approved: 2,500,000 (50.00% -> NORMAL)
    //   - Pending: 500,000
    // Section 2 (Allocated: 10,000,000):
    //   - Approved: 9,000,000 (90.00% -> WATCH, >=85%)
    // Section 3 (Allocated: 5,000,000):
    //   - Approved: 6,000,000 (120.00% -> OVERRUN, >100%)
    await withTenantTx(prisma, tenantAId, async (tx) => {
      await tx.costEntry.updateMany({ where: { project_id: projectAId, status: 'APPROVED' }, data: { status: 'VOID' } });

      // Section 1 entries
      await tx.costEntry.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          boq_item_id: item11Id,
          cost_category: 'PLANT',
          amount: '2500000.00',
          description: 'Excavator and dumper hire',
          status: 'APPROVED',
          created_by_id: adminAId,
        },
      });

      await tx.costEntry.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          boq_item_id: item12Id,
          cost_category: 'MATERIAL',
          amount: '500000.00',
          description: 'Cement and aggregate for footings',
          status: 'PENDING',
          created_by_id: adminAId,
        },
      });

      // Section 2 entries
      await tx.costEntry.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          boq_item_id: item21Id,
          cost_category: 'MATERIAL',
          amount: '9000000.00',
          description: 'Readymix concrete Class 25/20',
          status: 'APPROVED',
          created_by_id: adminAId,
        },
      });

      // Section 3 entries
      await tx.costEntry.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          boq_item_id: item31Id,
          cost_category: 'MATERIAL',
          amount: '6000000.00',
          description: 'Machine cut stone blocks and mortar',
          status: 'APPROVED',
          created_by_id: adminAId,
        },
      });
    });

    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/budget/summary`,
      headers: { cookie: qsCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const breakdown = body.data.sectionBreakdown;

    expect(breakdown).toHaveLength(3);

    // Section 1: Substructure (NORMAL)
    const sec1 = breakdown.find((s: any) => s.sectionId === section1Id);
    expect(sec1).toBeDefined();
    expect(sec1.title).toBe('Section 1: Substructure');
    expect(sec1.allocatedBudget).toBe('5000000.00');
    expect(sec1.actualSpent).toBe('2500000.00');
    expect(sec1.pendingSpent).toBe('500000.00');
    expect(sec1.remainingBudget).toBe('2500000.00');
    expect(sec1.consumptionPercentage).toBe('50.00');
    expect(sec1.isOverBudget).toBe(false);
    expect(sec1.status).toBe('NORMAL');

    // Section 2: Concrete Frame (WATCH - 90%)
    const sec2 = breakdown.find((s: any) => s.sectionId === section2Id);
    expect(sec2).toBeDefined();
    expect(sec2.title).toBe('Section 2: Reinforced Concrete Frame');
    expect(sec2.allocatedBudget).toBe('10000000.00');
    expect(sec2.actualSpent).toBe('9000000.00');
    expect(sec2.pendingSpent).toBe('0.00');
    expect(sec2.remainingBudget).toBe('1000000.00');
    expect(sec2.consumptionPercentage).toBe('90.00');
    expect(sec2.isOverBudget).toBe(false);
    expect(sec2.status).toBe('WATCH');

    // Section 3: Walling & Finishes (OVERRUN - 120%)
    const sec3 = breakdown.find((s: any) => s.sectionId === section3Id);
    expect(sec3).toBeDefined();
    expect(sec3.title).toBe('Section 3: Walling & Finishes');
    expect(sec3.allocatedBudget).toBe('5000000.00');
    expect(sec3.actualSpent).toBe('6000000.00');
    expect(sec3.remainingBudget).toBe('-1000000.00');
    expect(sec3.consumptionPercentage).toBe('120.00');
    expect(sec3.isOverBudget).toBe(true);
    expect(sec3.status).toBe('OVERRUN');
  });

  // ---------------------------------------------------------------------------
  // 3. Status Triggers: ON_TRACK, ATTENTION, and ACTION_REQUIRED
  // ---------------------------------------------------------------------------
  describe('Status Triggers & Financial Invariants', () => {
    it('evaluates ON_TRACK when cost consumption is aligned with or behind physical progress (Delta <= 0%)', async () => {
      // Total approved budget = KES 20,000,000
      // Actual spend: KES 6,000,000 -> 30% cost consumption
      // Physical progress: 40% (0.40) -> Delta = 30% - 40% = -10% <= 0%
      await withTenantTx(prisma, tenantAId, async (tx) => {
        await tx.costEntry.updateMany({ where: { project_id: projectAId, status: 'APPROVED' }, data: { status: 'VOID' } });
        await tx.costEntry.create({
          data: {
            tenant_id: tenantAId,
            project_id: projectAId,
            cost_category: 'MATERIAL',
            amount: '6000000.00',
            description: 'Foundations and ground slab materials',
            status: 'APPROVED',
            created_by_id: adminAId,
          },
        });
      });

      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/budget/summary?progressRatio=0.40`,
        headers: { cookie: qsCookie },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      const v = data.detailedVariance;

      expect(v.status).toBe('ON_TRACK');
      expect(v.severity).toBe('info');
      expect(v.statusLabel).toBe('Normal Alignment');
      expect(v.hasWarning).toBe(false);
      expect(v.costConsumptionPercentage).toBe('30.00');
      expect(v.physicalProgressPercentage).toBe('40.00');
      expect(v.differencePercentage).toBe('-10.00%');
      expect(v.message).toBe('Expenditure is aligned with recorded physical progress.');
    });

    it('evaluates ATTENTION when cost consumption is moderately ahead (0% < Delta < 15%)', async () => {
      // Spend: KES 10,000,000 -> 50% cost consumption
      // Physical progress: 42% (0.42) -> Delta = 50% - 42% = +8% (0% < 8% < 15%)
      await withTenantTx(prisma, tenantAId, async (tx) => {
        await tx.costEntry.updateMany({ where: { project_id: projectAId, status: 'APPROVED' }, data: { status: 'VOID' } });
        await tx.costEntry.create({
          data: {
            tenant_id: tenantAId,
            project_id: projectAId,
            cost_category: 'MATERIAL',
            amount: '10000000.00',
            description: 'Substructure and Frame milestone costs',
            status: 'APPROVED',
            created_by_id: adminAId,
          },
        });
      });

      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/budget/summary?progressRatio=0.42`,
        headers: { cookie: qsCookie },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      const v = data.detailedVariance;

      expect(v.status).toBe('ATTENTION');
      expect(v.severity).toBe('warning');
      expect(v.statusLabel).toBe('Moderate Disparity');
      expect(v.hasWarning).toBe(false);
      expect(v.costConsumptionPercentage).toBe('50.00');
      expect(v.physicalProgressPercentage).toBe('42.00');
      expect(v.differencePercentage).toBe('+8.00%');
      expect(v.message).toBe(
        'Cost consumption is moderately ahead of recorded physical progress. Monitor upcoming milestone valuations.',
      );
    });

    it('evaluates ACTION_REQUIRED when cost consumption is significantly ahead (Delta >= 15%)', async () => {
      // Spend: KES 14,000,000 -> 70% cost consumption
      // Physical progress: 40% (0.40) -> Delta = 70% - 40% = +30% (>= 15%)
      await withTenantTx(prisma, tenantAId, async (tx) => {
        await tx.costEntry.updateMany({ where: { project_id: projectAId, status: 'APPROVED' }, data: { status: 'VOID' } });
        await tx.costEntry.create({
          data: {
            tenant_id: tenantAId,
            project_id: projectAId,
            cost_category: 'MATERIAL',
            amount: '14000000.00',
            description: 'High volume structural procurement',
            status: 'APPROVED',
            created_by_id: adminAId,
          },
        });
      });

      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/budget/summary?progressRatio=0.40`,
        headers: { cookie: qsCookie },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      const v = data.detailedVariance;

      expect(v.status).toBe('ACTION_REQUIRED');
      expect(v.severity).toBe('critical');
      expect(v.statusLabel).toBe('Significant Disparity');
      expect(v.hasWarning).toBe(true);
      expect(v.costConsumptionPercentage).toBe('70.00');
      expect(v.physicalProgressPercentage).toBe('40.00');
      expect(v.differencePercentage).toBe('+30.00%');
      expect(v.message).toBe(
        'Cost consumption is significantly ahead of recorded physical progress. Review project costs and progress records.',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Strict Neutral Language Enforcement (ADR-001 / ADR-005)
  // ---------------------------------------------------------------------------
  it('enforces strict neutrality with zero accusatory or defamatory language in all responses', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/budget/summary?progressRatio=0.10`,
      headers: { cookie: qsCookie },
    });

    expect(res.statusCode).toBe(200);
    const bodyText = res.body;

    // Strict compliance assertion: Zero inflammatory words allowed
    expect(bodyText).not.toMatch(
      /fraud|theft|stolen|stealing|loss|bleeding|overcharge|overbilled|cheat|crook|corrupt|crime|illegal/i,
    );
  });

  // ---------------------------------------------------------------------------
  // 5. Dashboard Route Variance Status Verification
  // ---------------------------------------------------------------------------
  describe('Dashboard Route Integration (GET /api/v1/dashboard)', () => {
    it('returns variance status and details on active projects for PM_QS', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/dashboard',
        headers: { cookie: qsCookie },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.role).toBe('PM_QS');

      const activeProject = data.projects.find((p: any) => p.id === projectAId);
      expect(activeProject).toBeDefined();
      expect(activeProject).toHaveProperty('varianceStatus');
      expect(['ON_TRACK', 'ATTENTION', 'ACTION_REQUIRED']).toContain(activeProject.varianceStatus);
      expect(activeProject).toHaveProperty('varianceSeverity');
      expect(activeProject).toHaveProperty('varianceMessage');
      expect(activeProject).toHaveProperty('varianceDetail');
      expect(activeProject.varianceDetail).toHaveProperty('differencePercentage');
    });

    it('returns variance status on active projects for CLIENT role', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/dashboard',
        headers: { cookie: clientCookie },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.role).toBe('CLIENT');

      const activeProject = data.projects.find((p: any) => p.id === projectAId);
      expect(activeProject).toBeDefined();
      expect(activeProject).toHaveProperty('varianceStatus');
      expect(['ON_TRACK', 'ATTENTION', 'ACTION_REQUIRED']).toContain(activeProject.varianceStatus);
    });

    it('returns variance status on active projects for COMPANY_ADMIN role', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/dashboard',
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.role).toBe('COMPANY_ADMIN');

      const activeProject = data.projects.find((p: any) => p.id === projectAId);
      expect(activeProject).toBeDefined();
      expect(activeProject).toHaveProperty('varianceStatus');
    });

    it('returns variance status on active projects for SITE_SUPERVISOR role', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/dashboard',
        headers: { cookie: supervisorCookie },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.role).toBe('SITE_SUPERVISOR');

      const activeProject = data.projects.find((p: any) => p.id === projectAId);
      expect(activeProject).toBeDefined();
      expect(activeProject).toHaveProperty('varianceStatus');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. PostgreSQL RLS Multi-Tenant Isolation
  // ---------------------------------------------------------------------------
  describe('Multi-Tenant PostgreSQL RLS Isolation', () => {
    it('prevents Tenant B from viewing Tenant A budget summary and variance metrics', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/budget/summary`,
        headers: { cookie: tenantBCookie },
      });

      // Tenant B has no visibility into Tenant A's project
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toBe('Not Found');
    });

    it('ensures Tenant B dashboard excludes Tenant A projects and variance statistics', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/dashboard',
        headers: { cookie: tenantBCookie },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      const tenantAProjects = data.projects.filter((p: any) => p.id === projectAId);
      expect(tenantAProjects).toHaveLength(0);
    });

    it('guarantees runtime withTenantTx under Tenant B returns 0 progress records and sections for Project A', async () => {
      const results = await withTenantTx(prisma, tenantBId, async (tx) => {
        const [progress, sections, costs] = await Promise.all([
          tx.progressRecord.findMany({ where: { project_id: projectAId } }),
          tx.bOQSection.findMany({ where: { boq: { project_id: projectAId } } }),
          tx.costEntry.findMany({ where: { project_id: projectAId } }),
        ]);

        return { progress, sections, costs };
      });

      expect(results.progress).toHaveLength(0);
      expect(results.sections).toHaveLength(0);
      expect(results.costs).toHaveLength(0);
    });
  });
});
