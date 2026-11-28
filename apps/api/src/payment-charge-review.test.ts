import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { buildServer } from './index';
import { prisma, withTenantTx, hashPassword } from '@construction/db';

/**
 * G1 — resolve screen for held (NEEDS_REVIEW) provider payment charges.
 * Real Postgres throughout: the review list, the three resolutions
 * (APPLY to another invoice / REFUNDED outside SiteSafi / KEEP flagged),
 * once-only semantics under concurrent clicks, and tenant isolation.
 */
describe('Provider charge review resolution (G1)', () => {
  const server = buildServer();
  let adminCookie: string;
  let viewerCookie: string;
  let tenantBCookie: string;
  let tenantId: string;
  let adminUserId: string;

  const RUN = Date.now().toString(36);

  const login = async (email: string, password: string) => {
    const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } });
    return { status: res.statusCode, cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
  };
  const authed = (cookie: string) => ({ cookie });

  const newSentInvoice = async (unitRate: number, title: string) => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/invoices', headers: authed(adminCookie),
      payload: {
        title, clientName: 'Review Client', clientEmail: 'review@example.co.ke', currency: 'KES',
        items: [{ description: 'Works', unit: 'sum', quantity: 1, unitRate }],
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    const inv = JSON.parse(res.body).invoice;
    const send = await server.inject({
      method: 'POST', url: `/api/v1/invoices/${inv.id}/send`, headers: authed(adminCookie),
      payload: { selfApprovalReason: 'Charge review test invoice send reason' },
    });
    expect([200, 201]).toContain(send.statusCode);
    return inv;
  };

  const mkHeldCharge = async (invoiceId: string, amountMinor: number, reason: string) => {
    const reference = `ss_review_${RUN}_${randomBytes(4).toString('hex')}`;
    const charge = await withTenantTx(prisma, tenantId, (tx) =>
      tx.providerPaymentCharge.create({
        data: {
          tenant_id: tenantId,
          invoice_id: invoiceId,
          provider: 'paystack',
          reference,
          amount_minor: amountMinor,
          currency: 'KES',
          status: 'NEEDS_REVIEW',
          failure_reason: reason,
          created_by: adminUserId,
        },
      }),
    );
    return charge;
  };

  const getCharge = (id: string) =>
    withTenantTx(prisma, tenantId, (tx) => tx.providerPaymentCharge.findUnique({ where: { id } }));

  const listReview = async (cookie = adminCookie) => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/payments/charges/review', headers: authed(cookie) });
    return res;
  };

  const resolve = (id: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    server.inject({
      method: 'POST', url: `/api/v1/payments/charges/${id}/resolve`,
      headers: authed(cookie), payload,
    });

  beforeAll(async () => {
    await server.ready();
    const admin = await login('admin@apexbuilders.co.ke', 'Password123!');
    expect(admin.status).toBe(200);
    adminCookie = admin.cookie;
    tenantId = admin.body.user.tenant.id;
    adminUserId = admin.body.user.id;

    const viewer = await login('viewer@apexbuilders.co.ke', 'Password123!');
    expect(viewer.status).toBe(200);
    viewerCookie = viewer.cookie;

    // Second tenant — its admin must not see or resolve tenant A's charges.
    const tenantB = await prisma.tenant.create({
      data: { name: `Review Tenant B ${RUN}`, slug: `review-b-${RUN}`, currency: 'KES' },
    });
    const emailB = `admin-b-${RUN}@example.co.ke`;
    const userB = await prisma.user.create({
      data: {
        email: emailB,
        full_name: 'Tenant B Admin',
        password_hash: await hashPassword('TenantB!Pass123'),
        email_verified_at: new Date(),
        is_active: true,
      },
    });
    await withTenantTx(prisma, tenantB.id, (tx) =>
      tx.membership.create({ data: { tenant_id: tenantB.id, user_id: userB.id, role: 'COMPANY_ADMIN' } }),
    );
    const loginB = await login(emailB, 'TenantB!Pass123');
    expect(loginB.status).toBe(200);
    tenantBCookie = loginB.cookie;
  });

  afterAll(async () => {
    await server.close();
  });

  it('lists NEEDS_REVIEW charges with invoice number, amount, reference and reason', async () => {
    const inv = await newSentInvoice(80000, `Review list invoice ${RUN}`);
    const charge = await mkHeldCharge(inv.id, 5000000, 'settlement rejected: invoice already paid manually');

    const res = await listReview();
    expect(res.statusCode).toBe(200);
    const list = JSON.parse(res.body).data as any[];
    const row = list.find((c) => c.id === charge.id);
    expect(row).toBeTruthy();
    expect(row.invoiceNo).toBeTruthy();
    expect(row.amount).toBe('50000.00');
    expect(row.reference).toBe(charge.reference);
    expect(row.reason).toContain('already paid manually');

    // Non-admin roles cannot list or resolve.
    expect((await listReview(viewerCookie)).statusCode).toBe(403);
  });

  it('REFUNDED requires a real note and refund reference; resolves once', async () => {
    const inv = await newSentInvoice(60000, `Refund charge invoice ${RUN}`);
    const charge = await mkHeldCharge(inv.id, 3000000, 'settlement rejected: balance lower than charge');

    // Missing / too-short note and missing reference → 400.
    expect((await resolve(charge.id, { action: 'REFUNDED', refundReference: 'MPESA-REF-1' })).statusCode).toBe(400);
    expect((await resolve(charge.id, { action: 'REFUNDED', note: 'short', refundReference: 'MPESA-REF-1' })).statusCode).toBe(400);
    expect((await resolve(charge.id, { action: 'REFUNDED', note: 'Refunded via M-Pesa reversal desk' })).statusCode).toBe(400);

    const ok = await resolve(charge.id, {
      action: 'REFUNDED',
      note: 'Refunded to client via M-Pesa reversal on 2026-11-15',
      refundReference: 'MPESA-REV-88231',
    });
    expect(ok.statusCode, ok.body).toBe(200);
    const after = await getCharge(charge.id);
    expect(after?.status).toBe('REFUNDED');
    expect(after?.resolution).toBe('REFUNDED');
    expect(after?.resolution_reference).toBe('MPESA-REV-88231');
    expect(after?.resolved_at).toBeTruthy();

    // Second attempt → 409.
    expect((await resolve(charge.id, { action: 'KEEP' })).statusCode).toBe(409);
    // And it no longer appears in the review list.
    const list = JSON.parse((await listReview()).body).data as any[];
    expect(list.find((c) => c.id === charge.id)).toBeUndefined();
  });

  it('APPLY posts the held amount to another invoice exactly once under concurrent clicks', async () => {
    const source = await newSentInvoice(90000, `Apply source invoice ${RUN}`);
    const target = await newSentInvoice(120000, `Apply target invoice ${RUN}`);
    const charge = await mkHeldCharge(source.id, 4000000, 'settlement rejected: invoice manually settled'); // KES 40,000

    const [r1, r2] = await Promise.all([
      resolve(charge.id, { action: 'APPLY', invoiceId: target.id }),
      resolve(charge.id, { action: 'APPLY', invoiceId: target.id }),
    ]);
    const codes = [r1.statusCode, r2.statusCode].sort();
    expect(codes).toEqual([200, 409]);

    const chargeAfter = await getCharge(charge.id);
    expect(chargeAfter?.status).toBe('PAID');
    expect(chargeAfter?.resolution).toBe('APPLIED');
    expect(chargeAfter?.resolved_invoice_id).toBe(target.id);
    expect(chargeAfter?.invoice_payment_id).toBeTruthy();

    // Exactly one payment of KES 40,000 landed on the target invoice.
    const payments = await withTenantTx(prisma, tenantId, (tx) =>
      tx.invoicePayment.findMany({ where: { invoice_id: target.id } }),
    );
    expect(payments).toHaveLength(1);
    expect(Number(payments[0]!.amount.toString())).toBe(40000);

    const targetAfter = await withTenantTx(prisma, tenantId, (tx) =>
      tx.invoice.findUnique({ where: { id: target.id } }),
    );
    expect(Number(targetAfter?.amount_paid.toString())).toBe(40000);
  });

  it('APPLY rejects an amount that exceeds the target invoice balance', async () => {
    const source = await newSentInvoice(10000, `Overpay source ${RUN}`);
    const small = await newSentInvoice(5000, `Overpay target ${RUN}`); // balance KES 5,000
    const charge = await mkHeldCharge(source.id, 900000, 'settlement rejected: test'); // KES 9,000 > balance

    const res = await resolve(charge.id, { action: 'APPLY', invoiceId: small.id });
    expect(res.statusCode).toBe(400);
    // Claim rolled back — charge is still resolvable.
    const after = await getCharge(charge.id);
    expect(after?.resolved_at).toBeNull();
    expect(after?.status).toBe('NEEDS_REVIEW');
  });

  it('KEEP marks the charge reviewed while leaving it flagged; second attempt 409s', async () => {
    const inv = await newSentInvoice(70000, `Keep charge invoice ${RUN}`);
    const charge = await mkHeldCharge(inv.id, 2000000, 'settlement rejected: under investigation');

    const res = await resolve(charge.id, { action: 'KEEP' });
    expect(res.statusCode, res.body).toBe(200);
    const after = await getCharge(charge.id);
    expect(after?.status).toBe('NEEDS_REVIEW'); // still flagged
    expect(after?.resolution).toBe('KEPT');
    expect(after?.resolved_at).toBeTruthy();
    expect((await resolve(charge.id, { action: 'KEEP' })).statusCode).toBe(409);
  });

  it('another tenant cannot see or resolve the charge (404)', async () => {
    const inv = await newSentInvoice(80000, `Cross-tenant invoice ${RUN}`);
    const charge = await mkHeldCharge(inv.id, 1000000, 'settlement rejected: cross-tenant check');

    // Tenant B's review list is empty and does not contain the charge.
    const listB = JSON.parse((await listReview(tenantBCookie)).body).data as any[];
    expect(listB.find((c) => c.id === charge.id)).toBeUndefined();

    // Resolve attempt → 404 (RLS hides the row entirely).
    const res = await resolve(charge.id, { action: 'KEEP' }, tenantBCookie);
    expect(res.statusCode).toBe(404);
    // Untouched.
    const after = await getCharge(charge.id);
    expect(after?.resolved_at).toBeNull();
  });
});
