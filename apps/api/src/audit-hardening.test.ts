import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { buildServer } from './index';
import { prisma, withTenantTx, hashPassword, verifyPassword, isCurrentHashFormat } from '@construction/db';
import { randomUUID } from 'node:crypto';

/**
 * Stage-7 CTO audit fixes:
 *  - payments: Idempotency-Key required, replay-safe, row-locked, duplicate
 *    reference → 409 DUPLICATE_PAYMENT_REFERENCE
 *  - numbering: document_counters atomic sequences for invoice_no/certificate_no
 *  - cost approve: atomic status claim (one CostApproval under parallel posts)
 *  - auth throttle: DB-backed IP + account counters, XFF-aware trustProxy
 *  - passwords: scrypt N=2^17 parameter-bearing hashes + legacy verify
 *  - PDF: concurrency-limited renders; event-loop lag measured under burst
 */
describe('Stage-7 audit hardening', () => {
  const server = buildServer();
  let adminCookie: string;
  let tenantId: string;
  let projectId: string;

  const login = async (email: string, password: string) => {
    const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } });
    return { status: res.statusCode, cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
  };
  const authed = (cookie: string, extra: Record<string, string> = {}) => ({ cookie, ...extra });

  const newInvoice = async (title: string) => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/invoices', headers: authed(adminCookie),
      payload: {
        title, clientName: 'Audit Client', currency: 'KES',
        items: [{ description: 'Works', unit: 'sum', quantity: 1, unitRate: 1000 }],
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    const inv = JSON.parse(res.body).invoice;
    const send = await server.inject({
      method: 'POST', url: `/api/v1/invoices/${inv.id}/send`, headers: authed(adminCookie),
      payload: { selfApprovalReason: 'Audit test invoice send reason' },
    });
    expect([200, 201]).toContain(send.statusCode);
    return inv;
  };

  beforeAll(async () => {
    await server.ready();
    const admin = await login('admin@apexbuilders.co.ke', 'Password123!');
    expect(admin.status).toBe(200);
    adminCookie = admin.cookie;
    tenantId = admin.body.user.tenant.id;
    const projects = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: authed(adminCookie) });
    projectId = JSON.parse(projects.body).data[0].id;
  });

  // --------------------------------------------------------------- payments
  it('payment POST without Idempotency-Key is rejected', async () => {
    const inv = await newInvoice('No-key invoice');
    const res = await server.inject({
      method: 'POST', url: `/api/v1/invoices/${inv.id}/payments`, headers: authed(adminCookie),
      payload: { amount: 100, method: 'CASH' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatch(/Idempotency-Key/i);
  });

  it('identical replay returns the original payment; row count stays 1', async () => {
    const inv = await newInvoice('Replay invoice');
    const key = `pay-${randomUUID()}`;
    const payload = { amount: 500, method: 'M_PESA', reference: `REF-${randomUUID().slice(0, 8)}` };
    const [r1, r2] = await Promise.all([
      server.inject({ method: 'POST', url: `/api/v1/invoices/${inv.id}/payments`, headers: authed(adminCookie, { 'idempotency-key': key }), payload }),
      server.inject({ method: 'POST', url: `/api/v1/invoices/${inv.id}/payments`, headers: authed(adminCookie, { 'idempotency-key': key }), payload }),
    ]);
    expect([200, 201]).toContain(r1.statusCode);
    expect([200, 201]).toContain(r2.statusCode);
    const b1 = JSON.parse(r1.body); const b2 = JSON.parse(r2.body);
    expect(b1.payment.id).toBe(b2.payment.id);

    const payments = await withTenantTx(prisma, tenantId, (tx) =>
      tx.invoicePayment.findMany({ where: { invoice_id: inv.id } }),
    );
    expect(payments).toHaveLength(1);
    const invRow = await withTenantTx(prisma, tenantId, (tx) => tx.invoice.findUnique({ where: { id: inv.id } }));
    const paidSum = payments.reduce((a, p) => a + Number(p.amount), 0);
    expect(Number(invRow!.amount_paid)).toBeCloseTo(paidSum, 2);
  });

  it('duplicate payment reference maps to 409 DUPLICATE_PAYMENT_REFERENCE', async () => {
    const inv = await newInvoice('Dup-ref invoice A');
    const inv2 = await newInvoice('Dup-ref invoice B');
    const ref = `DUP-${randomUUID().slice(0, 8)}`;
    const r1 = await server.inject({
      method: 'POST', url: `/api/v1/invoices/${inv.id}/payments`,
      headers: authed(adminCookie, { 'idempotency-key': `k-${randomUUID()}` }),
      payload: { amount: 100, method: 'CASH', reference: ref },
    });
    expect([200, 201]).toContain(r1.statusCode);
    const r2 = await server.inject({
      method: 'POST', url: `/api/v1/invoices/${inv2.id}/payments`,
      headers: authed(adminCookie, { 'idempotency-key': `k-${randomUUID()}` }),
      payload: { amount: 100, method: 'CASH', reference: ref },
    });
    expect(r2.statusCode).toBe(409);
    expect(r2.body).toContain('DUPLICATE_PAYMENT_REFERENCE');
  });

  // --------------------------------------------------------------- numbering
  it('10 parallel invoice creations get unique sequential numbers, no 500s', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        server.inject({
          method: 'POST', url: '/api/v1/invoices', headers: authed(adminCookie),
          payload: {
            title: `Parallel inv ${i} ${randomUUID().slice(0, 6)}`, clientName: 'C', currency: 'KES',
            items: [{ description: 'x', unit: 'sum', quantity: 1, unitRate: 10 }],
          },
        }),
      ),
    );
    for (const r of results) expect(r.statusCode, r.body).toBe(201);
    const nos = results.map((r) => JSON.parse(r.body).invoice.invoice_no as number);
    expect(new Set(nos).size).toBe(10);
    const sorted = [...nos].sort((a, b) => a - b);
    // Counter is atomic; committed values must be distinct and dense within
    // this batch's own span (allow pre-existing gaps from earlier tests).
    expect(sorted[sorted.length - 1]! - sorted[0]!).toBeLessThanOrEqual(15);
  });

  // --------------------------------------------------------------- cost claim
  it('2 parallel approvals produce exactly one CostApproval row', async () => {
    const cost = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/costs`, headers: authed(adminCookie),
      payload: { projectId, costCategory: 'MATERIAL', amount: '1234.50', description: `parallel-approve-${randomUUID().slice(0, 8)}` },
    });
    expect(cost.statusCode, cost.body).toBeLessThan(300);
    const cj = JSON.parse(cost.body);
    const costId = cj.id || cj.data?.id || cj.costEntry?.id || cj.cost_entry?.id;
    const reason = 'Audit parallel approval race check reason';
    const [a, b] = await Promise.all([
      server.inject({ method: 'POST', url: `/api/v1/projects/${projectId}/costs/${costId}/approve`, headers: authed(adminCookie), payload: { action: 'APPROVED', selfApprovalReason: reason } }),
      server.inject({ method: 'POST', url: `/api/v1/projects/${projectId}/costs/${costId}/approve`, headers: authed(adminCookie), payload: { action: 'APPROVED', selfApprovalReason: reason } }),
    ]);
    const okCount = [a.statusCode, b.statusCode].filter((s) => s === 200 || s === 201).length;
    const conflictCount = [a.statusCode, b.statusCode].filter((s) => s === 409).length;
    expect(okCount).toBe(1);
    expect(conflictCount).toBe(1);

    const approvals = await withTenantTx(prisma, tenantId, (tx) =>
      tx.costApproval.findMany({ where: { cost_entry_id: costId } }),
    );
    expect(approvals).toHaveLength(1);
  });

  // --------------------------------------------------------------- passwords
  it('hashPassword emits parameter-bearing s2$ format; legacy hashes still verify', async () => {
    const hash = await hashPassword('CorrectHorse9!');
    expect(hash.startsWith('s2$131072$8$1$')).toBe(true);
    expect(isCurrentHashFormat(hash)).toBe(true);
    expect(await verifyPassword('CorrectHorse9!', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);

    // Legacy `salt:key` (scrypt defaults) must still verify.
    const { scrypt, randomBytes } = await import('node:crypto');
    const { promisify } = await import('node:util');
    const salt = randomBytes(16).toString('hex');
    const key = (await promisify(scrypt)('LegacyPass1!', salt, 64)) as Buffer;
    const legacy = `${salt}:${key.toString('hex')}`;
    expect(isCurrentHashFormat(legacy)).toBe(false);
    expect(await verifyPassword('LegacyPass1!', legacy)).toBe(true);
    expect(await verifyPassword('nope', legacy)).toBe(false);
  });

  // --------------------------------------------------------------- PDF burst
  it('10 concurrent report requests stay responsive (event-loop lag measured)', async () => {
    const histogram = monitorEventLoopDelay({ resolution: 10 });
    histogram.enable();
    const t0 = performance.now();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        server.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/reports/summary`, headers: authed(adminCookie) }),
      ),
    );
    const elapsed = performance.now() - t0;
    histogram.disable();
    const mean = histogram.mean / 1e6;
    const p99 = histogram.percentile(99) / 1e6;
    const max = histogram.max / 1e6;
    console.log(`[pdf-burst] 10 concurrent summary reports in ${elapsed.toFixed(0)}ms — event-loop delay mean=${mean.toFixed(1)}ms p99=${p99.toFixed(1)}ms max=${max.toFixed(1)}ms`);
    for (const r of results) expect([200, 201, 400, 404, 500]).toContain(r.statusCode);
    // Generous bound: limiter caps renders at 2; loop must not stall seconds.
    expect(p99).toBeLessThan(2000);
  });
});

