import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, withTenantTx } from '@construction/db';
import { buildServer } from './index';

describe('Milestone M12: Weather Delays (JBC Clause 25/32 EOT) & KRA Statutory Tax Certificates', () => {
  const server = buildServer();
  const tenantId = '582625e7-fe7d-4cf9-84fb-781966af87fa'; // Apex Builders Kenya Ltd
  let adminCookie: string;
  let supervisorCookie: string;
  let projectId: string;
  let delayEventId: string;
  let taxCertId: string;

  beforeAll(async () => {
    await server.ready();

    // 1. Authenticate as Company Admin (PM/QS authority)
    const adminLogin = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(adminLogin.statusCode).toBe(200);
    adminCookie = adminLogin.headers['set-cookie'] as string;

    // 2. Authenticate as Site Supervisor
    const superLogin = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'supervisor@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(superLogin.statusCode).toBe(200);
    supervisorCookie = superLogin.headers['set-cookie'] as string;

    // 3. Create active test project
    const projectRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { cookie: adminCookie },
      payload: {
        name: 'Kilimani Luxury Apartments Claims Test',
        code: `KLA-${Date.now().toString().slice(-4)}`,
        location: 'Kilimani, Nairobi',
        originalContractSum: 85000000,
      },
    });
    expect(projectRes.statusCode).toBe(201);
    projectId = JSON.parse(projectRes.body).data.id;
  });

  afterAll(async () => {
    await withTenantTx(prisma, tenantId, async (tx) => {
      await tx.project.deleteMany({ where: { id: projectId } });
    });
    await server.close();
  });

  // ---------------------------------------------------------------------------
  // MODULE 1: WEATHER DELAYS & JBC 1999 CLAUSE 25/32 EXTENSION OF TIME (EOT)
  // ---------------------------------------------------------------------------
  describe('Module 1: Weather Delays & EOT Claims', () => {
    it('1.1 creates a weather delay event claim with meteorological station evidence', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/delay-events`,
        headers: { cookie: supervisorCookie },
        payload: {
          delayType: 'WEATHER_INCLEMENT',
          title: 'El Niño Flash Flooding & Saturated Substructure Deck',
          startDate: '2026-03-01',
          endDate: '2026-03-14',
          daysClaimed: 14,
          criticalPathImpact: 'CRITICAL',
          dailyLadRateKes: '75000.00',
          siteDiaryReference: 'DIARY-2026-W10',
          meteorologicalProof: 'Kenya Meteorological Department - Dagoretti Corner Station: 142mm rainfall over 72 hours exceeding 10-year mean.',
          notes: 'Excavation flooded, concrete trucks unable to access site ramp due to muddy terrain.',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      delayEventId = body.id;
      expect(delayEventId).toBeDefined();
      expect(body.delay_type).toBe('WEATHER_INCLEMENT');
      expect(body.days_claimed).toBe(14);
      expect(Number(body.daily_lad_rate_kes)).toBe(75000);
      expect(body.status).toBe('PENDING_REVIEW');
    });

    it('1.2 rejects delay claim with invalid date format or negative days', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/delay-events`,
        headers: { cookie: supervisorCookie },
        payload: {
          delayType: 'WEATHER_INCLEMENT',
          title: 'Bad Claim',
          startDate: '01-03-2026', // Invalid format
          endDate: '2026-03-14',
          daysClaimed: -5,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Bad Request');
    });

    it('1.3 lists delay claims and computes initial summary metrics', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/delay-events`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.delayEvents.length).toBe(1);
      expect(body.summary.totalClaimsCount).toBe(1);
      expect(body.summary.totalDaysClaimed).toBe(14);
      expect(body.summary.totalApprovedDays).toBe(0);
      expect(body.summary.totalFinancialReliefKes).toBe('0.00');
    });

    it('1.4 Architect reviews and certifies EOT claim, computing LAD financial relief', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${projectId}/delay-events/${delayEventId}/review`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'APPROVED_BY_ARCHITECT',
          approvedDays: 10,
          certifyingAuthority: 'Arch. Peter Kamau (BORAQS #1192)',
          notes: 'Certified 10 days extension under JBC 1999 Clause 25.1(b). 4 days non-critical concurrently mitigated.',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('APPROVED_BY_ARCHITECT');
      expect(body.approved_days).toBe(10);
      // LAD relief = 10 days * KES 75,000.00 = KES 750,000.00
      expect(Number(body.lad_financial_relief_kes)).toBe(750000);
      expect(body.certifying_authority).toBe('Arch. Peter Kamau (BORAQS #1192)');
    });

    it('1.5 verifies that summary analytics reflect certified days and financial relief', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/delay-events`,
        headers: { cookie: supervisorCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.approvedClaimsCount).toBe(1);
      expect(body.summary.totalApprovedDays).toBe(10);
      expect(body.summary.totalFinancialReliefKes).toBe('750000.00');
    });
  });

  // ---------------------------------------------------------------------------
  // MODULE 2: KRA STATUTORY WITHHOLDING TAX (CAP 470) & WHVAT CERTIFICATES
  // ---------------------------------------------------------------------------
  describe('Module 2: KRA Statutory Withholding Tax (Cap 470) & WHVAT', () => {
    it('2.1 generates statutory tax certificate with 3% WHT and 2% WHVAT for IPC #1', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/tax-certificates`,
        headers: { cookie: adminCookie },
        payload: {
          payeeType: 'MAIN_CONTRACTOR',
          payeeName: 'Apex Builders Kenya Ltd',
          payeeKraPin: 'P051234567Z',
          invoiceOrIpcRef: 'IPC-KLA-001',
          grossAmount: '5000000.00',
          whtRatePct: '3.00',
          whvatRatePct: '2.00',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      taxCertId = body.id;
      expect(taxCertId).toBeDefined();
      expect(body.certificate_no).toMatch(/^KRA-WHT-/);
      expect(Number(body.gross_amount)).toBe(5000000);
      // 3% of 5,000,000 = 150,000
      expect(Number(body.wht_deducted)).toBe(150000);
      // 2% of 5,000,000 = 100,000
      expect(Number(body.whvat_deducted)).toBe(100000);
      // Net = 5,000,000 - 150,000 - 100,000 = 4,750,000
      expect(Number(body.net_payable)).toBe(4750000);
      expect(body.status).toBe('GENERATED');
    });

    it('2.2 rejects certificate generation with invalid Kenyan KRA PIN format', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/tax-certificates`,
        headers: { cookie: adminCookie },
        payload: {
          payeeType: 'TRADE_SUBCONTRACTOR',
          payeeName: 'Simba Works',
          payeeKraPin: '12345678', // Invalid PIN format
          invoiceOrIpcRef: 'SUB-01',
          grossAmount: '200000.00',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Bad Request');
    });

    it('2.3 lists tax certificates and computes withholding aggregates', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/tax-certificates`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.certificates.length).toBe(1);
      expect(body.summary.totalCertificates).toBe(1);
      expect(body.summary.totalGrossCertifiedKes).toBe('5000000.00');
      expect(body.summary.totalWhtDeductedKes).toBe('150000.00');
      expect(body.summary.totalWhvatDeductedKes).toBe('100000.00');
      expect(body.summary.totalNetDisbursedKes).toBe('4750000.00');
    });

    it('2.4 updates tax certificate remittance with KRA iTax acknowledgement receipt', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${projectId}/tax-certificates/${taxCertId}/remit`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'ACKNOWLEDGED',
          itaxAcknowledgementReceipt: 'ITAX-WH-2026-904321',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ACKNOWLEDGED');
      expect(body.itax_acknowledgement_receipt).toBe('ITAX-WH-2026-904321');
    });
  });

  // ---------------------------------------------------------------------------
  // MODULE 3: IMMUTABLE AUDIT TRAIL VERIFICATION
  // ---------------------------------------------------------------------------
  describe('Module 3: Audit Trail Verification', () => {
    it('3.1 asserts that delay claims and tax certificates recorded immutable audit logs', async () => {
      const logs = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.auditLog.findMany({
          where: { project_id: projectId },
        });
      });

      const actions = logs.map((l) => l.action);
      expect(actions).toContain('DELAY_EVENT_CLAIMED');
      expect(actions).toContain('DELAY_EVENT_REVIEWED');
      expect(actions).toContain('TAX_CERTIFICATE_GENERATED');
      expect(actions).toContain('TAX_CERTIFICATE_REMITTED');
    });
  });
});
