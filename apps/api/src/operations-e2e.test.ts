import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from './index';
import { prisma, withTenantTx, hashPassword } from '@construction/db';
import { enrollAllTenantUsers } from './test-members';
import {
  toDecimal,
  convertDiasporaCurrency,
  formatDiasporaCurrency,
} from '@construction/money';

interface CatalogRow {
  relname: string;
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
}

interface CurrentUserRole {
  current_user: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
}

describe('Operations E2E Integration Suite', () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let pmCookie: string;
  let clientCookie: string;
  let _supervisorCookie: string;
  let tenantBCookie: string;

  let _tenantAId: string;
  let tenantBId: string;
  let projectAId: string;
  let tenderId: string;
  let winningBidId: string;
  let inspectionId: string;

  const testProjectCode = `VILLA-${Date.now().toString().slice(-4)}`;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // 1. Retrieve or seed Tenant A (Apex Builders Kenya Ltd)
    const tenantA = await prisma.tenant.findFirst({
      where: { name: 'Apex Builders Kenya Ltd' },
    });
    if (!tenantA) throw new Error('Seeded tenant Apex Builders Kenya Ltd not found');
    _tenantAId = tenantA.id;

    // 2. Login as Company Admin
    const adminLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(adminLoginRes.statusCode).toBe(200);
    adminCookie = adminLoginRes.headers['set-cookie'] as string;

    // 3. Login as PM_QS (Authorized to create tenders, evaluate, award, and submit inspection findings)
    const pmLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'qs@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(pmLoginRes.statusCode).toBe(200);
    pmCookie = pmLoginRes.headers['set-cookie'] as string;

    // 4. Login as Diaspora Client (Authorized to order inspections, view tenders, rate & review reports)
    const clientLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'client@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(clientLoginRes.statusCode).toBe(200);
    clientCookie = clientLoginRes.headers['set-cookie'] as string;

    // 5. Login as Site Supervisor
    const supLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'supervisor@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(supLoginRes.statusCode).toBe(200);
    _supervisorCookie = supLoginRes.headers['set-cookie'] as string;
    expect(_supervisorCookie).toBeDefined();
    expect(_tenantAId).toBeDefined();

    // 5. Seed and Login as Tenant B (Cross-Tenant Isolation Adversary)
    const defaultPasswordHash = await hashPassword('Password123!');
    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'test-platform-tenant-b' },
      update: {},
      create: {
        name: 'Kilimanjaro Development Ltd',
        slug: 'test-platform-tenant-b',
        currency: 'KES',
      },
    });
    tenantBId = tenantB.id;

    const userB = await prisma.user.upsert({
      where: { email: 'admin@kilimanjarodev-b.co.ke' },
      update: { password_hash: defaultPasswordHash },
      create: {
        email: 'admin@kilimanjarodev-b.co.ke',
        password_hash: defaultPasswordHash,
        full_name: 'Daniel Kiptoo',
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

    const tenantBLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@kilimanjarodev-b.co.ke',
        password: 'Password123!',
      },
    });
    expect(tenantBLoginRes.statusCode).toBe(200);
    tenantBCookie = tenantBLoginRes.headers['set-cookie'] as string;

    // 7. Create active Residential Villa project in Tenant A
    const projectRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { cookie: adminCookie },
      payload: {
        name: 'Runda Estate Luxury 4-Bedroom Villa',
        code: testProjectCode,
        location: 'Runda Mimosa Drive, Nairobi',
        originalContractSum: 45000000.0,
      },
    });
    expect(projectRes.statusCode).toBe(201);
    projectAId = JSON.parse(projectRes.body).data.id;
      await enrollAllTenantUsers(projectAId);
  });

  afterAll(async () => {
    // Clean up Tenant B test data
    await prisma.tenant.deleteMany({
      where: { slug: 'test-platform-tenant-b' },
    });
    await prisma.$disconnect();
  });

  // ===========================================================================
  // AUDIT AREA 2: PostgreSQL 18 Row-Level Security Verification
  // ===========================================================================
  it('RLS-01: Verifies that operations tables enforce ENABLE and FORCE ROW LEVEL SECURITY under db_app', async () => {
    const opsTables = [
      'independent_site_inspections',
      'independent_inspection_photos',
      'project_tenders',
      'tender_bids',
    ];

    // Assert tables have relrowsecurity=true and relforcerowsecurity=true in pg_class catalog
    const catalogRows = await prisma.$queryRaw<CatalogRow[]>`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = ANY(${opsTables});
    `;

    expect(catalogRows.length).toBe(opsTables.length);
    for (const row of catalogRows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }

    // Assert that the runtime database role is db_app (non-superuser and non-BYPASSRLS)
    const roleInfo = await prisma.$queryRaw<CurrentUserRole[]>`
      SELECT current_user, rolsuper, rolbypassrls 
      FROM pg_roles 
      WHERE rolname = current_user
    `;
    expect(roleInfo.length).toBeGreaterThan(0);
    const { rolsuper, rolbypassrls } = roleInfo[0]!;
    expect(rolsuper).toBe(false);
    expect(rolbypassrls).toBe(false);
  });

  // ===========================================================================
  // AUDIT AREA 1 & 3: Platform Contractor Tender Board & 70/30 Scoring Engine
  // ===========================================================================
  it('TND-01: Step (a & b) - PM_QS logs in and posts a Project Tender for KES 45,000,000 (Residential Villa)', async () => {
    const tenderPayload = {
      tenderCode: `TND-${Date.now().toString().slice(-5)}`,
      title: 'Construction of 4-Bedroom Luxury Residential Villa with Borehole & Boundary Wall',
      tradeCategory: 'RESIDENTIAL_VILLA',
      scopeOfWork: 'Complete civil and architectural works for modern 4-bedroom villa: substructure excavation, reinforced concrete frame, natural stone masonry, timber truss roofing with decra tiles, luxury porcelain finishes, MEP services, perimeter boundary wall and solar-powered borehole.',
      budgetKes: '45000000.00',
      durationWeeks: 36,
      submissionDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/tenders`,
      headers: { cookie: pmCookie },
      payload: tenderPayload,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBeDefined();
    expect(body.title).toBe(tenderPayload.title);
    expect(body.tradeCategory).toBe('RESIDENTIAL_VILLA');
    expect(toDecimal(body.budgetKes).toFixed(2)).toBe('45000000.00');
    expect(body.status).toBe('PUBLISHED');
    tenderId = body.id;
  });

  it('TND-02: Step (c) - Submits 3 competing contractor bids with EASMM trade breakdown', async () => {
    // Bid 1: Simba Premier Builders Ltd (NCA 1, High Technical Score 92%, Compliant EASMM Breakdown)
    const bid1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/tenders/${tenderId}/bids`,
      headers: { cookie: pmCookie },
      payload: {
        contractorName: 'Simba Premier Builders Ltd',
        contractorNcaCategory: 'NCA 1',
        amountKes: '43500000.00',
        durationWeeks: 32,
        technicalScore: 92.0,
        proposalNotes: 'Over 15 years prime experience delivering high-end villas in Runda and Karen. Fully staffed with registered QS, structural engineers, and ISO certified quality controls.',
        easmmTradeBreakdown: {
          substructure: 6500000,
          concreteFrame: 12000000,
          wallingAndPartitions: 5500000,
          roofingAndFinishes: 8000000,
          plumbingAndDrainage: 4000000,
          electricalInstallations: 4000000,
          boundaryWallAndBorehole: 3500000,
        },
      },
    });
    expect(bid1Res.statusCode).toBe(201);
    const bid1 = JSON.parse(bid1Res.body);
    winningBidId = bid1.id;
    expect(bid1.contractorName).toBe('Simba Premier Builders Ltd');
    expect(toDecimal(bid1.amountKes).toFixed(2)).toBe('43500000.00');

    // Bid 2: Nairobi Quick Contractors Ltd (NCA 3, Lowest price 41,000,000, but lower technical score 68%)
    const bid2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/tenders/${tenderId}/bids`,
      headers: { cookie: pmCookie },
      payload: {
        contractorName: 'Nairobi Quick Contractors Ltd',
        contractorNcaCategory: 'NCA 3',
        amountKes: '41000000.00',
        durationWeeks: 28,
        technicalScore: 68.0,
        proposalNotes: 'Fast-track contractor specializing in low-cost builds. Subcontracting MEP works.',
        easmmTradeBreakdown: {
          substructure: 6000000,
          concreteFrame: 11000000,
          wallingAndPartitions: 5000000,
          roofingAndFinishes: 7500000,
          plumbingAndDrainage: 4000000,
          electricalInstallations: 4000000,
          boundaryWallAndBorehole: 3500000,
        },
      },
    });
    expect(bid2Res.statusCode).toBe(201);

    // Bid 3: Rift Valley Civil Works Ltd (NCA 2, Over-budget 47,200,000, moderate technical score 78%)
    const bid3Res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/tenders/${tenderId}/bids`,
      headers: { cookie: pmCookie },
      payload: {
        contractorName: 'Rift Valley Civil Works Ltd',
        contractorNcaCategory: 'NCA 2',
        amountKes: '47200000.00',
        durationWeeks: 40,
        technicalScore: 78.0,
        proposalNotes: 'Experienced regional civil contractor with heavy earthmoving plant.',
        easmmTradeBreakdown: {
          substructure: 7200000,
          concreteFrame: 13000000,
          wallingAndPartitions: 6000000,
          roofingAndFinishes: 8500000,
          plumbingAndDrainage: 4200000,
          electricalInstallations: 4300000,
          boundaryWallAndBorehole: 4000000,
        },
      },
    });
    expect(bid3Res.statusCode).toBe(201);
  });

  it('TND-03: Step (d) - Evaluates and ranks bids using 70/30 weighted formula (70% technical, 30% financial)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/tenders/${tenderId}/bids`,
      headers: { cookie: pmCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.totalBidsCount).toBe(3);

    const bids = body.bids;
    expect(bids.length).toBe(3);

    // Rank 1 Bidder Verification:
    // Simba Premier Builders Ltd has high technical (92) and near-lowest price:
    // Technical Weighted: 92 * 0.70 = 64.40
    // Financial Weighted: (41,000,000 / 43,500,000) * 100 * 0.30 = 28.28
    // Combined Score: 64.40 + 28.28 = 92.68
    const rank1 = bids[0];
    expect(rank1.rank).toBe(1);
    expect(rank1.contractorName).toBe('Simba Premier Builders Ltd');
    expect(rank1.technicalScore).toBe(92);
    expect(rank1.combinedScore).toBeGreaterThan(90);

    // Lowest bidder Nairobi Quick Contractors has Rank 3 despite lowest price due to low technical score:
    // Technical Weighted: 68 * 0.70 = 47.60
    // Financial Weighted: 100 * 0.30 = 30.00
    // Combined Score: 77.60
    const rank3 = bids[2];
    expect(rank3.contractorName).toBe('Nairobi Quick Contractors Ltd');
    expect(rank3.isLowestBid).toBe(true);
    expect(rank3.financialScore).toBe(100);
    expect(rank3.combinedScore).toBe(77.6);
  });

  it('TND-04: Step (e) - Formally awards tender to winning contractor', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectAId}/tenders/${tenderId}/bids/${winningBidId}/award`,
      headers: { cookie: pmCookie },
      payload: {
        awardReason: 'Highest combined score (92.68%) under 70/30 technical/financial weighted evaluation, NCA 1 certified, compliant EASMM trade breakdown.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('AWARDED');
    expect(body.awardedBidId).toBe(winningBidId);
    expect(body.winningContractor.contractorName).toBe('Simba Premier Builders Ltd');
    expect(body.winningContractor.bidStatus).toBe('AWARDED');
  });

  // ===========================================================================
  // AUDIT AREA 1 & 3: Diaspora Client Portal & Neutral Independent Site Inspection
  // ===========================================================================
  it('INSP-01: Step (f) - Diaspora Client requests an unannounced independent site inspection for substructure stage', async () => {
    const inspectionPayload = {
      inspectionCode: `INSP-SUB-${Date.now().toString().slice(-4)}`,
      stage: 'SUBSTRUCTURE',
      scheduledDate: new Date().toISOString(),
      scopeDescription: 'Unannounced neutral independent site inspection audit for residential villa substructure and foundation stage',
      reportedProgressPct: 55.0, // Contractor claims 55% progress to justify milestone drawdown
      inspectorName: 'Eng. Francis Kimani (BORAQS / EBK Certified)',
      inspectorLicense: 'BORAQS/QS/2026/0582',
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/independent-inspections`,
      headers: { cookie: clientCookie },
      payload: inspectionPayload,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBeDefined();
    expect(body.status).toBe('REQUESTED');
    expect(body.reportedProgressPct).toBe('55.00');
    expect(body.scopeDescription).toBe(inspectionPayload.scopeDescription);
    inspectionId = body.id;
  });

  it('INSP-02: Step (g & h) - Inspector submits findings with GPS, cement brand & rebar verification; engine flags CRITICAL_INFLATION (-15%)', async () => {
    const findingsPayload = {
      gpsLatitude: -1.2185421,
      gpsLongitude: 36.8123187,
      verifiedProgressPct: 40.0, // Inspector objectively measures and verifies only 40.0% completion
      materialsOnSiteNotes: 'Cement Brand Verified: Bamburi Powerplus 42.5N (500 bags checked for moisture/clumping, unexpired). Rebar Verified: High-Yield Ribbed Bars D16 (footing steel), D12 (starter columns), D10 (stirrups) conforming to BS 4449 / KEBS KS 573.',
      workmanshipRating: 4,
      safetyComplianceRating: 4,
      structuralDefectsFound: false,
      findingsNotes: 'Excavation to depth of 1.8m completed into solid red coffee soil. Blinding concrete and foundation footing poured. Foundation walling up to DPC level is only 35% erected. Hardcore filling and compacting pending.',
      recommendations: 'Contractor progress claim is materially inflated by 15.0% (claimed 55% vs verified 40%). Withhold interim disbursement pending QS joint remeasurement.',
      photos: [
        {
          photoUrl: 'https://storage.example.com/inspections/runda-footing-d16.jpg',
          caption: 'Foundation footing with D16 high-yield deformed bars verified',
          elementInspected: 'REBAR',
          hasDiscrepancy: false,
          gpsLatitude: -1.2185421,
          gpsLongitude: 36.8123187,
        },
        {
          photoUrl: 'https://storage.example.com/inspections/bamburi-cement-batch.jpg',
          caption: 'Bamburi Powerplus 42.5N cement bags on site docket',
          elementInspected: 'CEMENT',
          hasDiscrepancy: false,
          gpsLatitude: -1.2185421,
          gpsLongitude: 36.8123187,
        },
        {
          photoUrl: 'https://storage.example.com/inspections/incomplete-dpc-walling.jpg',
          caption: 'Incomplete foundation walling contradicts contractor claimed 55% milestone',
          elementInspected: 'FOUNDATION_WALLING',
          hasDiscrepancy: true,
          gpsLatitude: -1.2185421,
          gpsLongitude: 36.8123187,
        },
      ],
    };

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectAId}/independent-inspections/${inspectionId}/submit`,
      headers: { cookie: pmCookie },
      payload: findingsPayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // Verified Progress & Variance Assertions:
    expect(body.status).toBe('SUBMITTED');
    expect(body.reportedProgressPct).toBe('55.00');
    expect(body.verifiedProgressPct).toBe('40.00');

    // Progress Variance Engine Invariant: Delta = 40.00 - 55.00 = -15.00%
    expect(body.variancePct).toBe('-15.00');
    expect(body.varianceStatus).toBe('CRITICAL_INFLATION');
    expect(body.alertRequired).toBe(true);
    expect(body.discrepancyMessage).toContain('Critical progress inflation detected');
    expect(body.discrepancyMessage).toContain('15.0%');
    expect(body.discrepancyMessage).toContain('Immediate payment withholding recommended');
    expect(body.photosCount).toBe(3);

    // Automated Diaspora WhatsApp / SMS Alert Invariant
    expect(body.whatsappNotification).toBeDefined();
    expect(body.whatsappNotification.dispatched).toBe(true);
    expect(body.whatsappNotification.alertType).toBe('CRITICAL_INFLATION_ALERT');
    expect(body.whatsappNotification.messageBody).toContain('URGENT ALERT');
  });

  it('PDF-01: Generates certified BORAQS forensic inspection PDF with cryptographic SHA-256 seal and returns 200 application/pdf', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/reports/independent-inspections/${inspectionId}`,
      headers: { cookie: clientCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('.pdf');

    // PDF magic bytes verification: must start with %PDF-
    const rawBuffer = res.rawPayload;
    expect(rawBuffer.slice(0, 5).toString('utf-8')).toBe('%PDF-');
  });

  it('ALERT-02: Manual WhatsApp / SMS client notification dispatch triggers instant diaspora alert digest', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/independent-inspections/${inspectionId}/notify-client`,
      headers: { cookie: pmCookie },
      payload: {
        channel: 'WHATSAPP',
        recipientPhone: '+44 7700 900123',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.channel).toBe('WHATSAPP');
    expect(body.recipientPhone).toBe('+44 7700 900123');
    expect(['DELIVERED','SIMULATED']).toContain(body.deliveryStatus);
    expect(body.pdfReportUrl).toContain(`/api/v1/projects/${projectAId}/reports/independent-inspections/${inspectionId}`);
  });

  it('INSP-03: Step (i) - Diaspora Client reviews report, gives 4-star rating, and enters feedback notes', async () => {
    const reviewPayload = {
      clientSatisfactionRating: 4,
      clientReviewNotes: 'Diaspora owner review from London: Independent inspection report was prompt and objective. Stopped contractor from overbilling 15% on substructure. Will require joint remeasurement before releasing any funds.',
      clientDiscrepancyFlagged: true,
    };

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectAId}/independent-inspections/${inspectionId}/client-review`,
      headers: { cookie: clientCookie },
      payload: reviewPayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('REVIEWED');
    expect(body.clientSatisfactionRating).toBe(4);
    expect(body.clientReviewNotes).toContain('Diaspora owner review from London');
    expect(body.clientDiscrepancyFlagged).toBe(true);
  });

  // ===========================================================================
  // AUDIT AREA 2: Intra-Tenant RBAC & Cross-Tenant Security Invariants
  // ===========================================================================
  it('RBAC-01: Step (k) - CLIENT role cannot submit inspector findings (returns 403 Forbidden)', async () => {
    const unauthorizedPayload = {
      gpsLatitude: -1.2185,
      gpsLongitude: 36.8123,
      verifiedProgressPct: 50.0,
      materialsOnSiteNotes: 'Client attempting self-certification',
    };

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectAId}/independent-inspections/${inspectionId}/submit`,
      headers: { cookie: clientCookie }, // CLIENT role forbidden
      payload: unauthorizedPayload,
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('Client users are not permitted to submit inspection findings');
  });

  it('RBAC-02: Intra-tenant RBAC prevents CLIENT from creating tenders or awarding contracts', async () => {
    // 1. Client attempting to post tender
    const tenderRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/tenders`,
      headers: { cookie: clientCookie },
      payload: {
        title: 'Unauthorized Client Tender',
        tradeCategory: 'GENERAL',
        scopeOfWork: 'Test scope',
        budgetKes: 10000000,
        durationWeeks: 12,
        submissionDeadline: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    expect(tenderRes.statusCode).toBe(403);

    // 2. Client attempting to award tender
    const awardRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectAId}/tenders/${tenderId}/bids/${winningBidId}/award`,
      headers: { cookie: clientCookie },
      payload: { awardReason: 'Client arbitrary award' },
    });
    expect(awardRes.statusCode).toBe(403);
  });

  it('ISOLATION-01: Step (j) - PostgreSQL RLS Cross-Tenant Isolation: Tenant B receives 404 and zero data leaks', async () => {
    // 1. Tenant B attempting to fetch Tenant A inspection
    const crossInspRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/independent-inspections/${inspectionId}`,
      headers: { cookie: tenantBCookie },
    });
    expect(crossInspRes.statusCode).toBe(404);

    // 2. Tenant B attempting to list Tenant A tenders
    const crossTenderRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/tenders`,
      headers: { cookie: tenantBCookie },
    });
    expect(crossTenderRes.statusCode).toBe(404);

    // 3. Direct PostgreSQL transactional query under Tenant B context returns 0 rows
    await withTenantTx(prisma, tenantBId, async (tx) => {
      const leakedInspections = await tx.independentSiteInspection.findMany({
        where: { id: inspectionId },
      });
      expect(leakedInspections).toHaveLength(0);

      const leakedTenders = await tx.projectTender.findMany({
        where: { id: tenderId },
      });
      expect(leakedTenders).toHaveLength(0);
    });
  });

  // ===========================================================================
  // AUDIT AREA 1: Zero Seat Tax Stakeholder Portals & Multi-Currency Support
  // ===========================================================================
  it('PORTAL-01: Zero Seat Tax tokenized link access for all 4 external stakeholder roles without user licensing fees', async () => {
    const rolesToTest = ['CONSULTANT', 'SUBCONTRACTOR', 'SUPPLIER', 'COMPLIANCE'] as const;

    // SUBCONTRACTOR links must bind to a work package on the project
    const pkgRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/subcontractors`,
      headers: { cookie: pmCookie, 'content-type': 'application/json' },
      payload: {
        tradeCategory: 'PLUMBING',
        firmName: 'External SUBCONTRACTOR Partner',
        subcontractSum: '500000.00',
        retentionRatePct: '5.00',
        status: 'ACTIVE',
      },
    });
    expect(pkgRes.statusCode).toBe(201);
    const pkgData = JSON.parse(pkgRes.body);
    const subPackageId = pkgData.id || pkgData.data?.id;

    for (const portalRole of rolesToTest) {
      const linkRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/portals/links`,
        headers: { cookie: pmCookie },
        payload: {
          portalType: portalRole,
          stakeholderName: `External ${portalRole} Partner`,
          stakeholderRole: `${portalRole} Specialist`,
          expiresInDays: 30,
          ...(portalRole === 'SUBCONTRACTOR' ? { subcontractorPackageId: subPackageId } : {}),
        },
      });

      expect(linkRes.statusCode).toBe(201);
      const linkData = JSON.parse(linkRes.body).data;
      expect(linkData.token).toBeDefined();
      expect(linkData.portalType).toBe(portalRole);

      // Access unauthenticated external portal with token
      const portalPath = portalRole.toLowerCase();
      const accessRes = await app.inject({
        method: 'GET',
        url: `/api/v1/portals/${portalPath}/${linkData.token}`,
      });
      expect(accessRes.statusCode).toBe(200);
      const portalContent = JSON.parse(accessRes.body);
      expect(portalContent.data.project.id).toBe(projectAId);
    }
  });

  it('FX-01: Multi-Currency Diaspora Support: Converts KES 45,000,000 to USD, GBP, EUR, and AED without precision loss', async () => {
    const villaBudgetKes = '45000000.00';

    // USD Conversion (1 USD = 129.50 KES)
    const inUsd = convertDiasporaCurrency(villaBudgetKes, 'KES', 'USD');
    expect(inUsd.toNumber()).toBeCloseTo(347490.35, 1);
    expect(formatDiasporaCurrency(inUsd, 'USD')).toContain('$347490.35');

    // GBP Conversion (1 GBP = 165.20 KES)
    const inGbp = convertDiasporaCurrency(villaBudgetKes, 'KES', 'GBP');
    expect(inGbp.toNumber()).toBeCloseTo(272397.09, 1);
    expect(formatDiasporaCurrency(inGbp, 'GBP')).toContain('£272397.09');

    // EUR Conversion (1 EUR = 140.80 KES)
    const inEur = convertDiasporaCurrency(villaBudgetKes, 'KES', 'EUR');
    expect(inEur.toNumber()).toBeCloseTo(319602.27, 1);
    expect(formatDiasporaCurrency(inEur, 'EUR')).toContain('€319602.27');

    // AED Conversion (1 AED = 35.25 KES)
    const inAed = convertDiasporaCurrency(villaBudgetKes, 'KES', 'AED');
    expect(inAed.toNumber()).toBeCloseTo(1276595.74, 1);
    expect(formatDiasporaCurrency(inAed, 'AED')).toContain('AED 1276595.74');
  });
});