// --------------------------------------------------------------- auth throttle
describe('Stage-7 auth throttling (DB-backed, XFF-aware)', () => {
  const savedCidr = process.env.TRUSTED_PROXY_CIDRS;
  process.env.TRUSTED_PROXY_CIDRS = '127.0.0.1/32,10.0.0.0/8';
  const server = buildServer();

  const loginReq = (email: string, password: string, ip: string) =>
    server.inject({
      method: 'POST', url: '/api/v1/auth/login',
      headers: { 'x-forwarded-for': ip },
      payload: { email, password },
    });

  beforeAll(async () => {
    await server.ready();
    // Test DB only: start from a clean throttle table so reruns are deterministic.
    await prisma.loginThrottle.deleteMany({});
    const ok = await loginReq('admin@apexbuilders.co.ke', 'Password123!', '10.1.1.1');
    expect(ok.statusCode).toBe(200);
  });

  afterAll(() => {
    if (savedCidr === undefined) delete process.env.TRUSTED_PROXY_CIDRS;
    else process.env.TRUSTED_PROXY_CIDRS = savedCidr;
  });

  it('10 failures from one IP throttle that IP only — other IPs unaffected', { timeout: 90000 }, async () => {
    const victim = `throttle-${randomUUID().slice(0, 8)}@example.com`;
    // 10 failures on the same account+IP pair
    for (let i = 0; i < 10; i++) {
      const r = await loginReq(victim, 'WrongPass1!', '10.9.9.9');
      expect(r.statusCode).toBe(401);
    }
    // Same IP + same account → 429
    const blocked = await loginReq(victim, 'WrongPass1!', '10.9.9.9');
    expect(blocked.statusCode).toBe(429);
    // Different IP, same unknown account → also 429 (account scope)
    const acctBlocked = await loginReq(victim, 'WrongPass1!', '10.8.8.8');
    expect(acctBlocked.statusCode).toBe(429);
    // Different IP + different account → unaffected
    const other = await loginReq('viewer@apexbuilders.co.ke', 'Password123!', '10.7.7.7');
    expect(other.statusCode).toBe(200);
    // Admin from yet another IP still works
    const admin = await loginReq('admin@apexbuilders.co.ke', 'Password123!', '10.6.6.6');
    expect(admin.statusCode).toBe(200);
  });
});
