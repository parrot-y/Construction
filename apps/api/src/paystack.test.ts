import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

/**
 * Paystack provider seam — charge initiation, webhook signature verification
 * (x-paystack-signature = HMAC-SHA512 hex of the RAW body, per
 * https://paystack.com/docs/payments/webhooks/#verify-webhook-signatures),
 * server-side verify before settle, once-only processing, amount/currency
 * mismatch rejection, KES minor units, and the KES 150,000 M-Pesa cap.
 *
 * The "provider" is a local fake HTTP server — no real Paystack calls, no
 * real keys (PAYSTACK_SECRET_KEY is a test vector only).
 */

const TEST_SECRET = 'pk_test_fixed_secret_key_123';
// Fixed known-answer vector: HMAC-SHA512(TEST_SECRET, FIXED_BODY) computed
// independently — guards against accidental algorithm/encoding drift.
const FIXED_BODY = '{"event":"charge.success","data":{"reference":"ss_fixedvector01","status":"success","amount":12500000,"currency":"KES"}}';
const FIXED_SIG = '6ba202a7e01c9a4c1165161a2e306fa1fd92c511888a1f2264ef68f7579bd328c357e98107e5b1a7a47d5514e5c3514271b193f9c1bfc8db2afd25928618ebb2';

const sign = (body: string) => createHmac('sha512', TEST_SECRET).update(body, 'utf8').digest('hex');

