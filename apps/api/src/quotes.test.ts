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
});
