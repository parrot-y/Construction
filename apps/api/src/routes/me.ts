import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Role, Roles } from '@construction/permissions';
import { toCurrencyString, toDecimal } from '@construction/money';
import {
  ClientPaymentNoticeSchema,
} from '@construction/validation';
import { notifyTeam } from '../lib/notify';
import { PRODUCT_NAME } from '../lib/product';
import { listParams, listPage } from '../lib/pagination';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TENANT_WIDE = new Set<Role>([Roles.COMPANY_ADMIN, Roles.ADMIN, Roles.EXECUTIVE]);

/** Project ids the caller belongs to (empty for tenant-wide roles). */
async function memberProjectIds(tx: any, userId: string): Promise<string[]> {
  const rows = await tx.projectMember.findMany({
    where: { user_id: userId },
    select: { project_id: true },
  });
  return rows.map((r: any) => r.project_id);
}

export const meRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Product name — single configurable value (PRODUCT_NAME env, Stage 4).
  server.get('/api/v1/product', { preHandler: [server.authenticate] }, async (_request, reply) => {
    return reply.send({ data: { productName: PRODUCT_NAME } });
  });

  // -------------------------------------------------------------------------
  // GET /api/v1/fx-rates — dated, sourced exchange rates for client display.
  // Pilot: rates are manually maintained reference rates (no live provider
  // integration yet); the payload is honest about source and as-of date.
  // -------------------------------------------------------------------------
  server.get('/api/v1/fx-rates', { preHandler: [server.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user;
    // Rates come from the tenant's own fx_rates record (admin-maintained,
    // dated and sourced). No record -> 404 and the UI hides conversion
    // entirely rather than inventing a rate.
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { fx_rates: true },
    });
    const fx = tenant?.fx_rates as any;
    if (!fx || typeof fx !== 'object' || !fx.rates || typeof fx.rates !== 'object') {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No exchange rates configured for this company',
      });
    }
    return reply.status(200).send({
      data: {
        base: fx.base ?? 'KES',
        rates: { KES: 1, ...fx.rates },
        asOf: fx.asOf,
        source: fx.source,
        manual: true,
      },
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/v1/me/invoices — invoices for projects the caller belongs to,
  // with balances, payment history and the tenant's payment instructions.
  // -------------------------------------------------------------------------
  server.get('/api/v1/me/invoices', { preHandler: [server.authenticate] }, async (request, reply) => {
    const { tenantId, sub, role } = request.user;
    const pg = listParams(request);
    try {
      const payload = await withTenantTx(prisma, tenantId, async (tx) => {
        const projectIds = TENANT_WIDE.has(role as Role) ? null : await memberProjectIds(tx, sub);
        const invoices = await tx.invoice.findMany({
          where: projectIds === null ? {} : { project_id: { in: projectIds } },
          include: {
            payments: { orderBy: { created_at: 'asc' } },
            payment_notices: { orderBy: { created_at: 'desc' } },
            project: { select: { id: true, name: true, code: true } },
          },
          orderBy: { created_at: 'desc' },
          skip: pg.skip,
          take: pg.limit + 1,
        });
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { payment_instructions: true, currency: true },
        });
        return { invoices, paymentInstructions: tenant?.payment_instructions ?? null };
      });

      const pagedInvoices = listPage(payload.invoices, pg);
      const data = pagedInvoices.data.map((inv: any) => {
        const total = toDecimal(inv.total.toString());
        const paid = inv.payments.reduce((acc: any, p: any) => acc.plus(toDecimal(p.amount.toString())), toDecimal('0'));
        return {
          id: inv.id,
          title: inv.title,
          invoice_no: inv.invoice_no,
          status: inv.status,
          project: inv.project,
          currency: inv.currency,
          total: toCurrencyString(total),
          amount_paid: toCurrencyString(paid),
          balance_due: toCurrencyString(total.minus(paid)),
          issue_date: inv.issue_date ? inv.issue_date.toISOString().split('T')[0] : null,
          due_date: inv.due_date ? inv.due_date.toISOString().split('T')[0] : null,
          payment_history: inv.payments.map((p: any) => ({
            id: p.id,
            amount: toCurrencyString(toDecimal(p.amount.toString())),
            method: p.method,
            reference: p.reference,
            paid_at: p.paid_at ? p.paid_at.toISOString() : p.created_at.toISOString(),
          })),
          payment_notices: inv.payment_notices.map((n: any) => ({
            id: n.id,
            amount: toCurrencyString(toDecimal(n.amount.toString())),
            method: n.method,
            reference: n.reference,
            note: n.note,
            status: n.status,
            created_at: n.created_at.toISOString(),
          })),
        };
      });

      return reply.status(200).send({
        data: { invoices: data, paymentInstructions: payload.paymentInstructions },
        invoices: data,
        paymentInstructions: payload.paymentInstructions,
        page: pagedInvoices.page,
      });
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load invoices' });
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/v1/me/approvals — "Waiting for you" feed for CLIENT/OWNER:
  // variations in review, certificates issued, quotes awaiting response.
  // -------------------------------------------------------------------------
  server.get('/api/v1/me/approvals', { preHandler: [server.authenticate] }, async (request, reply) => {
    const { tenantId, sub, role } = request.user;
    const pg = listParams(request);
    try {
      const items = await withTenantTx(prisma, tenantId, async (tx) => {
        const projectIds = TENANT_WIDE.has(role as Role) ? null : await memberProjectIds(tx, sub);
        const projectWhere = projectIds === null ? {} : { project_id: { in: projectIds } };

        const variations = await tx.variationOrder.findMany({
          where: { ...projectWhere, status: { in: ['PM_REVIEW', 'OWNER_REVIEW', 'SUBMITTED', 'QS_EVALUATED'] } },
          select: { id: true, title: true, status: true, project_id: true, net_amount: true, created_at: true },
          orderBy: { created_at: 'desc' },
          take: pg.limit,
        });
        const certificates = await tx.paymentCertificate.findMany({
          where: { ...projectWhere, status: { in: ['CERTIFIED', 'SUBMITTED', 'UNDER_REVIEW'] } },
          select: { id: true, certificate_no: true, status: true, project_id: true, net_payable: true, created_at: true },
          orderBy: { created_at: 'desc' },
          take: pg.limit,
        });
        const quotes = role === Roles.CLIENT
          ? await tx.quote.findMany({
              where: { status: 'SENT', client_email: (request.user as any).email },
              select: { id: true, quote_no: true, title: true, status: true, total: true, created_at: true },
              orderBy: { created_at: 'desc' },
              take: pg.limit,
            })
          : [];

        return [
          ...variations.map((v: any) => ({
            type: 'VARIATION', id: v.id, title: v.title, status: v.status,
            projectId: v.project_id, amount: v.net_amount?.toString() ?? null, createdAt: v.created_at,
          })),
          ...certificates.map((c: any) => ({
            type: 'CERTIFICATE', id: c.id, title: c.certificate_no, status: c.status,
            projectId: c.project_id, amount: c.net_payable?.toString() ?? null, createdAt: c.created_at,
          })),
          ...quotes.map((q: any) => ({
            type: 'QUOTE', id: q.id, title: q.title || q.quote_no, status: q.status,
            projectId: null, amount: q.total?.toString() ?? null, createdAt: q.created_at,
          })),
        ];
      });
      return reply.status(200).send({ data: items, items });
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load approvals' });
    }
  });
};

/**
 * POST /api/v1/client/invoices/:id/payment-notice — a client reports that they
 * have paid. This NEVER mutates the invoice: it records a notice, notifies the
 * contractor inbox, and is only confirmed when the contractor records the
 * actual payment via POST /api/v1/invoices/:id/payments.
 */
export const clientPaymentNoticeRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.post(
    '/api/v1/client/invoices/:invoiceId/payment-notice',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { invoiceId } = request.params as { invoiceId: string };
      if (!UUID_REGEX.test(invoiceId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invoice not found' });
      }
      const parsed = ClientPaymentNoticeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid payment notice', details: parsed.error.flatten() });
      }
      const d = parsed.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const invoice = await tx.invoice.findFirst({
            where: { id: invoiceId },
            include: { project: { select: { id: true, name: true } } },
          });
          if (!invoice) throw { status: 404, message: 'Invoice not found' };

          // Caller must be a member of the invoice's project (or tenant-wide).
          // Invoices without a project are contractor-side only.
          if (!TENANT_WIDE.has(role as Role)) {
            if (!invoice.project_id) throw { status: 403, message: 'Not a member of this project' };
            const member = await tx.projectMember.findFirst({
              where: { project_id: invoice.project_id, user_id: sub },
              select: { id: true },
            });
            if (!member) throw { status: 403, message: 'Not a member of this project' };
          }

          const notice = await tx.clientPaymentNotice.create({
            data: {
              tenant_id: tenantId,
              invoice_id: invoice.id,
              user_id: sub,
              amount: d.amount,
              method: d.method,
              reference: d.reference || null,
              note: d.note || null,
            },
          });

          const userName = (request.user as any).fullName || (request.user as any).email || 'A client';
          await notifyTeam(tx, {
            tenantId,
            projectId: invoice.project_id,
            senderId: sub,
            senderName: `${userName} (client portal)`,
            body: `Payment notice for invoice ${invoice.invoice_no || invoice.id}: ${toCurrencyString(toDecimal(d.amount.toString()))} via ${d.method}${d.reference ? `, ref ${d.reference}` : ''}. Awaiting contractor confirmation — invoice unchanged.`,
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId: invoice.project_id,
            actorId: sub,
            action: 'CLIENT_PAYMENT_NOTICE_SUBMITTED',
            entityType: 'ClientPaymentNotice',
            entityId: notice.id,
            changes: { invoiceId: invoice.id, amount: d.amount, method: d.method, reference: d.reference ?? null },
          });
          return notice;
        });

        return reply.status(201).send({
          data: result,
          notice: {
            id: result.id,
            amount: toCurrencyString(toDecimal(result.amount.toString())),
            method: result.method,
            reference: result.reference,
            note: result.note,
            status: result.status,
            created_at: result.created_at.toISOString(),
          },
        });
      } catch (err: any) {
        if (err?.status) {
          return reply.status(err.status).send({ statusCode: err.status, error: err.status === 404 ? 'Not Found' : 'Forbidden', message: err.message });
        }
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to record payment notice' });
      }
    },
  );
};
