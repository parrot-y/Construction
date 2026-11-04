import { describe, expect, it, beforeAll } from 'vitest';
import { prisma, withTenantTx, hashPassword } from '@construction/db';
import { buildServer } from './index';

describe('External Stakeholder Portals Suite: Token-Based Zero Seat Tax Access', () => {
  const server = buildServer();

  let adminCookie: string;
  let supervisorCookie: string;
  let tenantBCookie: string;

  let projectAId: string;
  let rfi1Id: string;
  let snag1Id: string;

  let clientToken: string;
  let consultantToken: string;
  let subcontractorToken: string;
  let supplierToken: string;
  let complianceToken: string;

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
    expect(adminBody.user.tenant.id).toBeDefined();

    // 2. Login as Site Supervisor
    const supRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'supervisor@apexbuilders.co.ke', password: 'Password123!' },
    });
    supervisorCookie = supRes.headers['set-cookie'] as string;

    // 3. Ensure Kilimanjaro Admin (Tenant B) exists and login
    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-b-portals' },
      update: {},
      create: {
        name: 'Kilimanjaro Lifecycle Engineering Ltd',
        slug: 'test-tenant-b-portals',
        currency: 'KES',
      },
    });

    const defaultPasswordHash = await hashPassword('Password123!');
    const userB = await prisma.user.upsert({
      where: { email: 'admin@kilimanjarolifecycle.co.ke' },
      update: { password_hash: defaultPasswordHash },
      create: {
        email: 'admin@kilimanjarolifecycle.co.ke',
        password_hash: defaultPasswordHash,
        full_name: 'Nelson Kibet',
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
    });

    const bRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@kilimanjarolifecycle.co.ke', password: 'Password123!' },
    });
    tenantBCookie = bRes.headers['set-cookie'] as string;
    const bBody = JSON.parse(bRes.body);
    expect(bBody.user.tenant.id).toBeDefined();

    // 4. Retrieve Tenant A project
    const projRes = await server.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { cookie: adminCookie },
    });
    const projBody = JSON.parse(projRes.body);
    projectAId = projBody.data[0].id;

    // 5. Seed an RFI, Snag, and Cube Test on Tenant A project via API
    const rfiRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/rfis`,
      headers: { cookie: supervisorCookie },
      payload: {
        title: 'Beam Reinforcement Revision at Roof Level',
        question: 'Please clarify spacing of T16 bottom bars at Grid 4-C.',
        assignedToRole: 'Structural Eng',
        priority: 'HIGH',
      },
    });
    rfi1Id = JSON.parse(rfiRes.body).id;

    const snagRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/snags`,
      headers: { cookie: supervisorCookie },
      payload: {
        locationFloor: '3rd Floor',
        locationRoom: 'Office 301',
        tradeCategory: 'Plumbing',
        assignedTradeFirm: 'Simba Plumbing Solutions',
        description: 'Waste pipe collar leak under washbasin trap',
        severity: 'FUNCTIONAL',
        identifiedByName: 'Eng. Kamau',
      },
    });
    snag1Id = JSON.parse(snagRes.body).id;

    const cubeRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/cube-tests`,
      headers: { cookie: supervisorCookie },
      payload: {
        batchReference: 'BT-EXT-2026-001',
        pourLocation: 'Roof Beam Grid 4-C',
        pourDate: '2026-10-10',
        concreteClass: 'CLASS_25_20',
        targetStrengthMpa: '25.00',
        slumpTestedMm: 90,
        supplierName: 'Bamburi Ready-Mix Nairobi',
      },
    });
    const cubeId = JSON.parse(cubeRes.body).id;

    await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/cube-tests/${cubeId}/breaks`,
      headers: { cookie: supervisorCookie },
      payload: {
        cubeNumber: 1,
        breakAgeDays: 7,
        scheduledBreakDate: '2026-10-17',
        actualBreakDate: '2026-10-17',
        crushingLoadKn: '410.00',
        labName: 'Ministry of Roads & Public Works Materials Lab',
      },
    });
  });

  // ===========================================================================
  // 1. LINK GENERATION & SECURITY GUARDS
  // ===========================================================================

  it('allows Admin to generate secure token access links for all 5 stakeholder portals', async () => {
    // 1. Client Link
    const clientRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/portals/links`,
      headers: { cookie: adminCookie },
      payload: {
        portalType: 'CLIENT',
        stakeholderName: 'Dr. Joseph Njoroge (Developer)',
        stakeholderRole: 'Client Representative',
        expiresInDays: 30,
      },
    });
    expect(clientRes.statusCode).toBe(201);
    const clientData = JSON.parse(clientRes.body).data;
    expect(clientData.token).toBeDefined();
    expect(clientData.portalType).toBe('CLIENT');
    clientToken = clientData.token;

    // 2. Consultant Link
    const consultantRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/portals/links`,
      headers: { cookie: adminCookie },
      payload: {
        portalType: 'CONSULTANT',
        stakeholderName: 'Arch. Peter Mwangi',
        stakeholderRole: 'Architect',
        expiresInDays: 60,
      },
    });
    expect(consultantRes.statusCode).toBe(201);
    consultantToken = JSON.parse(consultantRes.body).data.token;

    // 3. Subcontractor Link
    const subRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/portals/links`,
      headers: { cookie: adminCookie },
      payload: {
        portalType: 'SUBCONTRACTOR',
        stakeholderName: 'Simba Plumbing Solutions',
        stakeholderRole: 'Plumbing',
        expiresInDays: 14,
      },
    });
    expect(subRes.statusCode).toBe(201);
    subcontractorToken = JSON.parse(subRes.body).data.token;

    // 4. Supplier Link
    const supplierRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/portals/links`,
      headers: { cookie: adminCookie },
      payload: {
        portalType: 'SUPPLIER',
        stakeholderName: 'Bamburi Ready-Mix Nairobi',
        stakeholderRole: 'Concrete Batching Plant',
        expiresInDays: 90,
      },
    });
    expect(supplierRes.statusCode).toBe(201);
    supplierToken = JSON.parse(supplierRes.body).data.token;

    // 5. Compliance Link
    const compRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/portals/links`,
      headers: { cookie: adminCookie },
      payload: {
        portalType: 'COMPLIANCE',
        stakeholderName: 'Officer Daniel Odhiambo',
        stakeholderRole: 'NCA Regional Auditor',
        expiresInDays: 30,
      },
    });
    expect(compRes.statusCode).toBe(201);
    complianceToken = JSON.parse(compRes.body).data.token;
  });

  it('rejects Site Supervisor from generating portal access links (HTTP 403 Forbidden)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/portals/links`,
      headers: { cookie: supervisorCookie },
      payload: {
        portalType: 'CLIENT',
        stakeholderName: 'Unauthorized Developer',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('lists active portal access links for the project', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/portals/links`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThanOrEqual(5);
    const types = body.data.map((l: any) => l.portalType);
    expect(types).toContain('CLIENT');
    expect(types).toContain('CONSULTANT');
    expect(types).toContain('SUBCONTRACTOR');
    expect(types).toContain('SUPPLIER');
    expect(types).toContain('COMPLIANCE');
  });

  // ===========================================================================
  // 2. PUBLIC TOKEN VALIDATION
  // ===========================================================================

  it('validates active tokens and returns stakeholder identity without authentication', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/validate/${consultantToken}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body).data;
    expect(body.isValid).toBe(true);
    expect(body.portalType).toBe('CONSULTANT');
    expect(body.stakeholderName).toBe('Arch. Peter Mwangi');
    expect(body.projectName).toBeDefined();

    // Also validate Client Token
    const clientRes = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/validate/${clientToken}`,
    });
    expect(clientRes.statusCode).toBe(200);
    expect(JSON.parse(clientRes.body).data.portalType).toBe('CLIENT');
  });

  it('returns HTTP 404 Fail-Closed for an unrecognized or bogus token', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/portals/validate/bogus-hex-token-0000000000000000',
    });

    expect(res.statusCode).toBe(404);
  });

  // ===========================================================================
  // 3. CONSULTANT PORTAL (ARCHITECT & STRUCTURAL ENGINEER)
  // ===========================================================================

  it('renders consultant portal data including pending RFIs, cube tests, and checklists', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/consultant/${consultantToken}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body).data;
    expect(body.stakeholder.name).toBe('Arch. Peter Mwangi');
    expect(body.rfis.length).toBeGreaterThan(0);
    expect(body.cubeTests.length).toBeGreaterThan(0);
    expect(body.cubeTests.some((t: any) => t.batch_reference === 'BT-EXT-2026-001')).toBe(true);
  });

  it('allows consultant to answer an RFI directly via the portal link without credentials', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/consultant/${consultantToken}/rfis/${rfi1Id}/reply`,
      payload: {
        officialAnswer: 'Provide 4 No. T16 bars at 150mm centres with 30mm concrete cover.',
        consultantName: 'Arch. Peter Mwangi',
        consultantBoraqsNo: 'BORAQS A-742',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body).data;
    expect(body.is_accepted).toBe(true);
    expect(body.official_answer).toContain('Arch. Peter Mwangi');
    expect(body.official_answer).toContain('Provide 4 No. T16 bars');

    // Verify RFI status transitioned to ANSWERED
    const verifyRes = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/consultant/${consultantToken}`,
    });
    const rfis = JSON.parse(verifyRes.body).data.rfis;
    const answeredRfi = rfis.find((r: any) => r.id === rfi1Id);
    expect(answeredRfi.status).toBe('ANSWERED');
  });

  // ===========================================================================
  // 4. SUBCONTRACTOR & SPECIALIST TRADE PORTAL
  // ===========================================================================

  it('renders subcontractor portal with filtered trade snags', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/subcontractor/${subcontractorToken}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body).data;
    expect(body.stakeholder.name).toBe('Simba Plumbing Solutions');
    expect(body.snags.length).toBeGreaterThan(0);
    expect(body.snags[0].trade_category).toBe('Plumbing');
  });

  it('allows subcontractor to mark a snag rectified with after-photo storage key', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/subcontractor/${subcontractorToken}/snags/${snag1Id}/rectify`,
      payload: {
        photoStorageKey: 'uploads/snags/rectified_simba_plumbing_washbasin.jpg',
        notes: 'Tightened compression coupling and verified zero leak under pressure test.',
        gpsLat: -1.2683,
        gpsLng: 36.8044,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body).data;
    expect(body.status).toBe('RECTIFIED_BY_CONTRACTOR');
    expect(body.photos.length).toBeGreaterThan(0);
    expect(body.photos[0].photo_type).toBe('RECTIFIED');
  });

  // ===========================================================================
  // 5. MATERIAL SUPPLIER & BATCHING PLANT PORTAL
  // ===========================================================================

  it('renders material supplier delivery logs and site destination details', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/supplier/${supplierToken}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body).data;
    expect(body.stakeholder.name).toBe('Bamburi Ready-Mix Nairobi');
    expect(body.project.name).toBeDefined();
  });

  // ===========================================================================
  // 6. NCA & REGULATORY COMPLIANCE PORTAL
  // ===========================================================================

  it('renders regulatory compliance pack with NCA registration and concrete cube pass rate', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/compliance/${complianceToken}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body).data;
    expect(body.regulatoryAuditor.agency).toBe('NCA Regional Auditor');
    expect(body.complianceSummary.ncaSiteRegistration).toContain('NCA/PRJ');
    expect(body.complianceSummary.statutoryLevyPaid).toBe(true);
    expect(body.complianceSummary.certifiedSiteSupervisorPresent).toBe(true);
    expect(body.cubeTests.length).toBeGreaterThan(0);
  });

  // ===========================================================================
  // 7. MULTI-TENANT ISOLATION & FAIL-CLOSED GUARDS
  // ===========================================================================

  it('prevents Tenant B from creating portal links for Tenant A project (HTTP 404 Fail-Closed)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/portals/links`,
      headers: { cookie: tenantBCookie },
      payload: {
        portalType: 'CLIENT',
        stakeholderName: 'Intruder Developer',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects cross-portal type token usage (e.g. using supplier token on consultant portal)', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/consultant/${supplierToken}`,
    });

    expect(res.statusCode).toBe(404);
  });
});