describe('Paystack provider seam', () => {
  const server = buildServer();
  let adminCookie: string;
  let tenantId: string;

  // Fake Paystack API
  let fake: Server;
  let fakeUrl = '';
  const initialized = new Map<string, { amount: number; currency: string }>();
  const verifyOverrides = new Map<string, { status?: string; amount?: number; currency?: string }>();

  const login = async (email: string, password: string) => {
    const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } });
    return { status: res.statusCode, cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
  };
  const authed = (cookie: string) => ({ cookie });

  const newSentInvoice = async (unitRate: number, title: string) => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/invoices', headers: authed(adminCookie),
      payload: {
        title, clientName: 'Paystack Client', clientEmail: 'client@example.co.ke', currency: 'KES',
        items: [{ description: 'Works', unit: 'sum', quantity: 1, unitRate }],
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    const inv = JSON.parse(res.body).invoice;
    const send = await server.inject({
      method: 'POST', url: `/api/v1/invoices/${inv.id}/send`, headers: authed(adminCookie),
      payload: { selfApprovalReason: 'Paystack test invoice send reason' },
    });
    expect([200, 201]).toContain(send.statusCode);
    return inv;
  };

  const initialize = async (invoiceId: string, payload: Record<string, unknown> = {}) =>
    server.inject({
      method: 'POST',
      url: `/api/v1/invoices/${invoiceId}/paystack/initialize`,
      headers: authed(adminCookie),
      payload,
    });

  const recordManualPayment = async (invoiceId: string, amount: number) =>
    server.inject({
      method: 'POST', url: `/api/v1/invoices/${invoiceId}/payments`,
      headers: { ...authed(adminCookie), 'idempotency-key': `manual-${Date.now()}-${Math.random()}` },
      payload: { amount, method: 'BANK', reference: `manual-${Date.now()}-${Math.random()}` },
    });

  const postWebhook = async (rawBody: string, signature?: string) =>
    server.inject({
      method: 'POST',
      url: '/api/v1/webhooks/paystack',
      headers: {
        'content-type': 'application/json',
        ...(signature ? { 'x-paystack-signature': signature } : {}),
      },
      payload: rawBody,
    });

  const chargeSuccessBody = (reference: string) =>
    JSON.stringify({
      event: 'charge.success',
      data: { reference, status: 'success', amount: initialized.get(reference)?.amount, currency: initialized.get(reference)?.currency },
    });

  beforeAll(async () => {
    fake = createServer((req, res) => {
      const url = req.url || '';
      if (req.method === 'POST' && url === '/transaction/initialize') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const parsed = JSON.parse(body) as { reference: string; amount: number; currency: string };
          initialized.set(parsed.reference, { amount: parsed.amount, currency: parsed.currency });
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({
            status: true,
            data: {
              authorization_url: `https://pay.test/checkout/${parsed.reference}`,
              access_code: `ac_${parsed.reference}`,
              reference: parsed.reference,
            },
          }));
        });
        return;
      }
      const verifyMatch = url.match(/^\/transaction\/verify\/(.+)$/);
      if (req.method === 'GET' && verifyMatch) {
        const reference = decodeURIComponent(verifyMatch[1] ?? '');
        const init = initialized.get(reference);
        const over = verifyOverrides.get(reference);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          status: true,
          data: {
            reference,
            status: over?.status ?? 'success',
            amount: over?.amount ?? init?.amount ?? 0,
            currency: over?.currency ?? init?.currency ?? 'KES',
          },
        }));
        return;
      }
      res.writeHead(404).end('{}');
    });
    await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));
    fakeUrl = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;

    process.env.PAYMENT_PROVIDER = 'paystack';
    process.env.PAYSTACK_SECRET_KEY = TEST_SECRET;
    process.env.PAYSTACK_BASE_URL = fakeUrl;

    await server.ready();
    const admin = await login('admin@apexbuilders.co.ke', 'Password123!');
    expect(admin.status).toBe(200);
    adminCookie = admin.cookie;
    tenantId = admin.body.user.tenant.id;
  });

  afterAll(async () => {
    delete process.env.PAYMENT_PROVIDER;
    delete process.env.PAYSTACK_SECRET_KEY;
    delete process.env.PAYSTACK_BASE_URL;
    await new Promise<void>((resolve) => fake.close(() => resolve()));
    await server.close();
  });

  // --------------------------------------------------------------- unit: signature
  it('verifies a fixed HMAC-SHA512 signature vector and rejects tampering', async () => {
    const { PaystackProvider } = await import('./integrations/payments/paystack');
    const provider = new PaystackProvider(TEST_SECRET, fakeUrl);

    expect(FIXED_SIG).toBe(sign(FIXED_BODY)); // vector sanity
    expect(provider.verifyWebhookSignature(FIXED_BODY, FIXED_SIG)).toBe(true);
    expect(provider.verifyWebhookSignature(FIXED_BODY, FIXED_SIG.toUpperCase())).toBe(true); // hex case-insensitive

    // Tampered body — one byte flipped
    const tampered = FIXED_BODY.replace('12500000', '12500001');
    expect(provider.verifyWebhookSignature(tampered, FIXED_SIG)).toBe(false);

    // Wrong signature / missing header
    expect(provider.verifyWebhookSignature(FIXED_BODY, sign(FIXED_BODY + 'x'))).toBe(false);
    expect(provider.verifyWebhookSignature(FIXED_BODY, undefined)).toBe(false);
    expect(provider.verifyWebhookSignature(FIXED_BODY, '')).toBe(false);
  });

  // --------------------------------------------------------------- simulated default
  it('initialize returns honest PAYMENTS_SIMULATED when provider flag is unset', async () => {
    const inv = await newSentInvoice(5000, 'Simulated provider invoice');
    const saved = process.env.PAYMENT_PROVIDER;
    delete process.env.PAYMENT_PROVIDER;
    try {
      const res = await initialize(inv.id);
      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).code).toBe('PAYMENTS_SIMULATED');
    } finally {
      process.env.PAYMENT_PROVIDER = saved;
    }
  });

  // --------------------------------------------------------------- initialize
  it('initialize creates a PENDING charge and returns the provider authorization URL', async () => {
    const inv = await newSentInvoice(125000, 'Paystack settle invoice'); // KES 125,000.00 → 12,500,000 minor
    const res = await initialize(inv.id);
    expect(res.statusCode, res.body).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.authorizationUrl).toContain('pay.test/checkout/');
    expect(body.simulated).toBe(false);
    expect(body.charge.amountMinor).toBe(12500000);
    expect(body.charge.currency).toBe('KES');

    const row = await withTenantTx(prisma, tenantId, (tx) =>
      tx.providerPaymentCharge.findFirst({ where: { invoice_id: inv.id } }));
    expect(row?.status).toBe('PENDING');
    expect(row?.reference).toBe(body.charge.reference);
  });

  it('rejects KES amounts above the M-Pesa single-transaction cap', async () => {
    const inv = await newSentInvoice(200000, 'Over M-Pesa cap invoice'); // KES 200,000 > 150,000
    const res = await initialize(inv.id);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('MPESA_TRANSACTION_LIMIT');
  });

  // --------------------------------------------------------------- webhook
  it('rejects webhook with missing/invalid/tampered signature', async () => {
    const inv = await newSentInvoice(1000, 'Signature invoice');
    const init = await initialize(inv.id);
    const reference = JSON.parse(init.body).charge.reference;
    const body = chargeSuccessBody(reference);

    expect((await postWebhook(body)).statusCode).toBe(401);                    // missing header
    expect((await postWebhook(body, 'deadbeef')).statusCode).toBe(401);         // wrong sig
    expect((await postWebhook(body.replace('1000', '2000'), sign(body))).statusCode).toBe(401); // tampered body, sig of original
  });

  it('settles the invoice once on a valid signed webhook; replay is a no-op', async () => {
    const inv = await newSentInvoice(125000, 'Webhook settle invoice');
    const init = await initialize(inv.id);
    const reference = JSON.parse(init.body).charge.reference;
    const body = chargeSuccessBody(reference);

    const res = await postWebhook(body, sign(body));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe('paid');

    const invoice = await withTenantTx(prisma, tenantId, (tx) => tx.invoice.findUnique({ where: { id: inv.id } }));
    expect(invoice?.status).toBe('PAID');
    expect(Number(invoice?.amount_paid)).toBe(125000);

    const payments = await withTenantTx(prisma, tenantId, (tx) => tx.invoicePayment.findMany({ where: { invoice_id: inv.id } }));
    expect(payments).toHaveLength(1);
    expect(payments[0]!.method).toBe('M_PESA');
    expect(payments[0]!.reference).toBe(`paystack:${reference}`);

    const charge = await withTenantTx(prisma, tenantId, (tx) =>
      tx.providerPaymentCharge.findFirst({ where: { reference } }));
    expect(charge?.status).toBe('PAID');
    expect(charge?.invoice_payment_id).toBe(payments[0]!.id);

    // Replay — same signed event delivered again
    const replay = await postWebhook(body, sign(body));
    expect(replay.statusCode).toBe(200);
    const replayPayments = await withTenantTx(prisma, tenantId, (tx) => tx.invoicePayment.findMany({ where: { invoice_id: inv.id } }));
    expect(replayPayments).toHaveLength(1);
    const invoiceAfter = await withTenantTx(prisma, tenantId, (tx) => tx.invoice.findUnique({ where: { id: inv.id } }));
    expect(Number(invoiceAfter?.amount_paid)).toBe(125000);
  });

  it('rejects settlement when provider verify reports an amount mismatch', async () => {
    const inv = await newSentInvoice(50000, 'Mismatch invoice');
    const init = await initialize(inv.id);
    const reference = JSON.parse(init.body).charge.reference;
    verifyOverrides.set(reference, { amount: 4999900 }); // KES 49,999 vs expected 50,000

    const body = chargeSuccessBody(reference);
    const res = await postWebhook(body, sign(body));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).reason).toBe('amount_mismatch');

    const invoice = await withTenantTx(prisma, tenantId, (tx) => tx.invoice.findUnique({ where: { id: inv.id } }));
    expect(invoice?.status).not.toBe('PAID');
    expect(Number(invoice?.amount_paid)).toBe(0);
    const charge = await withTenantTx(prisma, tenantId, (tx) =>
      tx.providerPaymentCharge.findFirst({ where: { reference } }));
    expect(charge?.status).toBe('FAILED');
    expect(charge?.failure_reason).toContain('amount mismatch');
    verifyOverrides.delete(reference);
  });

  it('rejects settlement on currency mismatch and non-success provider status', async () => {
    const inv = await newSentInvoice(30000, 'Currency invoice');
    const init = await initialize(inv.id);
    const reference = JSON.parse(init.body).charge.reference;

    verifyOverrides.set(reference, { currency: 'USD' });
    let body = chargeSuccessBody(reference);
    let res = await postWebhook(body, sign(body));
    expect(JSON.parse(res.body).reason).toBe('currency_mismatch');

    verifyOverrides.set(reference, { currency: 'KES', status: 'failed' });
    res = await postWebhook(body, sign(body));
    expect(JSON.parse(res.body).reason).toBe('not_successful');

    const invoice = await withTenantTx(prisma, tenantId, (tx) => tx.invoice.findUnique({ where: { id: inv.id } }));
    expect(Number(invoice?.amount_paid)).toBe(0);
    verifyOverrides.delete(reference);
  });

  // --------------------------------------------------------------- F2: partial amounts + Decimal
  it('initialize accepts a partial amount under the M-Pesa cap on an over-cap invoice', async () => {
    const inv = await newSentInvoice(200000, 'Split payment invoice'); // balance KES 200,000 > cap
    const res = await initialize(inv.id, { amount: 50000 });
    expect(res.statusCode, res.body).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.charge.amountMinor).toBe(5000000); // KES 50,000.00
    expect(body.balanceDue).toBe('200000.00');

    // Settle the partial charge — invoice must be PART_PAID, not PAID.
    const reference = body.charge.reference;
    const wh = chargeSuccessBody(reference);
    const whRes = await postWebhook(wh, sign(wh));
    expect(JSON.parse(whRes.body).status).toBe('paid');
    const invoice = await withTenantTx(prisma, tenantId, (tx) => tx.invoice.findUnique({ where: { id: inv.id } }));
    expect(invoice?.status).toBe('PART_PAID');
    expect(Number(invoice?.amount_paid)).toBe(50000);
    expect(Number(invoice?.balance_due)).toBe(150000);
  });

  it('initialize rejects partial amounts that are non-positive, over balance, or over-cap', async () => {
    const inv = await newSentInvoice(10000, 'Partial validation invoice');
    for (const [amount, code] of [
      [0, 400], [-5, 400], [10001, 400], [NaN, 400],
    ] as const) {
      const res = await initialize(inv.id, { amount });
      expect(res.statusCode, `amount=${amount}: ${res.body}`).toBe(code);
    }
  });

  it('minor-unit conversion uses Decimal — awkward values stay exact', async () => {
    // KES 0.07 -> 7 minor units; float math gives 7.000000000000001.
    const tiny = await newSentInvoice(0.07, 'Tiny invoice');
    const r1 = await initialize(tiny.id);
    expect(r1.statusCode, r1.body).toBe(201);
    expect(JSON.parse(r1.body).charge.amountMinor).toBe(7);

    // USD invoice above the KES cap path — 1,234,567.89 -> 123,456,789 minor.
    const big = await server.inject({
      method: 'POST', url: '/api/v1/invoices', headers: authed(adminCookie),
      payload: {
        title: 'USD decimal invoice', clientName: 'FX Client', currency: 'USD',
        items: [{ description: 'Works', unit: 'sum', quantity: 1, unitRate: 1234567.89 }],
      },
    });
    expect(big.statusCode, big.body).toBe(201);
    const bigInv = JSON.parse(big.body).invoice ?? JSON.parse(big.body).data;
    const send = await server.inject({
      method: 'POST', url: `/api/v1/invoices/${bigInv.id}/send`, headers: authed(adminCookie),
      payload: { selfApprovalReason: 'Paystack decimal test send reason' },
    });
    expect([200, 201]).toContain(send.statusCode);
    const r2 = await initialize(bigInv.id);
    expect(r2.statusCode, r2.body).toBe(201);
    expect(JSON.parse(r2.body).charge.amountMinor).toBe(123456789);
    expect(JSON.parse(r2.body).charge.currency).toBe('USD');
  });

  // --------------------------------------------------------------- F2: NEEDS_REVIEW
  it('webhook after a manual full payment flags NEEDS_REVIEW instead of losing the money', async () => {
    const inv = await newSentInvoice(80000, 'Manual-paid race invoice');
    const init = await initialize(inv.id);
    const reference = JSON.parse(init.body).charge.reference;

    // Client pays the invoice manually (bank transfer) before the webhook lands.
    const manual = await recordManualPayment(inv.id, 80000);
    expect([200, 201]).toContain(manual.statusCode);

    const body = chargeSuccessBody(reference);
    const res = await postWebhook(body, sign(body));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe('needs_review');

    const charge = await withTenantTx(prisma, tenantId, (tx) =>
      tx.providerPaymentCharge.findFirst({ where: { reference } }));
    expect(charge?.status).toBe('NEEDS_REVIEW');
    expect(charge?.failure_reason).toContain('settlement rejected');

    // Money is NOT double-recorded.
    const payments = await withTenantTx(prisma, tenantId, (tx) =>
      tx.invoicePayment.findMany({ where: { invoice_id: inv.id } }));
    expect(payments).toHaveLength(1);
    const invoice = await withTenantTx(prisma, tenantId, (tx) => tx.invoice.findUnique({ where: { id: inv.id } }));
    expect(Number(invoice?.amount_paid)).toBe(80000);

    // Admins were notified in-app.
    const notices = await withTenantTx(prisma, tenantId, (tx) =>
      tx.inboxMessage.findMany({ where: { body: { contains: reference } } }));
    expect(notices.length).toBeGreaterThan(0);

    // Provider retry is acked, not errored.
    const retry = await postWebhook(body, sign(body));
    expect(retry.statusCode).toBe(200);
    expect(JSON.parse(retry.body).status).toBe('needs_review');
  });

  it('concurrent duplicate webhooks settle exactly once', async () => {
    const inv = await newSentInvoice(60000, 'Concurrent webhook invoice');
    const init = await initialize(inv.id);
    const reference = JSON.parse(init.body).charge.reference;
    const body = chargeSuccessBody(reference);
    const sig = sign(body);

    const [r1, r2] = await Promise.all([postWebhook(body, sig), postWebhook(body, sig)]);
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);

    const payments = await withTenantTx(prisma, tenantId, (tx) =>
      tx.invoicePayment.findMany({ where: { invoice_id: inv.id } }));
    expect(payments).toHaveLength(1);
    const statuses = [JSON.parse(r1.body).status, JSON.parse(r2.body).status].sort();
    expect(statuses).toEqual(['already_processed', 'paid']);
  });

  it('a FAILED charge settles when a later webhook verifies success', async () => {
    const inv = await newSentInvoice(40000, 'Failed-then-success invoice');
    const init = await initialize(inv.id);
    const reference = JSON.parse(init.body).charge.reference;

    // First delivery: provider verify reports failure -> charge FAILED.
    verifyOverrides.set(reference, { status: 'failed' });
    let body = chargeSuccessBody(reference);
    let res = await postWebhook(body, sign(body));
    expect(JSON.parse(res.body).status).toBe('rejected');
    let charge = await withTenantTx(prisma, tenantId, (tx) =>
      tx.providerPaymentCharge.findFirst({ where: { reference } }));
    expect(charge?.status).toBe('FAILED');

    // Later delivery: provider now reports success -> settle.
    verifyOverrides.set(reference, { status: 'success' });
    res = await postWebhook(body, sign(body));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe('paid');
    charge = await withTenantTx(prisma, tenantId, (tx) =>
      tx.providerPaymentCharge.findFirst({ where: { reference } }));
    expect(charge?.status).toBe('PAID');
    const invoice = await withTenantTx(prisma, tenantId, (tx) => tx.invoice.findUnique({ where: { id: inv.id } }));
    expect(invoice?.status).toBe('PAID');
    verifyOverrides.delete(reference);
  });
});
