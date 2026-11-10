import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx, hashPassword } from '@construction/db';
import { enrollAllTenantUsers } from './test-members';

describe('Lifecycle Extensions Suite: 5 Domains & Strict RLS Isolation', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let supervisorCookie: string;
  let tenantBCookie: string;

  let tenantAId: string;
  let tenantBId: string;
  let projectAId: string;
  let supervisorAId: string;

  let rfi1Id: string;
  let rfi2Id: string;
  let checklist1Id: string;
  let checklist1ItemId1: string;
  let checklist1ItemId2: string;
  let checklist1ItemId3: string;
  let cubeTestId: string;
  let snag1Id: string;

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
    const supBody = JSON.parse(supRes.body);
    supervisorAId = supBody.user.id;

    // 4. Seed and Login as Tenant B (Kilimanjaro Lifecycle Admin)
    const defaultPasswordHash = await hashPassword('Password123!');
    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-b-lifecycle' },
      update: {},
      create: {
        name: 'Kilimanjaro Lifecycle Engineering Ltd',
        slug: 'test-tenant-b-lifecycle',
        currency: 'KES',
      },
    });
    tenantBId = tenantB.id;

    const userB = await prisma.user.upsert({
      where: { email: 'admin@kilimanjarolifecycle.co.ke' },
      update: { password_hash: defaultPasswordHash, email_verified_at: new Date() },
      create: {
        email: 'admin@kilimanjarolifecycle.co.ke',
        password_hash: defaultPasswordHash,
        full_name: 'Nelson Kibet',
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

      await tx.project.upsert({
        where: { tenant_id_code: { tenant_id: tenantB.id, code: 'KIL-LC-01' } },
        update: {},
        create: {
          tenant_id: tenantB.id,
          name: 'Kilimanjaro Heights Tower',
          code: 'KIL-LC-01',
          original_contract_sum: '50000000.00',
          current_approved_budget: '50000000.00',
        },
      });
    });

    const tbRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@kilimanjarolifecycle.co.ke', password: 'Password123!' },
    });
    tenantBCookie = tbRes.headers['set-cookie'] as string;

    // 5. Seed Project A for Tenant A (Contract Sum: KES 10,000,000.00 for JBC 1999 5% retention verification)
    const lcCode = `LC-APEX-${Date.now().toString().slice(-6)}`;
    await withTenantTx(prisma, tenantAId, async (tx) => {
      const proj = await tx.project.create({
        data: {
          tenant_id: tenantAId,
          code: lcCode,
          name: `Apex Parkview Commercial Center ${lcCode}`,
          location: 'Kilimani, Nairobi',
          nca_project_no: 'NCA-PR-2026-98124',
          status: 'ACTIVE',
          current_approved_budget: '10000000.00',
          original_contract_sum: '10000000.00',
        },
      });
      projectAId = proj.id;

    });
        await enrollAllTenantUsers(projectAId);
  });

  // ===========================================================================
  // DOMAIN 1: RFIs & TECHNICAL QUERIES
  // ===========================================================================
  describe('Domain 1: Technical Queries & RFIs Workflow', () => {
    it('creates RFI with sequential rfi_number 1 and SUBMITTED status', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/rfis`,
        headers: { cookie: supervisorCookie },
        payload: {
          title: 'Beam 2B4 Reinforcement Clash with HVAC Penetration',
          question:
            'Drawing STR-04 Rev C indicates 4Y25 bottom bars clashing with 200mm HVAC sleeve on grid line C-3. Please clarify bar crank details.',
          suggestedSolution: 'Crank bottom bars 50mm clear of sleeve with 2 additional U-bars',
          drawingReference: 'STR-04 Rev C',
          specificationClause: 'EASMM Section 3.4',
          priority: 'HIGH',
          assignedToRole: 'STRUCTURAL_ENG',
          costImpact: true,
          scheduleImpactDays: 1,
          dueDate: '2026-11-10',
          attachments: [
            {
              storageKey: 'rfis/beam-clash-photo.jpg',
              filename: 'beam-clash-photo.jpg',
              fileSize: 1048576,
              mimeType: 'image/jpeg',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBeDefined();
      expect(body.rfi_number).toBe(1);
      expect(body.status).toBe('SUBMITTED');
      expect(body.priority).toBe('HIGH');
      expect(body.cost_impact).toBe(true);
      expect(body.schedule_impact_days).toBe(1);
      expect(body.attachments).toHaveLength(1);
      expect(body.created_by.id).toBe(supervisorAId);
      rfi1Id = body.id;
    });

    it('creates second RFI with sequential rfi_number 2', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/rfis`,
        headers: { cookie: supervisorCookie },
        payload: {
          title: 'Roof Slab Waterproofing Screed Fall Direction',
          question: 'Invert levels for rainwater downpipes require confirmation on architectural drawing A-102.',
          priority: 'MEDIUM',
          assignedToRole: 'ARCHITECT',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.rfi_number).toBe(2);
      expect(body.status).toBe('SUBMITTED');
      rfi2Id = body.id;
    });

    it('responds to RFI 1 with accepted solution, transitioning status to ANSWERED', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/rfis/${rfi1Id}/responses`,
        headers: { cookie: qsCookie },
        payload: {
          officialAnswer:
            'Approved. Cast sleeve centered at neutral axis with 2 No. Y16 diagonal trimmer bars as detailed in sketch SK-09.',
          isAccepted: true,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.response.official_answer).toContain('Approved');
      expect(body.response.is_accepted).toBe(true);
      expect(body.rfi.status).toBe('ANSWERED');
      expect(body.rfi.closed_at).not.toBeNull();
    });

    it('responds to RFI 2 with rejection, transitioning status to REJECTED', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/rfis/${rfi2Id}/responses`,
        headers: { cookie: adminCookie },
        payload: {
          officialAnswer: 'Proposed slope of 1:80 contradicts BOPA standards. Provide minimum 1:60 fall.',
          isAccepted: false,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.rfi.status).toBe('REJECTED');
    });

    it('lists all project RFIs with nested relations', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/rfis`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(2);
      expect(body[0].rfi_number).toBe(1);
      expect(body[0].responses).toHaveLength(1);
      expect(body[1].rfi_number).toBe(2);
    });

    it('asserts AuditLog entries recorded for RFI creation and response', async () => {
      await withTenantTx(prisma, tenantAId, async (tx) => {
        const createLogs = await tx.auditLog.findMany({
          where: { project_id: projectAId, action: 'RFI_CREATED' },
        });
        expect(createLogs.length).toBeGreaterThanOrEqual(2);

        const responseLogs = await tx.auditLog.findMany({
          where: { project_id: projectAId, action: 'RFI_RESPONDED' },
        });
        expect(responseLogs.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  // ===========================================================================
  // DOMAIN 2: QUALITY ASSURANCE & PRE-POUR CHECKLISTS
  // ===========================================================================
  describe('Domain 2: Quality Assurance & Pre-Pour Inspection Checklists', () => {
    it('creates pre-pour concrete inspection checklist with pending items', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/inspections`,
        headers: { cookie: supervisorCookie },
        payload: {
          checklistType: 'PRE_POUR_CONCRETE',
          title: '2nd Floor Suspended Slab Pre-Pour QA Inspection',
          location: 'Block A, 2nd Floor Slab Axis 1-8',
          scheduledDate: '2026-11-04',
          inspectorName: 'Eng. David Ochieng',
          inspectorRole: 'Resident Structural Engineer',
          summaryNotes: 'Joint structural inspection prior to concrete pour approval',
          items: [
            { orderIdx: 1, checkPoint: 'Cover blocks 25mm placed on all bottom mats', isMandatory: true },
            { orderIdx: 2, checkPoint: 'Formwork cleaned, joints sealed and props braced', isMandatory: true },
            { orderIdx: 3, checkPoint: 'Electrical conduits secured without crimping', isMandatory: false },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBeDefined();
      expect(body.status).toBe('PENDING');
      expect(body.items).toHaveLength(3);
      checklist1Id = body.id;
      checklist1ItemId1 = body.items[0].id;
      checklist1ItemId2 = body.items[1].id;
      checklist1ItemId3 = body.items[2].id;
    });

    it('updates item 1 to PASS, transitioning checklist to IN_PROGRESS', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${projectAId}/inspections/${checklist1Id}/items/${checklist1ItemId1}`,
        headers: { cookie: supervisorCookie },
        payload: {
          result: 'PASS',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.item.result).toBe('PASS');
      expect(body.checklist.status).toBe('IN_PROGRESS');
    });

    it('updates remaining items to PASS, transitioning checklist to APPROVED_WITHOUT_COMMENTS', async () => {
      await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${projectAId}/inspections/${checklist1Id}/items/${checklist1ItemId2}`,
        headers: { cookie: supervisorCookie },
        payload: { result: 'PASS' },
      });

      const res3 = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${projectAId}/inspections/${checklist1Id}/items/${checklist1ItemId3}`,
        headers: { cookie: supervisorCookie },
        payload: { result: 'PASS' },
      });

      expect(res3.statusCode).toBe(200);
      const body3 = JSON.parse(res3.body);
      expect(body3.checklist.status).toBe('APPROVED_WITHOUT_COMMENTS');
      expect(body3.checklist.inspected_at).not.toBeNull();
      expect(body3.checklist.signed_off_by_id).toBe(supervisorAId);
    });

    it('creates second checklist and marks mandatory item FAIL, transitioning status to REJECTED', async () => {
      const createRes = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/inspections`,
        headers: { cookie: supervisorCookie },
        payload: {
          checklistType: 'REBAR_VERIFICATION',
          title: 'Column Starter Rebar Verification',
          location: 'Columns C1-C6 Ground Floor',
          scheduledDate: '2026-11-04',
          items: [
            { orderIdx: 1, checkPoint: 'Lap length conforms to 40d minimum', isMandatory: true },
          ],
        },
      });

      const checklist2 = JSON.parse(createRes.body);
      const itemId = checklist2.items[0].id;

      const failRes = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${projectAId}/inspections/${checklist2.id}/items/${itemId}`,
        headers: { cookie: supervisorCookie },
        payload: {
          result: 'FAIL',
          deficiencyNotes: 'Lap length measured at 30d (600mm) instead of required 40d (800mm) for Y20 bars',
        },
      });

      expect(failRes.statusCode).toBe(200);
      const failBody = JSON.parse(failRes.body);
      expect(failBody.item.result).toBe('FAIL');
      expect(failBody.checklist.status).toBe('REJECTED');
    });

    it('asserts AuditLog entries recorded for checklist and item operations', async () => {
      await withTenantTx(prisma, tenantAId, async (tx) => {
        const createLogs = await tx.auditLog.findMany({
          where: { project_id: projectAId, action: 'INSPECTION_CHECKLIST_CREATED' },
        });
        expect(createLogs.length).toBeGreaterThanOrEqual(2);

        const updateLogs = await tx.auditLog.findMany({
          where: { project_id: projectAId, action: 'INSPECTION_ITEM_UPDATED' },
        });
        expect(updateLogs.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  // ===========================================================================
  // DOMAIN 3: CONCRETE QUALITY & CUBE TEST REGISTRY
  // ===========================================================================
  describe('Domain 3: Concrete Quality & Cube Test Registry', () => {
    it('creates concrete cube test batch with Class 25/20 mix', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/cube-tests`,
        headers: { cookie: supervisorCookie },
        payload: {
          batchReference: 'BATCH-2026-11-04-SLAB2',
          pourLocation: '2nd Floor Slab & Beams Axis 1-8',
          pourDate: '2026-11-04',
          concreteClass: 'CLASS_25_20',
          targetStrengthMpa: '25.00',
          slumpTestedMm: 75,
          supplierName: 'Bamburi Special Products ReadyMix',
          deliveryDocketNo: 'BSP-NBI-89421',
          curingTankId: 'TANK-NORTH-01',
          notes: 'Cast 6 standard 150mm cubes in steel moulds',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBeDefined();
      expect(body.concrete_class).toBe('CLASS_25_20');
      expect(body.target_strength_mpa).toBe('25.00');
      expect(body.slump_tested_mm).toBe(75);
      cubeTestId = body.id;
    });

    it('records 7-day cube break and accurately computes compressive MPa (405kN / 22.5 = 18.00 MPa >= 16.25 MPa pass)', async () => {
      // 150x150mm cube area = 22,500 mm²
      // 405 kN crushing load -> 405 * 1000 / 22500 = 18.00 MPa
      // 7-day threshold = 25.00 * 0.65 = 16.25 MPa -> PASS
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/cube-tests/${cubeTestId}/breaks`,
        headers: { cookie: supervisorCookie },
        payload: {
          cubeNumber: 1,
          breakAgeDays: 7,
          scheduledBreakDate: '2026-11-11',
          crushingLoadKn: '405.00',
          labName: 'Ministry of Works Materials Testing Department',
          testedBy: 'Lab Tech Mwangi',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.crushing_load_kn).toBe('405.00');
      expect(body.compressive_mpa).toBe('18.00');
      expect(body.is_pass).toBe(true);
    });

    it('records 28-day cube break meeting 25.00 MPa target (607.50kN / 22.5 = 27.00 MPa >= 25.00 MPa pass)', async () => {
      // 607.50 kN -> 27.00 MPa >= 25.00 MPa -> PASS
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/cube-tests/${cubeTestId}/breaks`,
        headers: { cookie: supervisorCookie },
        payload: {
          cubeNumber: 2,
          breakAgeDays: 28,
          scheduledBreakDate: '2026-12-02',
          crushingLoadKn: '607.50',
          labName: 'Ministry of Works Materials Testing Department',
          testedBy: 'Lab Tech Mwangi',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.crushing_load_kn).toBe('607.50');
      expect(body.compressive_mpa).toBe('27.00');
      expect(body.is_pass).toBe(true);
    });

    it('records substandard 28-day break failing design strength (450.00kN / 22.5 = 20.00 MPa < 25.00 MPa fail)', async () => {
      // 450.00 kN -> 20.00 MPa < 25.00 MPa -> FAIL
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/cube-tests/${cubeTestId}/breaks`,
        headers: { cookie: supervisorCookie },
        payload: {
          cubeNumber: 3,
          breakAgeDays: 28,
          scheduledBreakDate: '2026-12-02',
          crushingLoadKn: '450.00',
          labName: 'Ministry of Works Materials Testing Department',
          testedBy: 'Lab Tech Mwangi',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.compressive_mpa).toBe('20.00');
      expect(body.is_pass).toBe(false);
    });

    it('lists project cube tests with nested break results', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/cube-tests`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
      expect(body[0].break_results).toHaveLength(3);
    });

    it('asserts AuditLog entries recorded for cube test and break recordings', async () => {
      await withTenantTx(prisma, tenantAId, async (tx) => {
        const testLogs = await tx.auditLog.findMany({
          where: { project_id: projectAId, action: 'CONCRETE_CUBE_TEST_CREATED' },
        });
        expect(testLogs.length).toBeGreaterThanOrEqual(1);

        const breakLogs = await tx.auditLog.findMany({
          where: { project_id: projectAId, action: 'CUBE_BREAK_RECORDED' },
        });
        expect(breakLogs.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  // ===========================================================================
  // DOMAIN 4: HANDOVER & SNAGGING (PUNCH LIST)
  // ===========================================================================
  describe('Domain 4: Handover & Snagging (Punch List) Lifecycle', () => {
    it('creates snag item with trade assignment and initial defect photo', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/snags`,
        headers: { cookie: qsCookie },
        payload: {
          locationBlock: 'Block A',
          locationFloor: '2nd Floor',
          locationRoom: 'Apartment 2B - Master Bathroom',
          tradeCategory: 'Tiling',
          description: 'Hollow sounding porcelain floor tiles near shower threshold',
          severity: 'FUNCTIONAL',
          assignedTradeFirm: 'Fundi Ceramic Specialists Ltd',
          dueDate: '2026-11-20',
          identifiedByName: 'QS Grace Wambui',
          photos: [
            {
              photoType: 'DEFECT',
              storageKey: 'snags/apt2b-tile-defect.jpg',
              caption: 'Debonded floor tiles sounding hollow upon tap hammer inspection',
              gpsLatitude: -1.292066,
              gpsLongitude: 36.821946,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBeDefined();
      expect(body.snag_number).toBe(1);
      expect(body.status).toBe('OPEN');
      expect(body.trade_category).toBe('Tiling');
      expect(body.photos).toHaveLength(1);
      snag1Id = body.id;
    });

    it('contractor rectifies snag and attaches rectified photo evidence', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${projectAId}/snags/${snag1Id}/status`,
        headers: { cookie: supervisorCookie },
        payload: {
          status: 'RECTIFIED_BY_CONTRACTOR',
          photos: [
            {
              photoType: 'RECTIFIED',
              storageKey: 'snags/apt2b-tile-rectified.jpg',
              caption: 'Tiles lifted, re-bedded on polymer-modified thin-set adhesive, and regrouted',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('RECTIFIED_BY_CONTRACTOR');
      expect(body.rectified_at).not.toBeNull();
      expect(body.photos).toHaveLength(2);
    });

    it('consultant verifies and closes snag item', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${projectAId}/snags/${snag1Id}/status`,
        headers: { cookie: qsCookie },
        payload: {
          status: 'VERIFIED_CLOSED',
          verifiedByName: 'Arch. Njoroge',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('VERIFIED_CLOSED');
      expect(body.verified_at).not.toBeNull();
      expect(body.verified_by_name).toBe('Arch. Njoroge');
    });

    it('lists project snags with populated photos', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/snags`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
      expect(body[0].status).toBe('VERIFIED_CLOSED');
      expect(body[0].photos).toHaveLength(2);
    });

    it('asserts AuditLog entries recorded for snag creation and status transitions', async () => {
      await withTenantTx(prisma, tenantAId, async (tx) => {
        const createLogs = await tx.auditLog.findMany({
          where: { project_id: projectAId, action: 'SNAG_ITEM_CREATED' },
        });
        expect(createLogs.length).toBeGreaterThanOrEqual(1);

        const updateLogs = await tx.auditLog.findMany({
          where: { project_id: projectAId, action: 'SNAG_STATUS_UPDATED' },
        });
        expect(updateLogs.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  // ===========================================================================
  // DOMAIN 5: DEFECTS LIABILITY CERTIFICATES & RETENTION RELEASE
  // ===========================================================================
  describe('Domain 5: Defects Liability Certificates & JBC 1999 Retention Release', () => {
    it('issues Practical Completion Certificate and auto-calculates 50% 1st moiety retention release (KES 250,000.00)', async () => {
      // Contract Sum = KES 10,000,000.00
      // 5% Retention Cap = KES 500,000.00
      // 50% Moiety at Practical Completion = KES 250,000.00
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/certificates`,
        headers: { cookie: adminCookie },
        payload: {
          certificateType: 'PRACTICAL_COMPLETION',
          certificateReference: 'CERT-PC-2026-001',
          issueDate: '2026-11-04',
          effectiveDate: '2026-11-04',
          dlpDurationMonths: 6,
          architectName: 'Arch. James Mutiso',
          architectBoraqsNo: 'A1284',
          qsName: 'QS Peter Wekesa',
          qsBoraqsNo: 'Q892',
          signedCertificateKey: 'certs/pc-cert-signed.pdf',
          notes: 'Works substantially completed in full compliance with JBC 1999 Clause 33. First moiety retention released.',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBeDefined();
      expect(body.certificate_type).toBe('PRACTICAL_COMPLETION');
      expect(body.certificate_reference).toBe('CERT-PC-2026-001');
      expect(body.retention_amount_released).toBe('250000.00');
      expect(body.dlp_expiry_date).toContain('2027-05-04');

      // Verify project status transitioned to COMPLETED
      await withTenantTx(prisma, tenantAId, async (tx) => {
        const proj = await tx.project.findUnique({ where: { id: projectAId } });
        expect(proj?.status).toBe('COMPLETED');
      });
    });

    it('issues Making Good Defects Certificate releasing remaining 50% second moiety (KES 250,000.00)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/certificates`,
        headers: { cookie: adminCookie },
        payload: {
          certificateType: 'MAKING_GOOD_DEFECTS',
          certificateReference: 'CERT-MGD-2027-001',
          issueDate: '2027-05-05',
          effectiveDate: '2027-05-04',
          dlpDurationMonths: 6,
          retentionAmountReleased: '250000.00',
          architectName: 'Arch. James Mutiso',
          architectBoraqsNo: 'A1284',
          qsName: 'QS Peter Wekesa',
          qsBoraqsNo: 'Q892',
          notes: 'All schedule defects verified made good. Final retention moiety released.',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.certificate_type).toBe('MAKING_GOOD_DEFECTS');
      expect(body.retention_amount_released).toBe('250000.00');
    });

    it('lists all project certificates', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/certificates`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(2);
    });

    it('asserts AuditLog entries recorded for certificate issuance', async () => {
      await withTenantTx(prisma, tenantAId, async (tx) => {
        const certLogs = await tx.auditLog.findMany({
          where: { project_id: projectAId, action: 'CERTIFICATE_ISSUED' },
        });
        expect(certLogs.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  // ===========================================================================
  // DOMAIN 6: STRICT MULTI-TENANT RLS ISOLATION
  // ===========================================================================
  describe('Domain 6: Strict Multi-Tenant RLS Fail-Closed Isolation', () => {
    it('prevents Tenant B from reading Tenant A RFIs (HTTP 404 Fail-Closed)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/rfis`,
        headers: { cookie: tenantBCookie },
      });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).message).toBe('Project not found');
    });

    it('prevents Tenant B from creating RFIs on Tenant A project (HTTP 404 Fail-Closed)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/rfis`,
        headers: { cookie: tenantBCookie },
        payload: {
          title: 'Malicious Cross-Tenant RFI',
          question: 'Should never be created across tenant boundaries',
          priority: 'CRITICAL',
          assignedToRole: 'ARCHITECT',
        },
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents Tenant B from reading Tenant A inspection checklists (HTTP 404 Fail-Closed)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/inspections`,
        headers: { cookie: tenantBCookie },
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents Tenant B from reading Tenant A concrete cube tests (HTTP 404 Fail-Closed)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/cube-tests`,
        headers: { cookie: tenantBCookie },
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents Tenant B from reading Tenant A snag items (HTTP 404 Fail-Closed)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/snags`,
        headers: { cookie: tenantBCookie },
      });
      expect(res.statusCode).toBe(404);
    });

    it('prevents Tenant B from reading Tenant A certificates (HTTP 404 Fail-Closed)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/certificates`,
        headers: { cookie: tenantBCookie },
      });
      expect(res.statusCode).toBe(404);
    });

    it('asserts direct database query under Tenant B withTenantTx returns 0 rows for all Tenant A tables', async () => {
      await withTenantTx(prisma, tenantBId, async (tx) => {
        // Direct query on all 5 new models with tenant B context
        const rfis = await tx.rFI.findMany({ where: { project_id: projectAId } });
        expect(rfis).toHaveLength(0);

        const checklists = await tx.inspectionChecklist.findMany({ where: { project_id: projectAId } });
        expect(checklists).toHaveLength(0);

        const cubeTests = await tx.concreteCubeTest.findMany({ where: { project_id: projectAId } });
        expect(cubeTests).toHaveLength(0);

        const snags = await tx.snagItem.findMany({ where: { project_id: projectAId } });
        expect(snags).toHaveLength(0);

        const certs = await tx.defectsLiabilityCertificate.findMany({ where: { project_id: projectAId } });
        expect(certs).toHaveLength(0);
      });
    });
  });
});
