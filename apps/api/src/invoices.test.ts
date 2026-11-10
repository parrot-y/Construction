import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx, hashPassword } from '@construction/db';

describe('Gate-4 S2: Invoicing (AR) suite', () => {
  const server = buildServer();

  let adminCookie: string;
  let clientCookie: string;
  let supervisorCookie: string;
  let tenantBCookie: string;
  let tenantAId: string;
  let projectAId: string;

  let invoiceId: string;

  const login = async (email: string, password = 'Password123!') => {
    return server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
  };

  const createInvoice = async (overrides: Record<string, any> = {}) => {
    return server.inject({
      method: 'POST',
      url: '/api/v1/invoices',
      headers: { cookie: adminCookie },
      payload: {
        title: 'Progress claim invoice',
        clientName: 'David Omondi',
        clientEmail: 'client@apexbuilders.co.ke',
        projectId: projectAId,
        currency: 'KES',
        taxPct: 16,
        dueDays: 30,
        paybill: '5221234',
        items: [
          { section: 'Works', description: 'Foundation complete', unit: 'lot', quantity: 1, unitRate: 500000 },
          { description: 'Mobilization', unit: 'item', quantity: 1, unitRate: 50000 },
        ],
        ...overrides,
      },
    });
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

    const defaultPasswordHash = await hashPassword('Password123!');
    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-b-invoices' },
      update: {},
      create: { name: 'Invoices Isolation Ltd', slug: 'test-tenant-b-invoices', currency: 'KES' },
    });
    const userB = await prisma.user.upsert({
      where: { email: 'admin@invoices-isolation.co.ke' },
      update: { password_hash: defaultPasswordHash, email_verified_at: new Date() },
      create: {
        email: 'admin@invoices-isolation.co.ke',
        password_hash: defaultPasswordHash,
        full_name: 'Test Admin B',
        is_active: true,
        email_verified_at: new Date(),
      },
    });
    await withTenantTx(prisma, tenantB.id, async (tx) => {
      await tx.membership.upsert({
        where: { tenant_id_user_id: { tenant_id: tenantB.id, user_id: userB.id } },
        update: { role: 'COMPANY_ADMIN' },
        create: { tenant_id: tenantB.id, user_id: userB.id, role: 'COMPANY_ADMIN' },
      });
    });
    const resB = await login('admin@invoices-isolation.co.ke');
    tenantBCookie = resB.headers['set-cookie'] as string;

    const project = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.project.findFirst({ where: { tenant_id: tenantAId } });
    });
    projectAId = project!.id;
  });

  it('creates an invoice with computed totals and derived due date', async () => {
    const res = await createInvoice();
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    invoiceId = body.invoice.id;
    expect(body.invoice.status).toBe('DRAFT');
    // subtotal = 500000 + 50000 = 550000; tax 16% = 88000; total 638000
    expect(Number(body.invoice.subtotal)).toBe(550000);
    expect(Number(body.invoice.tax_amount)).toBe(88000);
    expect(Number(body.invoice.total)).toBe(638000);
    expect(Number(body.invoice.balance_due)).toBe(638000);
    expect(Number(body.invoice.amount_paid)).toBe(0);
    expect(body.invoice.items).toHaveLength(2);
    expect(body.invoice.invoice_no).toBeGreaterThan(0);

    // due date = issue + 30 days
    const issue = new Date(body.invoice.issue_date);
    const due = new Date(body.invoice.due_date);
    expect(Math.round((due.getTime() - issue.getTime()) / 86400000)).toBe(30);
  });

  it('lists invoices for the tenant', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/invoices',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.invoices.some((i: any) => i.id === invoiceId)).toBe(true);
  });

  it('rejects invoice creation for SITE_SUPERVISOR (no INVOICE_CREATE)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/invoices',
      headers: { cookie: supervisorCookie },
      payload: {
        title: 'Should fail',
        clientName: 'X',
        items: [{ description: 'x', quantity: 1, unitRate: 1 }],
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('denies CLIENT role from the contractor invoice list', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/invoices',
      headers: { cookie: clientCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects payment recording on a DRAFT invoice', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/invoices/${invoiceId}/payments`,
      headers: { cookie: adminCookie },
      payload: { amount: 100000, method: 'M_PESA', reference: 'QGH7X2' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('sends the invoice (DRAFT -> SENT)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/invoices/${invoiceId}/send`,
      headers: { cookie: adminCookie },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.invoice.status).toBe('SENT');
    expect(body.invoice.stored_status).toBe('SENT');
  });

  it('blocks editing a sent invoice', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/invoices/${invoiceId}`,
      headers: { cookie: adminCookie },
      payload: { title: 'Changed' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('records a partial M-Pesa payment -> PART_PAID with correct balance', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/invoices/${invoiceId}/payments`,
      headers: { cookie: adminCookie },
      payload: { amount: 300000, method: 'M_PESA', reference: 'QGH7X2ABC', note: 'Deposit via paybill' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.invoice.status).toBe('PART_PAID');
    expect(Number(body.invoice.amount_paid)).toBe(300000);
    expect(Number(body.invoice.balance_due)).toBe(338000);
    expect(body.invoice.payments).toHaveLength(1);
    expect(body.invoice.payments[0].method).toBe('M_PESA');
    expect(body.payment.id).toBeTruthy();
  });

  it('rejects overpayment beyond balance due', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/invoices/${invoiceId}/payments`,
      headers: { cookie: adminCookie },
      payload: { amount: 999999, method: 'BANK' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('records the remaining payment -> PAID', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/invoices/${invoiceId}/payments`,
      headers: { cookie: adminCookie },
      payload: { amount: 338000, method: 'BANK', reference: 'TRF-9981' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.invoice.status).toBe('PAID');
    expect(Number(body.invoice.amount_paid)).toBe(638000);
    expect(Number(body.invoice.balance_due)).toBe(0);
    expect(body.invoice.paid_at).toBeTruthy();
    expect(body.invoice.payments).toHaveLength(2);
  });

  it('blocks further payments on a PAID invoice', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/invoices/${invoiceId}/payments`,
      headers: { cookie: adminCookie },
      payload: { amount: 1, method: 'CASH' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('voids a draft invoice', async () => {
    const create = await createInvoice({ title: 'Void me', dueDays: 7 });
    const vid = JSON.parse(create.body).invoice.id;
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/invoices/${vid}/void`,
      headers: { cookie: adminCookie },
      payload: { reason: 'Duplicate entry' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.invoice.status).toBe('VOID');
    expect(body.invoice.void_reason).toBe('Duplicate entry');
  });

  it('derives OVERDUE status for unpaid invoices past due date', async () => {
    // dueDays 0 -> due date = issue date (midnight UTC), which is < now
    const create = await createInvoice({ title: 'Overdue test', dueDays: 0 });
    const oid = JSON.parse(create.body).invoice.id;

    await server.inject({
      method: 'POST',
      url: `/api/v1/invoices/${oid}/send`,
      headers: { cookie: adminCookie },
      payload: {},
    });

    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/invoices/${oid}`,
      headers: { cookie: adminCookie },
    });
    const body = JSON.parse(res.body);
    expect(body.invoice.status).toBe('OVERDUE');
    expect(body.invoice.stored_status).toBe('SENT');

    const list = await server.inject({
      method: 'GET',
      url: '/api/v1/invoices?status=OVERDUE',
      headers: { cookie: adminCookie },
    });
    expect(list.statusCode).toBe(200);
    const listBody = JSON.parse(list.body);
    expect(listBody.invoices.some((i: any) => i.id === oid)).toBe(true);
  });

  it('generates a PDF for the invoice', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/invoices/${invoiceId}/pdf`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.rawPayload.length).toBeGreaterThan(500);
  });

  it('hides tenant A invoices from tenant B', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/invoices',
      headers: { cookie: tenantBCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.invoices.some((i: any) => i.id === invoiceId)).toBe(false);

    const detail = await server.inject({
      method: 'GET',
      url: `/api/v1/invoices/${invoiceId}`,
      headers: { cookie: tenantBCookie },
    });
    expect(detail.statusCode).toBe(404);
  });

  it('writes audit log entries for invoice lifecycle', async () => {
    const logs = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.auditLog.findMany({
        where: { entity_type: 'Invoice', entity_id: invoiceId },
        orderBy: { created_at: 'asc' },
      });
    });
    const actions = logs.map((l: any) => l.action);
    expect(actions).toContain('INVOICE_CREATED');
    expect(actions).toContain('INVOICE_SENT');
    expect(actions).toContain('INVOICE_PAYMENT_RECORDED');
    expect(actions).toContain('INVOICE_PDF_GENERATED');
  });
});
