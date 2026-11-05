import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { generateSignedSiteOpsToken } from './services/securityConfig';

describe('Milestones M19, M20 & M21: Enterprise Operations Suite', () => {
  let app: FastifyInstance;
  let authCookie: string;
  let testTenantId: string;
  let testProjectId: string;
  let testSubcontractorPackageId: string;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // Dynamically retrieve seeded tenant (tenant table is global/not tenant-scoped)
    const tenant = await prisma.tenant.findFirst({
      where: { name: 'Apex Builders Kenya Ltd' },
    });
    if (!tenant) throw new Error('Seeded tenant Apex Builders Kenya Ltd not found');
    testTenantId = tenant.id;

    // Login as Company Admin / PM
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(loginRes.statusCode).toBe(200);
    authCookie = loginRes.headers['set-cookie'] as string;

    // Create an active test project via API (properly tenant-contextualized under RLS)
    const projectRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { cookie: authCookie },
      payload: {
        name: 'Enterprise Mjengo Tower Test',
        code: `ENT-${Date.now().toString().slice(-4)}`,
        location: 'Upper Hill, Nairobi',
        originalContractSum: 250000000,
      },
    });
    expect(projectRes.statusCode).toBe(201);
    testProjectId = JSON.parse(projectRes.body).data.id;

    // Create test subcontractor package via API
    const pkgRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${testProjectId}/subcontractors`,
      headers: { cookie: authCookie },
      payload: {
        tradeCategory: 'ELECTRICAL',
        firmName: 'Nairobi Volt Electricals Ltd',
        contactPerson: 'Eng. David Mwangi',
        phoneNumber: '+254722889900',
        subcontractSum: '1500000.00',
        retentionRatePct: '5.00',
        status: 'ACTIVE',
      },
    });
    expect(pkgRes.statusCode).toBe(201);
    testSubcontractorPackageId = JSON.parse(pkgRes.body).id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ===========================================================================
  // MILESTONE M19: KRA E-TIMS & ELECTRONIC TAX INVOICE COMPLIANCE
  // ===========================================================================
  describe('Milestone M19: Automated KRA E-TIMS Tax Invoices & TCC', () => {
    const testInvoiceNo = `INV-ETIMS-${Date.now().toString().slice(-6)}`;
    const testCuInvoiceNo = `KRAVSCU01${Date.now().toString().slice(-8)}`;

    it('should reject E-TIMS invoice with tax arithmetic mismatch', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/etims-invoices`,
        headers: { cookie: authCookie },
        payload: {
          invoiceNumber: `${testInvoiceNo}-ERR`,
          cuInvoiceNumber: `${testCuInvoiceNo}-ERR`,
          invoiceType: 'ORIGINAL',
          buyerPin: 'P051998877Z',
          buyerName: 'Riverside Commercial Center Ltd',
          totalTaxableAmount: '100000.00',
          totalTaxAmount: '16000.00',
          totalInvoiceAmount: '120000.00', // Mismatch! 100k + 16k != 120k
          taxBreakdown16: '16000.00',
          qrCodeUrl: 'https://itax.kra.go.ke',
          cryptographicSignature: 'DUMMY_SIG',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('Arithmetic mismatch');
    });

    it('should register draft simulated E-TIMS invoice with mock signature and sandbox disclaimer (C2 hardening)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/etims-invoices`,
        headers: { cookie: authCookie },
        payload: {
          invoiceNumber: testInvoiceNo,
          cuInvoiceNumber: testCuInvoiceNo,
          invoiceType: 'ORIGINAL',
          buyerPin: 'P051998877Z',
          buyerName: 'Riverside Commercial Center Ltd',
          totalTaxableAmount: '500000.00',
          totalTaxAmount: '80000.00', // 16% VAT
          totalInvoiceAmount: '580000.00',
          taxBreakdown16: '80000.00',
          qrCodeUrl: 'urn:mock-etims-qr-simulation',
          cryptographicSignature: 'MOCK_SANDBOX_SIMULATION_ONLY_NOT_OFFICIAL_KRA_SIGNATURE',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.invoiceNumber).toBe(testInvoiceNo);
      expect(body.cuInvoiceNumber).toBe(testCuInvoiceNo);
      expect(body.transmissionStatus).toBe('SIMULATED_LOCAL_DRAFT');
      expect(body.isOfficialTaxInvoice).toBe(false);
      expect(body.disclaimer).toContain('NON-PRODUCTION SIMULATION');
      expect(body.cryptographicSignature).toContain('MOCK_SANDBOX_SIMULATION_ONLY');
    });

    it('should list E-TIMS invoices with taxable and tax totals', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${testProjectId}/etims-invoices`,
        headers: { cookie: authCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalInvoices).toBeGreaterThanOrEqual(1);
      expect(parseFloat(body.summary.totalTaxAmount)).toBeGreaterThanOrEqual(80000);
      const found = body.invoices.find((i: any) => i.invoiceNumber === testInvoiceNo);
      expect(found).toBeDefined();
      expect(found.buyerPin).toBe('P051998877Z');
    });

    it('should register and track Subcontractor Tax Compliance Certificate (TCC)', async () => {
      const futureExpiry = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/subcontractor-tcc`,
        headers: { cookie: authCookie },
        payload: {
          subcontractorPackageId: testSubcontractorPackageId,
          pinNumber: 'P051122334K',
          taxpayerName: 'Nairobi Volt Electricals Ltd',
          tccNumber: 'KRA-TCC-2026-98841',
          tccExpiryDate: futureExpiry,
          complianceStatus: 'COMPLIANT',
          withholdingTaxRate: '3.00',
          withholdingVatRate: '2.00',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.tccNumber).toBe('KRA-TCC-2026-98841');
      expect(body.complianceStatus).toBe('COMPLIANT');
      expect(body.withholdingTaxRate).toBe('3.00');
    });

    it('should list Subcontractor TCC records with compliance summary', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${testProjectId}/subcontractor-tcc`,
        headers: { cookie: authCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalTracked).toBeGreaterThanOrEqual(1);
      expect(body.summary.compliantCount).toBeGreaterThanOrEqual(1);
      const found = body.records.find((r: any) => r.tccNumber === 'KRA-TCC-2026-98841');
      expect(found).toBeDefined();
    });
  });

  // ===========================================================================
  // MILESTONE M20: WHATSAPP & SMS TWO-WAY SITE OPS WEBHOOKS & ALERTS
  // ===========================================================================
  describe('Milestone M20: WhatsApp / SMS Inbound Webhook & Emergency Alert Dispatch', () => {
    it('should reject unauthenticated site-ops webhook without secret with 401 Unauthorized (C3 hardening)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/site-ops',
        headers: {
          'x-tenant-id': testTenantId,
        },
        payload: {
          senderPhone: '+254712345678',
          senderName: 'Foreman Kiprono',
          channel: 'WHATSAPP',
          rawMessage: '#DIARY 14 masons on site',
          projectId: testProjectId,
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should reject site-ops webhook without signed token with 401 Unauthorized (2b cryptographic binding)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/site-ops',
        headers: {
          'x-site-ops-secret': 'invalid-unsigned-token',
        },
        payload: {
          senderPhone: '+254712345678',
          senderName: 'Foreman Kiprono',
          channel: 'WHATSAPP',
          rawMessage: '#DIARY 14 masons on site',
          projectId: testProjectId,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).message).toContain('Invalid or missing signed site-ops webhook');
    });

    it('should parse #DIARY message and return intelligent auto-reply', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/site-ops',
        headers: {
          'x-site-ops-token': generateSignedSiteOpsToken(testTenantId),
        },
        payload: {
          senderPhone: '+254712345678',
          senderName: 'Foreman Kiprono',
          channel: 'WHATSAPP',
          rawMessage: '#DIARY 14 masons, 22 casuals on site. Column casting ongoing at 3rd floor.',
          projectId: testProjectId,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.detectedCommand).toBe('DIARY');
      expect(body.extractedData.masons).toBe(14);
      expect(body.extractedData.casuals).toBe(22);
      expect(body.replyMessage).toContain('Rekodi ya Site Diary imepokelewa');
    });

    it('should parse #DELIVERY message with quantity and summary', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/site-ops',
        headers: {
          'x-site-ops-token': generateSignedSiteOpsToken(testTenantId),
        },
        payload: {
          senderPhone: '+254722998877',
          senderName: 'Storekeeper Kamau',
          channel: 'WHATSAPP',
          rawMessage: '#DELIVERY 200 bags Bamburi Nguvu 42.5R from Athi River depot, Waybill #4901',
          projectId: testProjectId,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.detectedCommand).toBe('DELIVERY');
      expect(body.extractedData.quantity).toBe('200');
      expect(body.replyMessage).toContain('Delivery note imethibitishwa');
    });

    it('should parse critical #INCIDENT and automatically trigger emergency SiteAlertNotification', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/site-ops',
        headers: {
          'x-site-ops-token': generateSignedSiteOpsToken(testTenantId),
        },
        payload: {
          senderPhone: '+254733445566',
          senderName: 'Safety Rep Ouma',
          channel: 'WHATSAPP',
          rawMessage: '#INCIDENT CRITICAL STOP-WORK: Scaffolding collapse warning on North Elevation grid B-2. No injuries.',
          projectId: testProjectId,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.detectedCommand).toBe('INCIDENT');
      expect(body.extractedData.isSafetyCritical).toBe(true);
      expect(body.replyMessage).toContain('CRITICAL STOP-WORK');

      // Verify that SiteAlertNotification was created in DB inside tenant tx
      const alert = await withTenantTx(prisma, testTenantId, (tx) =>
        tx.siteAlertNotification.findFirst({
          where: {
            project_id: testProjectId,
            alert_type: 'CRITICAL_SAFETY_STOP_WORK',
          },
          orderBy: { created_at: 'desc' },
        })
      );
      expect(alert).toBeDefined();
      expect(alert?.recipient_role).toBe('SAFETY_OFFICER');
    });

    it('should parse #FUEL message and extract liters and operating hours', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/site-ops',
        headers: {
          'x-site-ops-token': generateSignedSiteOpsToken(testTenantId),
        },
        payload: {
          senderPhone: '+254700112233',
          senderName: 'Plant Operator Mutua',
          channel: 'WHATSAPP',
          rawMessage: '#FUEL Excavator EX-01 issued with 120 liters diesel for 7.5 hrs excavation.',
          projectId: testProjectId,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.detectedCommand).toBe('PLANT_FUEL');
      expect(body.extractedData.liters).toBe('120');
      expect(body.extractedData.hours).toBe('7.5');
    });

    it('should list and dispatch site alerts', async () => {
      // Dispatch alert
      const postRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/site-alerts`,
        headers: { cookie: authCookie },
        payload: {
          recipientPhone: '+254711223344',
          recipientName: 'Arch. James Mwangi',
          recipientRole: 'PROJECT_MANAGER',
          alertType: 'STRUCTURAL_CONCRETE_FAIL',
          messageBody: 'URGENT: 28-day cube test for Column C-12 failed target 30 MPa (Achieved 22.4 MPa). Core test requested.',
          deliveryChannel: 'WHATSAPP',
        },
      });

      expect(postRes.statusCode).toBe(201);
      const postBody = JSON.parse(postRes.body);
      expect(postBody.alertType).toBe('STRUCTURAL_CONCRETE_FAIL');
      expect(postBody.deliveryStatus).toBe('DELIVERED');

      // List alerts
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${testProjectId}/site-alerts`,
        headers: { cookie: authCookie },
      });

      expect(listRes.statusCode).toBe(200);
      const listBody = JSON.parse(listRes.body);
      expect(listBody.summary.totalAlerts).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // MILESTONE M21: RETENTION RELEASE & CONTRACTOR PERFORMANCE BONDS
  // ===========================================================================
  describe('Milestone M21: Subcontractor Retention Release & Bonds', () => {
    let createdReleaseId: string;
    const testReleaseNo = `RET-${Date.now().toString().slice(-6)}`;
    const testBondRef = `BOND-${Date.now().toString().slice(-6)}`;

    it('should reject retention release when amount exceeds allowed percentage', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/subcontractor-retention-releases`,
        headers: { cookie: authCookie },
        payload: {
          subcontractorPackageId: testSubcontractorPackageId,
          releaseNo: `${testReleaseNo}-ERR`,
          moietyStage: 'FIRST_MOIETY_PRACTICAL_COMPLETION',
          totalRetentionHeld: '100000.00',
          releasePercentage: '50.00',
          releaseAmount: '60000.00', // Exceeds 50% of 100k (50k max)!
          qsRecommendationNotes: 'First moiety release on practical completion',
          defectClearanceVerified: false,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('cannot exceed 50.00%');
    });

    it('should reject second moiety release if defect clearance is not verified per JBC 1999 Clause 34', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/subcontractor-retention-releases`,
        headers: { cookie: authCookie },
        payload: {
          subcontractorPackageId: testSubcontractorPackageId,
          releaseNo: `${testReleaseNo}-ERR2`,
          moietyStage: 'SECOND_MOIETY_FINAL_COMPLETION',
          totalRetentionHeld: '100000.00',
          releasePercentage: '50.00',
          releaseAmount: '50000.00',
          defectClearanceVerified: false, // Must be verified for second moiety!
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('requires defect clearance verification sign-off');
    });

    it('should create valid First Moiety Subcontractor Retention Release', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/subcontractor-retention-releases`,
        headers: { cookie: authCookie },
        payload: {
          subcontractorPackageId: testSubcontractorPackageId,
          releaseNo: testReleaseNo,
          moietyStage: 'FIRST_MOIETY_PRACTICAL_COMPLETION',
          totalRetentionHeld: '150000.00',
          releasePercentage: '50.00',
          releaseAmount: '75000.00',
          qsRecommendationNotes: 'Practical completion achieved; 50% retention recommended for release.',
          defectClearanceVerified: false,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.releaseNo).toBe(testReleaseNo);
      expect(body.releaseAmount).toBe('75000.00');
      expect(body.status).toBe('PENDING_QS_REVIEW');
      createdReleaseId = body.id;
    });

    it('should approve and disburse retention release with M-Pesa B2C disbursement reference', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/subcontractor-retention-releases/${createdReleaseId}/review`,
        headers: { cookie: authCookie },
        payload: {
          status: 'PAID',
          disbursementRef: 'MPESA-B2C-QA99824',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('PAID');
      expect(body.disbursementRef).toBe('MPESA-B2C-QA99824');
      expect(body.disbursedAt).toBeDefined();
    });

    it('should list subcontractor retention releases with financial totals', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${testProjectId}/subcontractor-retention-releases`,
        headers: { cookie: authCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalReleasesCount).toBeGreaterThanOrEqual(1);
      expect(parseFloat(body.summary.totalReleasedAmount)).toBeGreaterThanOrEqual(75000);
      const found = body.releases.find((r: any) => r.id === createdReleaseId);
      expect(found).toBeDefined();
      expect(found.firmName).toBe('Nairobi Volt Electricals Ltd');
    });

    it('should register and track Contractor Performance Bond', async () => {
      const startDate = new Date().toISOString().slice(0, 10);
      const expiryDate = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/contractor-bonds`,
        headers: { cookie: authCookie },
        payload: {
          bondType: 'PERFORMANCE_BOND',
          issuingInstitution: 'Kenya Commercial Bank (KCB Bank)',
          bondReferenceNo: testBondRef,
          bondAmount: '2500000.00', // 10% of contract sum
          effectiveDate: startDate,
          expiryDate: expiryDate,
          claimStatus: 'ACTIVE',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.bondType).toBe('PERFORMANCE_BOND');
      expect(body.issuingInstitution).toContain('KCB Bank');
      expect(body.bondAmount).toBe('2500000.00');
    });

    it('should list contractor bonds and calculate total guarantee sum', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${testProjectId}/contractor-bonds`,
        headers: { cookie: authCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalBonds).toBeGreaterThanOrEqual(1);
      expect(body.summary.activeCount).toBeGreaterThanOrEqual(1);
      expect(parseFloat(body.summary.totalBondAmount)).toBeGreaterThanOrEqual(2500000);
      const found = body.bonds.find((b: any) => b.bondReferenceNo === testBondRef);
      expect(found).toBeDefined();
    });
  });
});
