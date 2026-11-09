import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { prisma, withTenantTx } from '@construction/db';
import { buildServer } from './index';
import {
  evaluateFuelDiscrepancyAnomaly,
  FuelDiscrepancyEvaluation,
} from '@construction/money';
import {
  validateEnvironmentSecurity,
  timingSafeCompare,
  generateSignedSiteOpsToken,
} from './services/securityConfig';

describe('Audit Remediation Step 2 Verification Suite (C1, C3, H4, H5, M1)', () => {
  // ===========================================================================
  // 2a. HARD-CODED FALLBACK SECRETS & PRODUCTION FAIL-CLOSED BOOT
  // ===========================================================================
  describe('2a: Production Webhook Secrets & Constant-Time Comparison', () => {
    it('refuses server initialization in production if MPESA_WEBHOOK_SECRET is missing or < 32 chars', () => {
      const origEnv = process.env.NODE_ENV;
      const origMpesa = process.env.MPESA_WEBHOOK_SECRET;
      const origSite = process.env.SITE_OPS_WEBHOOK_SECRET;

      try {
        process.env.NODE_ENV = 'production';
        process.env.SITE_OPS_WEBHOOK_SECRET = 'a'.repeat(32);

        // 1. Missing secret throws
        delete process.env.MPESA_WEBHOOK_SECRET;
        expect(() => validateEnvironmentSecurity()).toThrow(
          /MPESA_WEBHOOK_SECRET must be set and at least 32 characters/
        );

        // 2. Short secret (< 32 chars) throws
        process.env.MPESA_WEBHOOK_SECRET = 'short-secret-123';
        expect(() => validateEnvironmentSecurity()).toThrow(
          /MPESA_WEBHOOK_SECRET must be set and at least 32 characters/
        );

        // 3. Valid 32-char secret passes
        process.env.MPESA_WEBHOOK_SECRET = 'a'.repeat(32);
        expect(() => validateEnvironmentSecurity()).not.toThrow();
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origMpesa) process.env.MPESA_WEBHOOK_SECRET = origMpesa;
        else delete process.env.MPESA_WEBHOOK_SECRET;
        if (origSite) process.env.SITE_OPS_WEBHOOK_SECRET = origSite;
        else delete process.env.SITE_OPS_WEBHOOK_SECRET;
      }
    });

    it('refuses server initialization in production if SITE_OPS_WEBHOOK_SECRET is missing or < 32 chars', () => {
      const origEnv = process.env.NODE_ENV;
      const origMpesa = process.env.MPESA_WEBHOOK_SECRET;
      const origSite = process.env.SITE_OPS_WEBHOOK_SECRET;

      try {
        process.env.NODE_ENV = 'production';
        process.env.MPESA_WEBHOOK_SECRET = 'a'.repeat(32);

        // 1. Missing secret throws
        delete process.env.SITE_OPS_WEBHOOK_SECRET;
        expect(() => validateEnvironmentSecurity()).toThrow(
          /SITE_OPS_WEBHOOK_SECRET must be set and at least 32 characters/
        );

        // 2. Short secret (< 32 chars) throws
        process.env.SITE_OPS_WEBHOOK_SECRET = 'short-site-ops-secret';
        expect(() => validateEnvironmentSecurity()).toThrow(
          /SITE_OPS_WEBHOOK_SECRET must be set and at least 32 characters/
        );

        // 3. Valid secret passes
        process.env.SITE_OPS_WEBHOOK_SECRET = 'b'.repeat(32);
        expect(() => validateEnvironmentSecurity()).not.toThrow();
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origMpesa) process.env.MPESA_WEBHOOK_SECRET = origMpesa;
        else delete process.env.MPESA_WEBHOOK_SECRET;
        if (origSite) process.env.SITE_OPS_WEBHOOK_SECRET = origSite;
        else delete process.env.SITE_OPS_WEBHOOK_SECRET;
      }
    });

    it('uses timingSafeCompare with crypto.timingSafeEqual for constant-time verification', () => {
      const secret = 'super-secret-key-for-testing-purposes-1234';
      expect(timingSafeCompare(secret, secret)).toBe(true);
      expect(timingSafeCompare(secret, secret + 'x')).toBe(false);
      expect(timingSafeCompare(secret, 'wrong-secret')).toBe(false);
      expect(timingSafeCompare(null, secret)).toBe(false);
      expect(timingSafeCompare(undefined, secret)).toBe(false);
      expect(timingSafeCompare('', '')).toBe(false);
    });
  });

  // ===========================================================================
  // 2c & 2d. REMOVE AUTH_CONTEXT & STORE PORTAL TOKENS AS SHA-256 HASHES
  // ===========================================================================
  describe('2c & 2d: Eliminate auth_context RLS Bypasses & Store Portal Tokens as SHA-256', () => {
    it('proves setting auth_context = login cannot bypass RLS on memberships', async () => {
      // Without app.current_tenant_id set, setting auth_context must NOT return rows
      const rows = await prisma.$queryRaw<any[]>`
        SELECT * FROM memberships WHERE user_id IS NOT NULL;
      `;
      expect(rows.length).toBe(0);

      // Attempting to set auth_context = 'login' must NOT widen access
      const rowsWithLoginContext = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.auth_context', 'login', TRUE)`;
        return tx.$queryRaw<any[]>`SELECT * FROM memberships;`;
      });
      expect(rowsWithLoginContext.length).toBe(0);
    });

    it('proves setting auth_context = portal cannot bypass RLS on portal_access_links', async () => {
      // Without app.current_tenant_id set, setting auth_context must NOT return rows
      const rows = await prisma.$queryRaw<any[]>`
        SELECT * FROM portal_access_links;
      `;
      expect(rows.length).toBe(0);

      const rowsWithPortalContext = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.auth_context', 'portal', TRUE)`;
        return tx.$queryRaw<any[]>`SELECT * FROM portal_access_links;`;
      });
      expect(rowsWithPortalContext.length).toBe(0);
    });

    it('verifies narrow SECURITY DEFINER lookup_portal_link_by_hash resolves by SHA-256 hash', async () => {
      const tenantA = await prisma.tenant.findFirst({ where: { slug: 'apex-builders' } });
      expect(tenantA).toBeDefined();

      const rawSecret = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawSecret).digest('hex');

      // Seed portal link with token_hash via withTenantTx
      const project = await withTenantTx(prisma, tenantA!.id, async (tx) => {
        const proj = await tx.project.findFirst({ where: { tenant_id: tenantA!.id } });
        return proj!;
      });

      await withTenantTx(prisma, tenantA!.id, async (tx) => {
        await tx.portalAccessLink.create({
          data: {
            tenant_id: tenantA!.id,
            project_id: project.id,
            portal_type: 'CONSULTANT',
            stakeholder_name: 'Eng. Test Consultant',
            stakeholder_role: 'Structural Engineer',
            token_hash: tokenHash,
            is_active: true,
            expires_at: new Date(Date.now() + 86400000),
          },
        });
      });

      // 1. Lookup by SHA-256 hash succeeds via narrow SECURITY DEFINER function
      const resolved = await prisma.$queryRaw<any[]>`
        SELECT * FROM lookup_portal_link_by_hash(${tokenHash}::text);
      `;
      expect(resolved.length).toBe(1);
      expect(resolved[0].stakeholder_name).toBe('Eng. Test Consultant');
      expect(resolved[0].tenant_id).toBe(tenantA!.id);

      // 2. Lookup with wrong hash returns 0 rows
      const wrongHash = crypto.createHash('sha256').update('wrong-token').digest('hex');
      const empty = await prisma.$queryRaw<any[]>`
        SELECT * FROM lookup_portal_link_by_hash(${wrongHash}::text);
      `;
      expect(empty.length).toBe(0);
    });
  });

  // ===========================================================================
  // 2b. DO NOT TRUST TENANT ID ON CALLBACKS & INGEST (CRYPTOGRAPHIC BINDING)
  // ===========================================================================
  describe('2b: Cryptographic Tenant Binding for Inbound Callbacks & Ingest', () => {
    it('site-ops webhook rejects untrusted x-tenant-id header without valid signed token', async () => {
      const server = buildServer();
      const testSecret = 'test-site-ops-secret-with-minimum-32-chars-long';
      process.env.SITE_OPS_WEBHOOK_SECRET = testSecret;

      const randomTenantId = crypto.randomUUID();

      // Attempting to pass x-tenant-id without signed token returns 401
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/webhooks/site-ops',
        headers: {
          'x-tenant-id': randomTenantId,
          'x-site-ops-secret': 'unauthenticated-raw-string',
        },
        payload: {
          senderPhone: '+254712345678',
          senderName: 'Site Supervisor',
          channel: 'WHATSAPP',
          rawMessage: 'PROGRESS 45%',
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('site-ops webhook authenticates and binds tenant via signed HMAC token', async () => {
      const server = buildServer();
      const testSecret = 'test-site-ops-secret-with-minimum-32-chars-long';
      process.env.SITE_OPS_WEBHOOK_SECRET = testSecret;

      const tenantA = await prisma.tenant.findFirst({ where: { slug: 'apex-builders' } });
      expect(tenantA).toBeDefined();

      const signedToken = generateSignedSiteOpsToken(tenantA!.id, testSecret);

      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/webhooks/site-ops',
        headers: {
          'x-site-ops-token': signedToken,
        },
        payload: {
          senderPhone: '+254712345678',
          senderName: 'John Site Eng',
          channel: 'WHATSAPP',
          rawMessage: 'REPORT Weather clear, 18 fundis on site',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.tenantId).toBe(tenantA!.id);
      expect(body.processedStatus).toBe('PROCESSED');
    });

    it('M-Pesa STK callback resolves tenant from database record and ignores header tenantId', async () => {
      const server = buildServer();
      const testMpesaSecret = 'test-mpesa-webhook-token-minimum-32-chars-long';
      process.env.MPESA_WEBHOOK_SECRET = testMpesaSecret;

      const tenantA = await prisma.tenant.findFirst({ where: { slug: 'apex-builders' } });
      const testCheckoutId = `ws_CO_${Date.now()}_test`;

      // Pre-seed an initiated subscription transaction under Tenant A
      await withTenantTx(prisma, tenantA!.id, async (tx) => {
        await tx.mpesaSubscriptionTransaction.create({
          data: {
            tenant_id: tenantA!.id,
            phone_number: '254712345678',
            amount: '7500.00',
            merchant_request_id: 'MR-TEST-001',
            checkout_request_id: testCheckoutId,
            plan_code: 'PROJECT_TIER',
            transaction_status: 'INITIATED',
          },
        });
      });

      // Send callback with spoofed x-tenant-id header (attacker claiming tenant B)
      const attackerTenantId = crypto.randomUUID();
      const callbackRes = await server.inject({
        method: 'POST',
        url: '/api/v1/billing/mpesa-callback',
        headers: {
          'x-mpesa-webhook-token': testMpesaSecret,
          'x-tenant-id': attackerTenantId, // Spoofed header must be ignored
        },
        payload: {
          Body: {
            stkCallback: {
              MerchantRequestID: 'MR-TEST-001',
              CheckoutRequestID: testCheckoutId,
              ResultCode: 0,
              ResultDesc: 'The service request is processed successfully.',
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: 7500 },
                  { Name: 'MpesaReceiptNumber', Value: 'QBA1234567' },
                  { Name: 'TransactionDate', Value: 20261105080000 },
                  { Name: 'PhoneNumber', Value: 254712345678 },
                ],
              },
            },
          },
        },
      });

      expect(callbackRes.statusCode).toBe(200);
      const resBody = JSON.parse(callbackRes.payload);
      // The transaction must be bound to Tenant A, NOT the spoofed attackerTenantId!
      expect(resBody.tenantId).toBe(tenantA!.id);
      expect(resBody.status).toBe('SUCCESS');
      expect(resBody.mpesaReceiptNumber).toBe('QBA1234567');
    });
  });

  // ===========================================================================
  // 2e. NEUTRAL WORDING: REPLACE "SIPHONING" WITH "FUEL DISCREPANCY"
  // ===========================================================================
  describe('2e: Neutral Fuel Discrepancy & Drop Wording', () => {
    it('uses neutral FuelDiscrepancyEvaluation and anomaly types without accusatory language', () => {
      const now = new Date();
      const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);

      // 1. Rapid unlogged drop while engine stopped
      const eval1: FuelDiscrepancyEvaluation = evaluateFuelDiscrepancyAnomaly(
        '200.00',
        '170.00',
        tenMinsAgo,
        now,
        'STOPPED',
        '35.00'
      );

      expect(eval1.isDiscrepancy).toBe(true);
      expect(eval1.anomalyType).toBe('RAPID_UNLOGGED_DROP');
      expect(eval1.message).not.toMatch(/theft|siphon/i);
      expect(eval1.message).toContain('Rapid fuel level drop');

      // 2. Elevated idle burn
      const halfHourAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const eval2 = evaluateFuelDiscrepancyAnomaly(
        '150.00',
        '140.00',
        halfHourAgo,
        now,
        'IDLE',
        '35.00'
      );
      expect(eval2.isDiscrepancy).toBe(true);
      expect(eval2.anomalyType).toBe('ELEVATED_IDLE_CONSUMPTION');
      expect(eval2.message).not.toMatch(/theft|siphon/i);

      // 3. Normal consumption
      const eval3 = evaluateFuelDiscrepancyAnomaly(
        '200.00',
        '195.00',
        halfHourAgo,
        now,
        'RUNNING',
        '35.00'
      );
      expect(eval3.isDiscrepancy).toBe(false);
      expect(eval3.anomalyType).toBe('NORMAL');
    });
  });
});
