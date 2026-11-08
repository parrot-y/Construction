import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import * as crypto from 'crypto';
import { enrollAllTenantUsers } from './test-members';

async function loginToken(server: any, email: string): Promise<string> {
  const res = await server.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email, password: 'Password123!' },
  });
  return JSON.parse(res.payload).token;
}

describe('OWASP Top 10 & Security Penetration Defense Suite', () => {
  let app: FastifyInstance;
  let tenantACookie: string;
  let tenantAId: string;
  let projectAId: string;

  let tenantBCookie: string;
  let tenantBId: string;
  let projectBId: string;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // 1. Retrieve or seed Tenant A (Apex Builders Kenya Ltd)
    const tenantA = await prisma.tenant.findFirst({
      where: { name: 'Apex Builders Kenya Ltd' },
    });
    if (!tenantA) throw new Error('Seeded tenant A not found');
    tenantAId = tenantA.id;

    // Login as Tenant A Admin
    const loginARes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(loginARes.statusCode).toBe(200);
    tenantACookie = loginARes.headers['set-cookie'] as string;

    // Create Project A under Tenant A
    const projARes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { cookie: tenantACookie },
      payload: {
        name: 'Tenant A Secured High-Rise',
        code: `SEC-A-${Date.now().toString().slice(-4)}`,
        location: 'Westlands, Nairobi',
        originalContractSum: 300000000,
      },
    });
    expect(projARes.statusCode).toBe(201);
    projectAId = JSON.parse(projARes.body).data.id;
      await enrollAllTenantUsers(projectAId);

    // 2. Setup Tenant B (Simba Construction Ltd)
    let tenantB = await prisma.tenant.findFirst({
      where: { slug: 'simba-contractors' },
    });
    if (!tenantB) {
      tenantB = await prisma.tenant.create({
        data: {
          name: 'Simba Contractors Kenya Ltd',
          slug: 'simba-contractors',
          currency: 'KES',
        },
      });
    }
    tenantBId = tenantB.id;

    // Setup Tenant B user in DB if not existing
    let userB = await prisma.user.findFirst({
      where: { email: 'admin@simbacontractors.co.ke' },
    });
    if (!userB) {
      userB = await prisma.user.create({
        data: {
          email: 'admin@simbacontractors.co.ke',
          password_hash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashforpass123$dummyhashvalue',
          full_name: 'Simba Admin',
        },
      });
    }

    // Ensure Tenant B membership inside tenant context
    await withTenantTx(prisma, tenantBId, async (tx) => {
      const membB = await tx.membership.findFirst({
        where: { tenant_id: tenantBId, user_id: userB.id },
      });
      if (!membB) {
        await tx.membership.create({
          data: {
            tenant_id: tenantBId,
            user_id: userB.id,
            role: 'COMPANY_ADMIN',
          },
        });
      }
    });

    // Sign a valid JWT session for Tenant B directly (typ:'access' required by session guard)
    const tokenB = app.jwt.sign({
      sub: userB.id,
      email: userB.email,
      fullName: userB.full_name,
      tenantId: tenantBId,
      role: 'COMPANY_ADMIN',
      typ: 'access',
    });
    tenantBCookie = `access_token=${tokenB}; Path=/; HttpOnly; SameSite=Lax`;

    // Create Project B under Tenant B
    const projBRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { cookie: tenantBCookie },
      payload: {
        name: 'Tenant B Logistics Park',
        code: `SEC-B-${Date.now().toString().slice(-4)}`,
        location: 'Mlolongo, Machakos',
        originalContractSum: 180000000,
      },
    });
    expect(projBRes.statusCode).toBe(201);
    projectBId = JSON.parse(projBRes.body).data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ===========================================================================
  // 1. OWASP A01: BROKEN ACCESS CONTROL & MULTI-TENANT ISOLATION
  // ===========================================================================
  describe('OWASP A01: Broken Access Control & Strict Tenant Isolation (PostgreSQL 18 RLS)', () => {
    it('Tenant B should be completely blind to Tenant A projects (returns 404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}`,
        headers: { cookie: tenantBCookie },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Tenant A should be completely blind to Tenant B projects (bidirectional 404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectBId}`,
        headers: { cookie: tenantACookie },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Tenant B cannot create costs on Tenant A project (returns 404/rejection)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/costs`,
        headers: { cookie: tenantBCookie },
        payload: {
          costCategory: 'MATERIAL',
          description: 'Rogue cross-tenant expense injection',
          amount: '50000.00',
        },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Tenant B cannot view Tenant A geofences (returns 404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/geofences`,
        headers: { cookie: tenantBCookie },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Tenant B cannot view or tamper with Tenant A telematics devices (returns 404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/telematics-pings`,
        headers: { cookie: tenantBCookie },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Tenant B cannot view Tenant A bar bending schedules (returns 404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/bar-bending-schedules`,
        headers: { cookie: tenantBCookie },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Tenant B cannot view Tenant A B2C disbursements (returns 404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/b2c-disbursements`,
        headers: { cookie: tenantBCookie },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Tenant B cannot initiate B2C disbursement on Tenant A project (returns 404)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/b2c-disburse`,
        headers: { cookie: tenantBCookie },
        payload: {
          disbursementType: 'CASUAL_LABOR_WAGE',
          recipientPhone: '0711223344',
          recipientName: 'Rogue Payout Worker',
          amount: '1500.00',
          idempotencyKey: `IDEM-ROGUE-${Date.now()}`,
        },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Cryptographic token tampering on public portals must be rejected with 404/401', async () => {
      const tamperedToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/portals/consultant/${tamperedToken}`,
      });
      expect([401, 404]).toContain(res.statusCode);
      expect(res.body).not.toContain('Apex Builders');
    });
  });

  // ===========================================================================
  // 2. OWASP A02: CRYPTOGRAPHIC FAILURES & SESSION SECURITY
  // ===========================================================================
  describe('OWASP A02: Cryptographic Failures & Session Integrity', () => {
    it('login response must set HttpOnly, SameSite=Lax cookie and never leak passwords in cleartext', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'admin@apexbuilders.co.ke',
          password: 'Password123!',
        },
      });

      expect(res.statusCode).toBe(200);
      const cookieHeader = ([] as string[]).concat(res.headers['set-cookie'] as any).join('; ');
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader.toLowerCase()).toContain('samesite=lax');
      expect(cookieHeader).toContain('access_token');
      expect(cookieHeader).toContain('refresh_token');
      expect(res.body).not.toContain('Password123!');
      expect(res.body).not.toContain('password_hash');
    });

    it('rejects forged JWT signed with an untrusted rogue secret key', async () => {
      const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payloadB64 = Buffer.from(
        JSON.stringify({ sub: 'attacker-uuid', tenantId: tenantAId, role: 'COMPANY_ADMIN' })
      ).toString('base64url');
      const rogueSignature = crypto
        .createHmac('sha256', 'rogue-secret-key-attacker-attempt')
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');
      const rogueToken = `${headerB64}.${payloadB64}.${rogueSignature}`;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}`,
        headers: { cookie: `access_token=${rogueToken}; Path=/; HttpOnly; SameSite=Lax` },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('Unauthorized');
    });
  });

  // ===========================================================================
  // 3. OWASP A03: INJECTION DEFENSES (SQLi, XSS, COMMAND INJECTION)
  // ===========================================================================
  describe('OWASP A03: Injection Defenses (SQL Parameterization & Input Sanitization)', () => {
    it('SQL injection in URL path parameter is strictly trapped by UUID regex', async () => {
      const maliciousId = "1' OR '1'='1";
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${maliciousId}`,
        headers: { cookie: tenantACookie },
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toBe('Not Found');

      // Check platform services routes trap SQLi in path parameters
      const bbsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${maliciousId}/bar-bending-schedules`,
        headers: { cookie: tenantACookie },
      });
      expect(bbsRes.statusCode).toBe(404);

      const b2cRes = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${maliciousId}/b2c-disbursements`,
        headers: { cookie: tenantACookie },
      });
      expect(b2cRes.statusCode).toBe(404);

      const subIdRes = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectAId}/bar-bending-schedules/${maliciousId}`,
        headers: { cookie: tenantACookie },
      });
      expect(subIdRes.statusCode).toBe(404);
    });

    it('rejects malformed or tampered status in bar bending schedule with Zod validation (HTTP 400)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${projectAId}/bar-bending-schedules/00000000-0000-0000-0000-000000000001/status`,
        headers: { cookie: tenantACookie },
        payload: {
          status: 'UNAUTHORIZED_EXPLOIT_STATUS',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('Invalid schedule status');
    });

    it('rejects non-UUID referenceId in B2C disbursement payload (HTTP 400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/b2c-disburse`,
        headers: { cookie: tenantACookie },
        payload: {
          disbursementType: 'CASUAL_LABOR_WAGE',
          referenceId: "1' OR '1'='1",
          recipientPhone: '0711223344',
          recipientName: 'Valid Worker Name',
          amount: '1200.00',
          idempotencyKey: `IDEM-SQLI-${Date.now()}`,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('Invalid referenceId format');
    });

    it('SQL injection attempt in JSON payload is safely parameterized by Prisma and does not drop tables', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects`,
        headers: { cookie: tenantACookie },
        payload: {
          name: "Test Injection'; DROP TABLE project_geofences; --",
          code: `INJ-${Date.now().toString().slice(-4)}`,
          location: 'Nairobi',
          originalContractSum: 1000000,
        },
      });

      expect(res.statusCode).toBe(201);

      // Verify project_geofences table was NOT dropped!
      const geofenceTableCheck = await prisma.$queryRaw`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_geofences'
      `;
      expect((geofenceTableCheck as any[]).length).toBe(1);
    });

    it('XSS script tags in RFI query are safely handled as data', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/rfis`,
        headers: { cookie: tenantACookie },
        payload: {
          title: "<script>alert('XSS Exploit')</script>",
          question: 'Are column rebar hooks 90 degrees or 135 degrees?',
          priority: 'MEDIUM',
          assignedToRole: 'STRUCTURAL_ENGINEER',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.title).toBe("<script>alert('XSS Exploit')</script>");
    });
  });

  // ===========================================================================
  // 4. OWASP A04: INSECURE DESIGN & FINANCIAL MATHEMATICAL INVARIANTS
  // ===========================================================================
  describe('OWASP A04: Insecure Design & Financial Math Guardrails', () => {
    it('rejects KRA e-TIMS invoice when 16% VAT arithmetic does not match', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/etims-invoices`,
        headers: { cookie: tenantACookie },
        payload: {
          invoiceNumber: `INV-TAMPER-${Date.now().toString().slice(-5)}`,
          cuInvoiceNumber: `CU-TAMPER-${Date.now().toString().slice(-6)}`,
          invoiceType: 'ORIGINAL',
          buyerPin: 'P051998877Z',
          buyerName: 'Corrupted Invoicing Corp',
          totalTaxableAmount: '100000.00',
          totalTaxAmount: '16000.00',
          totalInvoiceAmount: '150000.00', // Arithmetic mismatch! 100k + 16k != 150k
          taxBreakdown16: '16000.00',
          qrCodeUrl: 'https://itax.kra.go.ke',
          cryptographicSignature: 'TAMPERED_SIGNATURE',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('totalInvoiceAmount must equal totalTaxableAmount + totalTaxAmount');
    });

    it('rejects retention release that exceeds total retention held', async () => {
      // Create sub package first
      const pkgRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/subcontractors`,
        headers: { cookie: tenantACookie },
        payload: {
          tradeCategory: 'PLUMBING',
          firmName: 'Athi River Plumbing Services',
          contactPerson: 'David Kilonzo',
          phoneNumber: '+254711223344',
          subcontractSum: '1000000.00',
          retentionRatePct: '5.00',
          status: 'ACTIVE',
        },
      });
      expect(pkgRes.statusCode).toBe(201);
      const pkgId = JSON.parse(pkgRes.body).id;

      // Attempt to release 120,000 KES when total held is only 50,000 KES
      const relRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectAId}/subcontractor-retention-releases`,
        headers: { cookie: tenantACookie },
        payload: {
          releaseNo: `RET-INV-${Date.now().toString().slice(-4)}`,
          subcontractorPackageId: pkgId,
          moietyStage: 'FIRST_MOIETY_PRACTICAL_COMPLETION',
          totalRetentionHeld: '50000.00',
          releasePercentage: '100.00',
          releaseAmount: '120000.00', // Invalid! Release > total held
          defectClearanceVerified: true,
        },
      });

      expect(relRes.statusCode).toBe(400);
      expect(JSON.parse(relRes.body).message).toContain('Release amount');
    });
  });

  // ===========================================================================
  // 5. OWASP A05: SECURITY MISCONFIGURATION & RESPONSE SANITIZATION
  // ===========================================================================
  describe('OWASP A05: Security Misconfiguration & Error Sanitization', () => {
    it('verifies strict Helmet security headers on all HTTP responses', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('server errors (500) must never leak stack traces or internal queries in response body', async () => {
      // Inject malformed JSON to trigger internal parser / validation rejection
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: '{"malformed":',
      });

      expect(res.statusCode).toBe(400);
      expect(res.body).not.toContain('at FastifyInstance');
      expect(res.body).not.toContain('/home/maskgod/');
    });
  });

  // ===========================================================================
  // 6. OWASP A07: AUTHENTICATION FAILURES & RATE LIMITING
  // ===========================================================================
  describe('OWASP A07: Authentication Failures & Rate Limiting Throttling', () => {
    it('M-Pesa STK push rate limiter triggers HTTP 429 after threshold', async () => {
      // Rapidly fire 12 STK push requests for tenant B
      let lastRes: any;
      for (let i = 0; i < 12; i++) {
        lastRes = await app.inject({
          method: 'POST',
          url: '/api/v1/billing/mpesa-express',
          headers: { cookie: tenantBCookie },
          payload: {
            phoneNumber: '0712345678',
            planCode: 'PORTFOLIO_TIER',
            amount: '25000.00',
          },
        });
      }

      expect(lastRes.statusCode).toBe(429);
      expect(lastRes.headers['retry-after']).toBeDefined();
      expect(JSON.parse(lastRes.body).message).toContain('Too many M-Pesa STK push requests');
    });

    it('Daraja B2C disbursement rate limiter triggers HTTP 429 after threshold', async () => {
      // Rapidly fire 12 B2C disbursement requests for tenant B
      let lastRes: any;
      for (let i = 0; i < 12; i++) {
        lastRes = await app.inject({
          method: 'POST',
          url: `/api/v1/projects/${projectBId}/b2c-disburse`,
          headers: { cookie: tenantBCookie },
          payload: {
            disbursementType: 'CASUAL_LABOR_WAGE',
            recipientPhone: '0711223344',
            recipientName: 'Kamau Njoroge',
            amount: '1200.00',
            idempotencyKey: `IDEM-RATE-B2C-${Date.now()}-${i}`,
          },
        });
      }

      expect(lastRes.statusCode).toBe(429);
      expect(lastRes.headers['retry-after']).toBeDefined();
      expect(JSON.parse(lastRes.body).message).toContain('Too many B2C disbursement requests');
    });
  });

  // ===========================================================================
  // 7. OWASP A09: SECURITY LOGGING & AUDIT TRAIL IMMUTABILITY
  // ===========================================================================
  describe('OWASP A09: Security Logging & Audit Trail Immutability', () => {
    it('confirms every critical project creation and financial mutation writes to audit_logs', async () => {
      const logs = await withTenantTx(prisma, tenantAId, (tx) =>
        tx.auditLog.findMany({
          where: { project_id: projectAId },
        })
      );

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every((l) => l.tenant_id === tenantAId)).toBe(true);
      expect(logs.every((l) => l.actor_id !== null)).toBe(true);
      expect(logs.every((l) => l.created_at !== null)).toBe(true);
    });
  });
});
