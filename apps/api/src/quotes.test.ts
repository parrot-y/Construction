import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx, hashPassword } from '@construction/db';

describe('Gate-4 S1: Quotes-to-cash suite', () => {
  const server = buildServer();

  let adminCookie: string;
  let clientCookie: string;
  let supervisorCookie: string;
  let tenantBCookie: string;
  let tenantAId: string;
  let projectAId: string;

  let quoteId: string;
  let shareToken: string;

  const login = async (email: string, password = 'Password123!') => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    return res;
  };

  beforeAll(async () => {
    await server.ready();

    const adminRes = await login('admin@apexbuilders.co.ke');
    adminCookie = adminRes.headers['set-cookie'] as string;
    tenantAId = JSON.parse(adminRes.body).user.tenant.id;

    const clientRes = await login('client@apexbuilders.co.ke');
    clientCookie = clientRes.headers['set-cookie'] as string;

    const supRes = await login('supervisor@apexbuilders.co.ke');
    supervisorCookie = supRes.headers['set-cookie'] as string;

    // Tenant B admin for isolation checks
    const defaultPasswordHash = await hashPassword('Password123!');
    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-b-quotes' },
      update: {},
      create: { name: 'Quotes Isolation Ltd', slug: 'test-tenant-b-quotes', currency: 'KES' },
    });
    const userB = await prisma.user.upsert({
      where: { email: 'admin@quotes-isolation.co.ke' },
      update: { password_hash: defaultPasswordHash },
      create: {
        email: 'admin@quotes-isolation.co.ke',
        password_hash: defaultPasswordHash,
        full_name: 'Test Admin B',
        is_active: true,
      },
    });
    await withTenantTx(prisma, tenantB.id, async (tx) => {
      await tx.membership.upsert({
        where: { tenant_id_user_id: { tenant_id: tenantB.id, user_id: userB.id } },
        update: { role: 'COMPANY_ADMIN' },
        create: { tenant_id: tenantB.id, user_id: userB.id, role: 'COMPANY_ADMIN' },
      });
    });
    const resB = await login('admin@quotes-isolation.co.ke');
    tenantBCookie = resB.headers['set-cookie'] as string;

    const project = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.project.findFirst({ where: { tenant_id: tenantAId } });
    });
    projectAId = project!.id;
  });

  it('creates a quote with computed totals', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/quotes',
      headers: { cookie: adminCookie },
      payload: {
        title: 'Boundary wall construction',
        clientName: 'David Omondi',
        clientEmail: 'client@apexbuilders.co.ke',
        siteLocation: 'Nairobi',
        projectId: projectAId,
        currency: 'KES',
        taxPct: 16,
        depositPct: 50,
        validDays: 30,
        terms: '50% deposit to start',
        items: [
          { section: 'Masonry', description: 'Boundary wall 110m', unit: 'm', quantity: 110, unitRate: 5000 },
          { description: 'Gate installation', unit: 'item', quantity: 1, unitRate: 25000 },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    quoteId = body.quote.id;
    expect(body.quote.status).toBe('DRAFT');
    // subtotal = 110*5000 + 25000 = 575000; tax 16% = 92000; total 667000; deposit 50% = 333500
    expect(Number(body.quote.subtotal)).toBe(575000);
    expect(Number(body.quote.tax_amount)).toBe(92000);
    expect(Number(body.quote.total)).toBe(667000);
    expect(Number(body.quote.deposit_amount)).toBe(333500);
    expect(body.quote.items).toHaveLength(2);
    expect(body.quote.quote_no).toBeGreaterThan(0);
  });

  it('lists quotes for the tenant', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/quotes',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.quotes.some((q: any) => q.id === quoteId)).toBe(true);
  });

  it('rejects quote creation for SITE_SUPERVISOR (no QUOTE_CREATE)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/quotes',
      headers: { cookie: supervisorCookie },
      payload: {
        title: 'Should fail',
        clientName: 'X',
        items: [{ description: 'x', quantity: 1, unitRate: 1 }],
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('sends the quote and issues a share token', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/quotes/${quoteId}/send`,
      headers: { cookie: adminCookie },
      payload: { channel: 'link' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.quote.status).toBe('SENT');
    expect(body.shareUrl).toContain('/public/quotes/');
    shareToken = body.shareToken;
    expect(shareToken).toBeTruthy();
  });

  it('blocks editing a sent quote', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/quotes/${quoteId}`,
      headers: { cookie: adminCookie },
      payload: { title: 'Changed' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('serves the quote publicly by token and records a view', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/public/quotes/${shareToken}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.quote.id).toBe(quoteId);
    expect(body.quote.status).toBe('SENT');
    expect(body.contractor.name).toBeTruthy();

    const events = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.quoteEvent.findMany({ where: { quote_id: quoteId, event: 'VIEWED' } });
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects invalid tokens', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/public/quotes/not-a-real-token' });
    expect(res.statusCode).toBe(404);
  });

  it('requires typed name to accept', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/public/quotes/${shareToken}/respond`,
      payload: { action: 'accept' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts with typed-name e-signature', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/public/quotes/${shareToken}/respond`,
      payload: { action: 'accept', typedName: 'David Omondi', note: 'Looks good' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.quote.status).toBe('ACCEPTED');
    expect(body.quote.responded_by).toBe('David Omondi');
    expect(body.quote.responded_at).toBeTruthy();
  });

  it('blocks a second response once accepted', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/public/quotes/${shareToken}/respond`,
      payload: { action: 'decline' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('shows the accepted quote in the client portal inbox (email match)', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/client/quotes',
      headers: { cookie: clientCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const found = body.quotes.find((q: any) => q.id === quoteId);
    expect(found).toBeTruthy();
    expect(found.status).toBe('ACCEPTED');
  });

  it('lets an authenticated client accept a sent quote via the portal', async () => {
    const create = await server.inject({
      method: 'POST',
      url: '/api/v1/quotes',
      headers: { cookie: adminCookie },
      payload: {
        title: 'Portal-responded quote',
        clientName: 'David Omondi',
        clientEmail: 'client@apexbuilders.co.ke',
        items: [{ description: 'Portal test item', quantity: 2, unitRate: 1000 }],
      },
    });
    const q = JSON.parse(create.body).quote;
    await server.inject({
      method: 'POST',
      url: `/api/v1/quotes/${q.id}/send`,
      headers: { cookie: adminCookie },
      payload: {},
    });

    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/client/quotes/${q.id}/respond`,
      headers: { cookie: clientCookie },
      payload: { action: 'accept', typedName: 'David Omondi' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).quote.status).toBe('ACCEPTED');
  });

  it('hides tenant A quotes from tenant B', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/quotes',
      headers: { cookie: tenantBCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.quotes.some((q: any) => q.id === quoteId)).toBe(false);

    const detail = await server.inject({
      method: 'GET',
      url: `/api/v1/quotes/${quoteId}`,
      headers: { cookie: tenantBCookie },
    });
    expect(detail.statusCode).toBe(404);
  });

  it('converts an accepted quote into a project', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/quotes/${quoteId}/convert`,
      headers: { cookie: adminCookie },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.project.id).toBeTruthy();
    expect(body.project.code).toBeTruthy();
    expect(body.quote.status).toBe('CONVERTED');
    expect(body.quote.converted_project_id).toBe(body.project.id);

    // contract sum seeded from quote total
    const project = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.project.findUnique({ where: { id: body.project.id } });
    });
    expect(Number(project!.original_contract_sum)).toBe(667000);
  });

  it('rejects converting a non-accepted quote', async () => {
    // create + send a second quote but do not accept it
    const create = await server.inject({
      method: 'POST',
      url: '/api/v1/quotes',
      headers: { cookie: adminCookie },
      payload: {
        title: 'Unaccepted quote',
        clientName: 'Someone',
        items: [{ description: 'x', quantity: 1, unitRate: 100 }],
      },
    });
    const q2 = JSON.parse(create.body).quote;
    await server.inject({
      method: 'POST',
      url: `/api/v1/quotes/${q2.id}/send`,
      headers: { cookie: adminCookie },
      payload: {},
    });
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/quotes/${q2.id}/convert`,
      headers: { cookie: adminCookie },
      payload: {},
    });
    expect(res.statusCode).toBe(409);
  });

  it('records the full event trail', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/quotes/${quoteId}`,
      headers: { cookie: adminCookie },
    });
    const body = JSON.parse(res.body);
    const events = body.quote.events.map((e: any) => e.event);
    expect(events).toContain('CREATED');
    expect(events).toContain('SENT');
    expect(events).toContain('VIEWED');
    expect(events).toContain('ACCEPTED');
    expect(events).toContain('CONVERTED');
  });

  // -------------------------------------------------------------------------
  // C-03 / ADR-005: Decimal money math — line sum == subtotal, HALF_UP cents
  // -------------------------------------------------------------------------
  it('computes money with Decimal precision: line sum == subtotal', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/quotes',
      headers: { cookie: adminCookie },
      payload: {
        title: 'Rounding precision probe',
        clientName: 'Precision Client',
        taxPct: 0,
        depositPct: 0,
        items: [
          // 3 * 333.335 = 1000.005 -> HALF_UP to 1000.01 (float math would drift)
          { description: 'Fractional rate A', unit: 'm3', quantity: 3, unitRate: 333.335 },
          // 1 * 0.1 + 1 * 0.2 must not produce 0.30000000000000004
          { description: 'Fractional rate B', unit: 'kg', quantity: 1, unitRate: 0.1 },
          { description: 'Fractional rate C', unit: 'kg', quantity: 1, unitRate: 0.2 },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const q = JSON.parse(res.body).quote;

    const lineSum = q.items.reduce((s: number, i: any) => s + Number(i.total_amount), 0);
    expect(Number(q.subtotal)).toBeCloseTo(lineSum, 2);
    // exact expected: 1000.01 + 0.10 + 0.20 = 1000.31
    expect(Number(q.subtotal)).toBe(1000.31);
    expect(Number(q.total)).toBe(1000.31);
    expect(Number(q.items[0].total_amount)).toBe(1000.01);
  });

  // -------------------------------------------------------------------------
  // Expiry: valid_until enforced on respond + expire_quotes_batch() job
  // -------------------------------------------------------------------------
  it('expires a sent quote lazily on public respond once valid_until passes', async () => {
    const create = await server.inject({
      method: 'POST',
      url: '/api/v1/quotes',
      headers: { cookie: adminCookie },
      payload: {
        title: 'Expiring quote',
        clientName: 'Expiring Client',
        clientEmail: 'client@apexbuilders.co.ke',
        validDays: 30,
        items: [{ description: 'x', quantity: 1, unitRate: 100 }],
      },
    });
    const q = JSON.parse(create.body).quote;
    const send = await server.inject({
      method: 'POST',
      url: `/api/v1/quotes/${q.id}/send`,
      headers: { cookie: adminCookie },
      payload: {},
    });
    const token = JSON.parse(send.body).shareToken;

    // Force validity into the past
    await withTenantTx(prisma, tenantAId, async (tx) => {
      await tx.quote.update({
        where: { id: q.id },
        data: { valid_until: new Date(Date.now() - 60_000) },
      });
    });

    const res = await server.inject({
      method: 'POST',
      url: `/api/public/quotes/${token}/respond`,
      remoteAddress: '10.7.0.1',
      payload: { action: 'accept', typedName: 'Expiring Client' },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).message).toContain('expired');

    const after = await withTenantTx(prisma, tenantAId, async (tx) => tx.quote.findUnique({ where: { id: q.id } }));
    expect(after!.status).toBe('EXPIRED');

    const events = await withTenantTx(prisma, tenantAId, async (tx) =>
      tx.quoteEvent.findMany({ where: { quote_id: q.id, event: 'EXPIRED' } }),
    );
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('expire_quotes_batch() flips stale SENT quotes across tenants', async () => {
    const create = await server.inject({
      method: 'POST',
      url: '/api/v1/quotes',
      headers: { cookie: adminCookie },
      payload: {
        title: 'Batch expiry probe',
        clientName: 'Batch Client',
        validDays: 30,
        items: [{ description: 'x', quantity: 1, unitRate: 50 }],
      },
    });
    const q = JSON.parse(create.body).quote;
    await server.inject({
      method: 'POST',
      url: `/api/v1/quotes/${q.id}/send`,
      headers: { cookie: adminCookie },
      payload: {},
    });
    await withTenantTx(prisma, tenantAId, async (tx) => {
      await tx.quote.update({
        where: { id: q.id },
        data: { valid_until: new Date(Date.now() - 120_000) },
      });
    });

    await prisma.$queryRaw`SELECT expire_quotes_batch()`;

    const after = await withTenantTx(prisma, tenantAId, async (tx) => tx.quote.findUnique({ where: { id: q.id } }));
    expect(after!.status).toBe('EXPIRED');
  });

  it('client respond endpoint also rejects expired quotes', async () => {
    const create = await server.inject({
      method: 'POST',
      url: '/api/v1/quotes',
      headers: { cookie: adminCookie },
      payload: {
        title: 'Client-side expiry probe',
        clientName: 'Client Expiry',
        clientEmail: 'client@apexbuilders.co.ke',
        validDays: 30,
        items: [{ description: 'x', quantity: 1, unitRate: 10 }],
      },
    });
    const q = JSON.parse(create.body).quote;
    await server.inject({
      method: 'POST',
      url: `/api/v1/quotes/${q.id}/send`,
      headers: { cookie: adminCookie },
      payload: {},
    });
    await withTenantTx(prisma, tenantAId, async (tx) => {
      await tx.quote.update({
        where: { id: q.id },
        data: { valid_until: new Date(Date.now() - 60_000) },
      });
    });

    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/client/quotes/${q.id}/respond`,
      headers: { cookie: clientCookie },
      payload: { action: 'accept', typedName: 'Client Expiry' },
    });
    expect(res.statusCode).toBe(409);
  });

  // -------------------------------------------------------------------------
  // Atomic accept: concurrent responses — exactly one wins
  // -------------------------------------------------------------------------
  it('allows exactly one concurrent accept (atomic SENT guard)', async () => {
    const create = await server.inject({
      method: 'POST',
      url: '/api/v1/quotes',
      headers: { cookie: adminCookie },
      payload: {
        title: 'Race accept probe',
        clientName: 'Race Client',
        clientEmail: 'client@apexbuilders.co.ke',
        items: [{ description: 'x', quantity: 1, unitRate: 25 }],
      },
    });
    const q = JSON.parse(create.body).quote;
    const send = await server.inject({
      method: 'POST',
      url: `/api/v1/quotes/${q.id}/send`,
      headers: { cookie: adminCookie },
      payload: {},
    });
    const token = JSON.parse(send.body).shareToken;

    const [r1, r2] = await Promise.all([
      server.inject({
        method: 'POST',
        url: `/api/public/quotes/${token}/respond`,
        remoteAddress: '10.7.0.2',
        payload: { action: 'accept', typedName: 'Race Client' },
      }),
      server.inject({
        method: 'POST',
        url: `/api/public/quotes/${token}/respond`,
        remoteAddress: '10.7.0.3',
        payload: { action: 'decline', typedName: 'Race Client' },
      }),
    ]);
    const codes = [r1.statusCode, r2.statusCode].sort();
    expect(codes).toEqual([200, 409]);
  });

  // -------------------------------------------------------------------------
  // VIEWED dedupe: repeated public GETs within an hour log one event
  // -------------------------------------------------------------------------
  it('dedupes VIEWED events on repeated public link opens', async () => {
    const create = await server.inject({
      method: 'POST',
      url: '/api/v1/quotes',
      headers: { cookie: adminCookie },
      payload: {
        title: 'Viewed dedupe probe',
        clientName: 'Viewer',
        items: [{ description: 'x', quantity: 1, unitRate: 5 }],
      },
    });
    const q = JSON.parse(create.body).quote;
    const send = await server.inject({
      method: 'POST',
      url: `/api/v1/quotes/${q.id}/send`,
      headers: { cookie: adminCookie },
      payload: {},
    });
    const token = JSON.parse(send.body).shareToken;

    await server.inject({ method: 'GET', url: `/api/public/quotes/${token}`, remoteAddress: '10.7.0.4' });
    await server.inject({ method: 'GET', url: `/api/public/quotes/${token}`, remoteAddress: '10.7.0.4' });
    await server.inject({ method: 'GET', url: `/api/public/quotes/${token}`, remoteAddress: '10.7.0.4' });

    const views = await withTenantTx(prisma, tenantAId, async (tx) =>
      tx.quoteEvent.findMany({
        where: { quote_id: q.id, event: 'VIEWED', created_at: { gte: new Date(Date.now() - 3600_000) } },
      }),
    );
    expect(views.length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Rate limiting on /api/public/*
  // -------------------------------------------------------------------------
  it('rate limits public quote endpoints after threshold', async () => {
    let lastStatus = 0;
    for (let i = 0; i < 31; i++) {
      const res = await server.inject({
        method: 'GET',
        url: '/api/public/quotes/definitely-invalid-token',
        remoteAddress: '10.9.9.9',
      });
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(429);
  });

  // -------------------------------------------------------------------------
  // Deposit invoice auto-draft on convert (ADR-007 / S1 completion)
  // -------------------------------------------------------------------------
  it('auto-drafts a deposit invoice when converting with createDepositInvoice', async () => {
    const create = await server.inject({
      method: 'POST',
      url: '/api/v1/quotes',
      headers: { cookie: adminCookie },
      payload: {
        title: 'Deposit invoice probe',
        clientName: 'Deposit Client',
        clientEmail: 'client@apexbuilders.co.ke',
        taxPct: 16,
        depositPct: 50,
        items: [{ description: 'Works', quantity: 2, unitRate: 100000 }],
      },
    });
    const q = JSON.parse(create.body).quote;
    const send = await server.inject({
      method: 'POST',
      url: `/api/v1/quotes/${q.id}/send`,
      headers: { cookie: adminCookie },
      payload: {},
    });
    const token = JSON.parse(send.body).shareToken;
    await server.inject({
      method: 'POST',
      url: `/api/public/quotes/${token}/respond`,
      remoteAddress: '10.7.0.5',
      payload: { action: 'accept', typedName: 'Deposit Client' },
    });

    // subtotal 200000, tax 32000, total 232000, deposit 50% = 116000
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/quotes/${q.id}/convert`,
      headers: { cookie: adminCookie },
      payload: { createDepositInvoice: true },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.depositInvoice).toBeTruthy();
    expect(body.depositInvoice.status).toBe('DRAFT');
    expect(Number(body.depositInvoice.total)).toBe(116000);

    const inv = await server.inject({
      method: 'GET',
      url: `/api/v1/invoices/${body.depositInvoice.id}`,
      headers: { cookie: adminCookie },
    });
    expect(inv.statusCode).toBe(200);
    const invBody = JSON.parse(inv.body).invoice;
    expect(invBody.project_id).toBe(body.project.id);
    expect(invBody.quote_id).toBe(q.id);
    expect(invBody.items).toHaveLength(1);
    expect(invBody.client_name).toBe('Deposit Client');
  });
});
