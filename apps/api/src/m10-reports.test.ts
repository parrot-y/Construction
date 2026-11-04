import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx, hashPassword } from '@construction/db';
import { benchmarkPdfRender } from './reports/renderPdf';

describe('Milestone M10: Reports, Hardening & Export Integration Suite', () => {
  const server = buildServer();

  let adminCookie: string;
  let clientCookie: string;
  let supervisorCookie: string;
  let tenantBCookie: string;

  let tenantAId: string;
  let projectAId: string;
  let adminAId: string;
  let supervisorAId: string;
  let diaryAId: string;
  let testProjectCode: string;

  beforeAll(async () => {
    await server.ready();

    // 1. Login as Tenant A Admin (Apex Builders Kenya)
    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = adminRes.headers['set-cookie'] as string;
    const adminBody = JSON.parse(adminRes.body);
    tenantAId = adminBody.user.tenant.id;
    adminAId = adminBody.user.id;

    // 2. Login as Tenant A Client
    const clientRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'client@apexbuilders.co.ke', password: 'Password123!' },
    });
    clientCookie = clientRes.headers['set-cookie'] as string;

    // 3. Login as Tenant A Site Supervisor
    const supRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'supervisor@apexbuilders.co.ke', password: 'Password123!' },
    });
    supervisorCookie = supRes.headers['set-cookie'] as string;
    const supBody = JSON.parse(supRes.body);
    supervisorAId = supBody.user.id;

    // 4. Seed and Login Tenant B (Kilimanjaro Development Ltd)
    const defaultPasswordHash = await hashPassword('Password123!');
    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-b-m10' },
      update: {},
      create: {
        name: 'Kilimanjaro Development M10',
        slug: 'test-tenant-b-m10',
        currency: 'KES',
      },
    });

    const userB = await prisma.user.upsert({
      where: { email: 'admin@kilimanjarodev-m10.co.ke' },
      update: { password_hash: defaultPasswordHash },
      create: {
        email: 'admin@kilimanjarodev-m10.co.ke',
        password_hash: defaultPasswordHash,
        full_name: 'Daniel Kiptoo M10',
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

      await tx.project.upsert({
        where: { tenant_id_code: { tenant_id: tenantB.id, code: 'KIL-M10-01' } },
        update: {},
        create: {
          tenant_id: tenantB.id,
          name: 'Kilimanjaro Heights M10',
          code: 'KIL-M10-01',
          original_contract_sum: '80000000.00',
          current_approved_budget: '80000000.00',
        },
      });
    });

    const tbRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@kilimanjarodev-m10.co.ke', password: 'Password123!' },
    });
    tenantBCookie = tbRes.headers['set-cookie'] as string;

    testProjectCode = `M10-REP-${Date.now().toString().slice(-6)}`;

    // 5. Seed dedicated Project, BOQ, Costs, Variations, Diaries, and Progress for Tenant A
    await withTenantTx(prisma, tenantAId, async (tx) => {
      const proj = await tx.project.create({
        data: {
          tenant_id: tenantAId,
          code: testProjectCode,
          name: `Riverside Commercial Plaza ${testProjectCode}`,
          location: 'Riverside Drive, Nairobi',
          nca_project_no: 'NCA-PRJ-2026-0891',
          original_contract_sum: '45000000.00',
          current_approved_budget: '45900000.00',
          status: 'ACTIVE',
        },
      });
      projectAId = proj.id;

      // BOQ
      const boq = await tx.bOQ.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          version: 1,
          total_amount: '45000000.00',
          status: 'ACTIVE',
        },
      });

      const section1 = await tx.bOQSection.create({
        data: {
          tenant_id: tenantAId,
          boq_id: boq.id,
          order_idx: 1,
          title: 'Section 1: Substructure',
          total_amount: '15000000.00',
        },
      });

      const item1 = await tx.bOQItem.create({
        data: {
          tenant_id: tenantAId,
          section_id: section1.id,
          item_code: '1.1.1',
          description: 'Basement excavation in fractured rock',
          unit: 'CM',
          quantity: '500.0000',
          unit_rate: '4000.0000',
          total_amount: '2000000.00',
        },
      });

      const section2 = await tx.bOQSection.create({
        data: {
          tenant_id: tenantAId,
          boq_id: boq.id,
          order_idx: 2,
          title: 'Section 2: Reinforced Concrete Superstructure',
          total_amount: '30000000.00',
        },
      });

      const item2 = await tx.bOQItem.create({
        data: {
          tenant_id: tenantAId,
          section_id: section2.id,
          item_code: '2.1.1',
          description: 'Reinforced concrete class 30/20 in frame columns',
          unit: 'CM',
          quantity: '300.0000',
          unit_rate: '25000.0000',
          total_amount: '7500000.00',
        },
      });

      // Cost Entries: 3,000,000 + 1,500,000 = 4,500,000.00 approved
      await tx.costEntry.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          boq_item_id: item1.id,
          cost_category: 'MATERIAL',
          amount: '3000000.00',
          vendor_name: 'Bamburi Cement Ltd',
          description: 'Foundation Portland cement and aggregate',
          status: 'APPROVED',
          created_by_id: adminAId,
        },
      });

      await tx.costEntry.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          boq_item_id: item2.id,
          cost_category: 'LABOR',
          amount: '1500000.00',
          vendor_name: 'Nairobi Skilled Artisans Syndicate',
          description: 'Structural steel fixing and shuttering carpenters',
          status: 'APPROVED',
          created_by_id: adminAId,
        },
      });

      // Approved Variation Order (+ KES 900,000.00)
      const vo = await tx.variationOrder.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          variation_no: 1,
          title: 'Additional Basement Drainage Sump Pump',
          reason: 'High subterranean water table requiring perimeter sumps',
          status: 'APPROVED',
          net_amount: '900000.00',
          time_extension_days: 7,
          approved_at: new Date(),
        },
      });

      await tx.variationItem.create({
        data: {
          tenant_id: tenantAId,
          variation_order_id: vo.id,
          boq_item_id: item1.id,
          description: 'Perimeter sump pit concrete rings and submersible pump',
          unit: 'ITEM',
          quantity: '1.0000',
          unit_rate: '900000.0000',
          total_amount: '900000.00',
        },
      });

      // Physical Progress: 12%
      await tx.progressRecord.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          record_date: new Date('2026-11-02T00:00:00.000Z'),
          overall_progress: '0.1200',
          notes: 'Substructure piling 90% completed and pile caps casted',
        },
      });

      // Site Diary with labor headcount, deliveries, and photo evidence
      const diary = await tx.siteDiary.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectAId,
          entry_date: new Date('2026-11-03T00:00:00.000Z'),
          weather: 'SUNNY',
          site_status: 'OPERATIONAL',
          general_notes: 'Excavation team on site at 07:00. Concrete pour for foundation base pad.',
          recorded_by_id: supervisorAId,
        },
      });
      diaryAId = diary.id;

      await tx.laborHeadcount.createMany({
        data: [
          { tenant_id: tenantAId, site_diary_id: diary.id, trade_type: 'Mason', headcount: 8 },
          { tenant_id: tenantAId, site_diary_id: diary.id, trade_type: 'Steel Fixer', headcount: 6 },
          { tenant_id: tenantAId, site_diary_id: diary.id, trade_type: 'Carpenter', headcount: 4 },
          { tenant_id: tenantAId, site_diary_id: diary.id, trade_type: 'Casual Laborer', headcount: 12 },
        ],
      });

      await tx.materialDelivery.createMany({
        data: [
          {
            tenant_id: tenantAId,
            site_diary_id: diary.id,
            material_name: 'Bamburi PowerPlus 42.5N Cement',
            quantity: '300.0000',
            unit: 'BAGS',
            supplier_name: 'Bamburi Cement Ltd',
            delivery_note: 'DN-2026-8812',
          },
          {
            tenant_id: tenantAId,
            site_diary_id: diary.id,
            material_name: 'River Sand Clean',
            quantity: '30.0000',
            unit: 'TONS',
            supplier_name: 'Machakos Aggregates Ltd',
            delivery_note: 'DN-2026-8813',
          },
        ],
      });

      await tx.sitePhoto.create({
        data: {
          tenant_id: tenantAId,
          site_diary_id: diary.id,
          storage_key: 'site-photos/pad-pour-m10.jpg',
          caption: 'Pad foundation rebar inspection and concrete vibrator compaction',
          taken_at: new Date('2026-11-03T10:30:00.000Z'),
          gps_latitude: '-1.292100',
          gps_longitude: '36.821900',
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // TEST 1: Interim Payment Certificate (IPC) Endpoint
  // ---------------------------------------------------------------------------
  it('generates an authentic Interim Payment Certificate (IPC) PDF for the project', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/reports/ipc`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="IPC-${testProjectCode}.pdf"`);

    const pdfBuffer = res.rawPayload;
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  // ---------------------------------------------------------------------------
  // TEST 2: Client Access to IPC PDF
  // ---------------------------------------------------------------------------
  it('allows authenticated CLIENT role to download Interim Payment Certificate (IPC) PDF', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/reports/ipc`,
      headers: { cookie: clientCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
  });

  // ---------------------------------------------------------------------------
  // TEST 3: Site Diary Report PDF Endpoint
  // ---------------------------------------------------------------------------
  it('generates a comprehensive Daily Site Diary PDF with labor headcount and material deliveries', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/reports/site-diary/${diaryAId}`,
      headers: { cookie: supervisorCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain(`SiteDiary-${testProjectCode}`);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
  });

  // ---------------------------------------------------------------------------
  // TEST 4: Project Summary Report PDF Endpoint
  // ---------------------------------------------------------------------------
  it('generates an Executive Project Summary PDF containing the 5 financial numbers and section breakdown', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/reports/summary`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="ProjectSummary-${testProjectCode}.pdf"`);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
  });

  // ---------------------------------------------------------------------------
  // TEST 5: ADR-002 In-Process PDF Engine Performance Benchmark
  // ---------------------------------------------------------------------------
  it('verifies ADR-002 performance benchmarks (<100MB RAM delta, <2.5s rendering)', async () => {
    // Benchmark PaymentCertificatePdf
    const ipcBenchmark = await benchmarkPdfRender(async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/reports/ipc`,
        headers: { cookie: adminCookie },
      });
      return res.rawPayload;
    });

    expect(ipcBenchmark.durationMs).toBeLessThan(2500);
    expect(ipcBenchmark.memoryDeltaMb).toBeLessThan(100);
    expect(ipcBenchmark.meetsAdr002Thresholds).toBe(true);

    // Benchmark SiteDiaryReportPdf
    const diaryBenchmark = await benchmarkPdfRender(async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/reports/site-diary/${diaryAId}`,
        headers: { cookie: adminCookie },
      });
      return res.rawPayload;
    });

    expect(diaryBenchmark.durationMs).toBeLessThan(2500);
    expect(diaryBenchmark.memoryDeltaMb).toBeLessThan(100);
    expect(diaryBenchmark.meetsAdr002Thresholds).toBe(true);

    // Benchmark ProjectSummaryPdf
    const summaryBenchmark = await benchmarkPdfRender(async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/reports/summary`,
        headers: { cookie: adminCookie },
      });
      return res.rawPayload;
    });

    expect(summaryBenchmark.durationMs).toBeLessThan(2500);
    expect(summaryBenchmark.memoryDeltaMb).toBeLessThan(100);
    expect(summaryBenchmark.meetsAdr002Thresholds).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TEST 6: Audit Log Recording on Report Generation
  // ---------------------------------------------------------------------------
  it('records an append-only AuditLog entry for every generated report', async () => {
    await withTenantTx(prisma, tenantAId, async (tx) => {
      const logs = await tx.auditLog.findMany({
        where: {
          project_id: projectAId,
          action: 'REPORT_GENERATED',
        },
        orderBy: { created_at: 'desc' },
      });

      expect(logs.length).toBeGreaterThanOrEqual(3);

      const entityTypes = new Set(logs.map((l) => l.entity_type));
      expect(entityTypes.has('IPC')).toBe(true);
      expect(entityTypes.has('SITE_DIARY')).toBe(true);
      expect(entityTypes.has('PROJECT_SUMMARY')).toBe(true);

      const ipcLog = logs.find((l) => l.entity_type === 'IPC');
      expect(ipcLog).toBeDefined();
      expect(ipcLog?.changes).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // TEST 7: Strict RLS Multi-Tenant Isolation
  // ---------------------------------------------------------------------------
  it('enforces strict fail-closed RLS: Tenant B cannot access or download Tenant A reports', async () => {
    // 1. IPC PDF download across tenant boundary
    const crossIpc = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/reports/ipc`,
      headers: { cookie: tenantBCookie },
    });
    expect(crossIpc.statusCode).toBe(404);
    expect(crossIpc.headers['content-type']).toContain('application/json');

    // 2. Site Diary PDF download across tenant boundary
    const crossDiary = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/reports/site-diary/${diaryAId}`,
      headers: { cookie: tenantBCookie },
    });
    expect(crossDiary.statusCode).toBe(404);
    expect(crossDiary.headers['content-type']).toContain('application/json');

    // 3. Project Summary PDF download across tenant boundary
    const crossSummary = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/reports/summary`,
      headers: { cookie: tenantBCookie },
    });
    expect(crossSummary.statusCode).toBe(404);
    expect(crossSummary.headers['content-type']).toContain('application/json');
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Error Handling & Invalid Identifiers
  // ---------------------------------------------------------------------------
  it('returns 404 for non-existent or malformed project and diary UUIDs', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';

    const resFakeProject = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${fakeUuid}/reports/summary`,
      headers: { cookie: adminCookie },
    });
    expect(resFakeProject.statusCode).toBe(404);

    const resMalformedUuid = await server.inject({
      method: 'GET',
      url: '/api/v1/projects/not-a-valid-uuid/reports/summary',
      headers: { cookie: adminCookie },
    });
    expect(resMalformedUuid.statusCode).toBe(404);

    const resFakeDiary = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/reports/site-diary/${fakeUuid}`,
      headers: { cookie: adminCookie },
    });
    expect(resFakeDiary.statusCode).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // TEST 9: Unauthenticated Rejection
  // ---------------------------------------------------------------------------
  it('rejects unauthenticated requests to all report endpoints with 401', async () => {
    const res1 = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/reports/ipc`,
    });
    expect(res1.statusCode).toBe(401);

    const res2 = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/reports/site-diary/${diaryAId}`,
    });
    expect(res2.statusCode).toBe(401);

    const res3 = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/reports/summary`,
    });
    expect(res3.statusCode).toBe(401);
  });
});
