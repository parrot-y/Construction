import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@construction/db';
import React from 'react';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { toCurrencyString, toDecimal, Decimal, calculateLineTotal, DecimalValue, formatMoneyNumber } from '@construction/money';
import {
  CreateInvoiceSchema,
  UpdateInvoiceSchema,
  RecordInvoicePaymentSchema,
  VoidInvoiceSchema,
} from '@construction/validation';
import { requirePermission } from '../plugins/rbac';
import { listParams, listPage } from '../lib/pagination';
import { nextDocumentNumber } from '../lib/counters';
import { evaluateSelfApproval } from '../plugins/makerChecker';
import { recordInvoicePaymentTx } from '../services/invoicePayments';
import { renderPdfToBufferLimited } from '../reports/renderPdf';
import { InvoicePdf, InvoicePdfData } from '../reports/InvoicePdf';
import type { RouteError } from '../types/errors';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MONEY = (v: unknown) => (v == null ? '0' : v.toString());

/**
 * ADR-005 / C-03: invoice money math uses decimal.js; line totals rounded
 * HALF_UP to cents, subtotal == sum of line totals.
 */
function computeInvoiceTotals(
  items: { quantity: DecimalValue; unitRate: DecimalValue }[],
  taxPct: DecimalValue,
) {
  const lineTotals = items.map((it) => calculateLineTotal(it.quantity, it.unitRate));
  const subtotal = lineTotals.reduce((s, t) => s.plus(t), new Decimal(0));
  const taxAmount = subtotal
    .times(toDecimal(taxPct))
    .dividedBy(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const total = subtotal.plus(taxAmount);
  return { subtotal, taxAmount, total, lineTotals };
}

/** OVERDUE is derived, never stored: unpaid invoice past its due date. */
type InvoiceRecord = {
  status: string;
  due_date?: Date | string | null;
  amount_paid?: unknown;
  total?: unknown;
  subtotal?: unknown;
  tax_pct?: { toString(): string } | null;
  tax_amount?: unknown;
  certificate_id?: string | null;
  wht_pct?: { toString(): string } | null;
  wht_amount?: unknown;
  balance_due?: unknown;
  self_approved?: boolean | null;
  items?: Array<Record<string, unknown> & { quantity?: unknown; unit_rate?: unknown; total_amount?: unknown }> | null;
  payments?: unknown[] | null;
  [key: string]: unknown;
};

function effectiveStatus(inv: InvoiceRecord): string {
  if ((inv.status === 'SENT' || inv.status === 'PART_PAID') && inv.due_date && new Date(inv.due_date) < new Date()) {
    return 'OVERDUE';
  }
  return inv.status;
}

function formatInvoice(inv: InvoiceRecord | null | undefined) {
  if (!inv) return null;
  const paid = Number(inv.amount_paid ?? 0);
  const total = Number(inv.total ?? 0);
  return {
    ...inv,
    status: effectiveStatus(inv),
    selfApproved: !!inv.self_approved,
    stored_status: inv.status,
    subtotal: toCurrencyString(MONEY(inv.subtotal)),
    tax_pct: inv.tax_pct ? inv.tax_pct.toString() : '0',
    tax_amount: toCurrencyString(MONEY(inv.tax_amount)),
    certificate_id: inv.certificate_id ?? null,
    certificateId: inv.certificate_id ?? null,
    wht_pct: inv.wht_pct ? inv.wht_pct.toString() : '0',
    wht_amount: toCurrencyString(MONEY(inv.wht_amount)),
    total: toCurrencyString(MONEY(inv.total)),
    amount_paid: toCurrencyString(MONEY(inv.amount_paid)),
    balance_due: toCurrencyString(MONEY(inv.balance_due)),
    amount_paid_num: paid,
    balance_due_num: Math.round((total - paid) * 100) / 100,
    items: inv.items
      ? inv.items.map((i) => ({
          ...i,
          quantity: i.quantity ? i.quantity.toString() : '0',
          unit_rate: i.unit_rate ? i.unit_rate.toString() : '0',
          total_amount: toCurrencyString(MONEY(i.total_amount)),
        }))
      : [],
    payments: inv.payments ?? [],
  };
}

export const invoicesRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // GET /api/v1/invoices - List invoices
  // -------------------------------------------------------------------------
  server.get(
    '/api/v1/invoices',
    {
      schema: {"tags": ["Invoices"], "summary": "List invoices", "security": [{"cookieAuth": []}], "parameters": [{"name": "status", "in": "query", "schema": {"type": "string", "enum": ["DRAFT", "SENT", "PART_PAID", "PAID", "VOID", "OVERDUE", "ALL"]}}, {"name": "projectId", "in": "query", "schema": {"type": "string", "format": "uuid"}}, {"name": "q", "in": "query", "schema": {"type": "string"}}, {"name": "page", "in": "query", "schema": {"type": "integer", "default": 1}}, {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 25}}]},
 preHandler: [server.authenticate, requirePermission(Permissions.INVOICE_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { status, projectId, q } = request.query as Record<string, string | undefined>;
      const pg = listParams(request);

      const where: Prisma.InvoiceWhereInput = {
        ...(projectId && UUID_REGEX.test(projectId) ? { project_id: projectId } : {}),
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      };
      const statusFilter = status?.toUpperCase();
      if (statusFilter === 'OVERDUE') {
        where.status = { in: ['SENT', 'PART_PAID'] };
        // due_date is @db.Date: lte matches effectiveStatus(), which
        // treats an invoice due today (stored as midnight) as overdue.
        where.due_date = { lte: new Date() };
      } else if (statusFilter) {
        where.status = statusFilter;
      }

      const invoices = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.invoice.findMany({
          where,
          include: {
            items: true,
            project: { select: { id: true, name: true, code: true, project_type: true, project_subtype: true } },
            _count: { select: { payments: true } },
          },
          orderBy: { invoice_no: 'desc' },
          skip: pg.skip,
          take: pg.limit + 1,
        });
      });

      const paged = listPage(invoices.map(formatInvoice), pg);
      return reply.send({ invoices: paged.data, page: paged.page });
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/invoices - Create invoice with line items
  // -------------------------------------------------------------------------
  server.post(
    '/api/v1/invoices',
    {
      schema: {"tags": ["Invoices"], "summary": "Create invoice with line items", "security": [{"cookieAuth": []}], "requestBody": {"content": {"application/json": {"schema": {"type": "object", "required": ["title", "clientName", "items"], "properties": {"title": {"type": "string"}, "clientName": {"type": "string"}, "clientEmail": {"type": "string"}, "projectId": {"type": "string", "format": "uuid"}, "currency": {"type": "string", "default": "KES"}, "taxPct": {"type": "number"}, "issueDate": {"type": "string", "format": "date"}, "dueDays": {"type": "integer"}, "items": {"type": "array", "items": {"type": "object"}}}}}}}},
      preHandler: [server.authenticate, requirePermission(Permissions.INVOICE_CREATE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = CreateInvoiceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0]?.message });
      }
      const data = parsed.data;

      for (const ref of [data.projectId, data.quoteId]) {
        if (ref && !UUID_REGEX.test(ref)) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Referenced record not found' });
        }
      }

      try {
        const invoice = await withTenantTx(prisma, tenantId, async (tx) => {
          if (data.projectId) {
            const project = await tx.project.findFirst({ where: { id: data.projectId } });
            if (!project) throw { status: 404, message: 'Project not found' };
          }
          if (data.quoteId) {
            const quote = await tx.quote.findFirst({ where: { id: data.quoteId } });
            if (!quote) throw { status: 404, message: 'Quote not found' };
          }

          const invoiceNo = await nextDocumentNumber(tx, tenantId, 'INVOICE');

          const totals = computeInvoiceTotals(data.items, data.taxPct);
          const issueDate = data.issueDate ? new Date(`${data.issueDate}T00:00:00Z`) : new Date();
          const dueDate = new Date(issueDate.getTime() + data.dueDays * 86400000);

          const created = await tx.invoice.create({
            data: {
              tenant_id: tenantId,
              invoice_no: invoiceNo,
              title: data.title,
              client_name: data.clientName,
              client_email: data.clientEmail ?? null,
              client_phone: data.clientPhone ?? null,
              bill_to: data.billTo ?? null,
              po_number: data.poNumber ?? null,
              project_id: data.projectId ?? null,
              quote_id: data.quoteId ?? null,
              currency: data.currency,
              status: 'DRAFT',
              subtotal: totals.subtotal,
              tax_pct: data.taxPct,
              tax_amount: totals.taxAmount,
              total: totals.total,
              balance_due: totals.total,
              issue_date: issueDate,
              due_date: dueDate,
              terms: data.terms ?? null,
              notes: data.notes ?? null,
              paybill: data.paybill ?? null,
              created_by: sub,
              items: {
                create: data.items.map((it, idx) => ({
                  tenant_id: tenantId,
                  section: it.section ?? null,
                  description: it.description,
                  unit: it.unit,
                  quantity: it.quantity,
                  unit_rate: it.unitRate,
                  total_amount: totals.lineTotals[idx],
                  sort_order: idx,
                })),
              },
            },
            include: { items: true },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId: data.projectId ?? null,
            actorId: sub,
            action: 'INVOICE_CREATED',
            entityType: 'Invoice',
            entityId: created.id,
            changes: { invoiceNo, title: data.title, total: totals.total },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          return created;
        });

        return reply.status(201).send({ invoice: formatInvoice(invoice) });
      } catch (rawErr) {
        const err = rawErr as RouteError;
        if (err?.status) { if (err.retryAfterSeconds) reply.header('Retry-After', String(err.retryAfterSeconds)); return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message }); }
        throw err;
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/invoices/:id - Invoice detail (items + payments)
  // -------------------------------------------------------------------------
  server.get(
    '/api/v1/invoices/:id',
    {
      schema: {"tags": ["Invoices"], "summary": "Invoice detail", "security": [{"cookieAuth": []}], "parameters": [{"name": "id", "in": "path", "required": true, "schema": {"type": "string", "format": "uuid"}}]},
 preHandler: [server.authenticate, requirePermission(Permissions.INVOICE_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invoice not found' });
      }
      const invoice = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.invoice.findFirst({
          where: { id },
          include: {
            items: { orderBy: { sort_order: 'asc' } },
            payments: { orderBy: { paid_at: 'asc' } },
            project: { select: { id: true, name: true, code: true, project_type: true, project_subtype: true } },
            quote: { select: { id: true, quote_no: true, title: true } },
          },
        });
      });
      if (!invoice) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invoice not found' });
      return reply.send({ invoice: formatInvoice(invoice) });
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /api/v1/invoices/:id - Edit draft invoice
  // -------------------------------------------------------------------------
  server.patch(
    '/api/v1/invoices/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.INVOICE_EDIT)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invoice not found' });
      }
      const parsed = UpdateInvoiceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0]?.message });
      }
      const data = parsed.data;

      try {
        const invoice = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.invoice.findFirst({ where: { id } });
          if (!existing) throw { status: 404, message: 'Invoice not found' };
          if (existing.status !== 'DRAFT') {
            throw { status: 409, message: `Cannot edit an invoice in status ${existing.status}` };
          }

          if (data.items) {
            await tx.invoiceLineItem.deleteMany({ where: { invoice_id: id } });
          }

          const itemSource = data.items ?? [];
          const keptItems = !data.items
            ? (await tx.invoiceLineItem.findMany({ where: { invoice_id: id } })).map((i) => ({
                section: i.section,
                description: i.description,
                unit: i.unit,
                quantity: i.quantity.toString(),
                unitRate: i.unit_rate.toString(),
              }))
            : itemSource;
          const taxPct = data.taxPct ?? Number(existing.tax_pct);
          const totals = computeInvoiceTotals(keptItems, taxPct);
          const issueDate = data.issueDate
            ? new Date(`${data.issueDate}T00:00:00Z`)
            : existing.issue_date;
          const dueDate = data.dueDays !== undefined
            ? new Date(new Date(issueDate).getTime() + data.dueDays * 86400000)
            : existing.due_date;

          const updated = await tx.invoice.update({
            where: { id },
            data: {
              ...(data.title !== undefined ? { title: data.title } : {}),
              ...(data.clientName !== undefined ? { client_name: data.clientName } : {}),
              ...(data.clientEmail !== undefined ? { client_email: data.clientEmail } : {}),
              ...(data.clientPhone !== undefined ? { client_phone: data.clientPhone } : {}),
              ...(data.billTo !== undefined ? { bill_to: data.billTo } : {}),
              ...(data.poNumber !== undefined ? { po_number: data.poNumber } : {}),
              ...(data.projectId !== undefined ? { project_id: data.projectId } : {}),
              ...(data.quoteId !== undefined ? { quote_id: data.quoteId } : {}),
              ...(data.currency !== undefined ? { currency: data.currency } : {}),
              ...(data.terms !== undefined ? { terms: data.terms } : {}),
              ...(data.notes !== undefined ? { notes: data.notes } : {}),
              ...(data.paybill !== undefined ? { paybill: data.paybill } : {}),
              issue_date: issueDate,
              due_date: dueDate,
              subtotal: totals.subtotal,
              tax_pct: taxPct,
              tax_amount: totals.taxAmount,
              total: totals.total,
              balance_due: totals.total.minus(toDecimal(existing.amount_paid?.toString() ?? '0')),
              ...(data.items
                ? {
                    items: {
                      create: data.items.map((it, idx) => ({
                        tenant_id: tenantId,
                        section: it.section ?? null,
                        description: it.description,
                        unit: it.unit,
                        quantity: it.quantity,
                        unit_rate: it.unitRate,
                        total_amount: totals.lineTotals[idx],
                        sort_order: idx,
                      })),
                    },
                  }
                : {}),
            },
            include: { items: true },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId: existing.project_id,
            actorId: sub,
            action: 'INVOICE_UPDATED',
            entityType: 'Invoice',
            entityId: id,
            changes: { fields: Object.keys(data) },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });
          return updated;
        });

        return reply.send({ invoice: formatInvoice(invoice) });
      } catch (rawErr) {
        const err = rawErr as RouteError;
        if (err?.status) { if (err.retryAfterSeconds) reply.header('Retry-After', String(err.retryAfterSeconds)); return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message }); }
        throw err;
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/invoices/:id/send - DRAFT -> SENT
  // -------------------------------------------------------------------------
  server.post(
    '/api/v1/invoices/:id/send',
    {
      schema: {"tags": ["Invoices"], "summary": "Send invoice (DRAFT\u2192SENT)", "security": [{"cookieAuth": []}], "parameters": [{"name": "id", "in": "path", "required": true, "schema": {"type": "string", "format": "uuid"}}], "requestBody": {"content": {"application/json": {"schema": {"type": "object", "properties": {"selfApprovalReason": {"type": "string", "minLength": 15}}}}}}},
 preHandler: [server.authenticate, requirePermission(Permissions.INVOICE_SEND)] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invoice not found' });
      }
      const sendBody = (request.body ?? {}) as { selfApprovalReason?: string | null };

      try {
        const invoice = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.invoice.findFirst({ where: { id } });
          if (!existing) throw { status: 404, message: 'Invoice not found' };
          if (existing.status !== 'DRAFT') {
            throw { status: 409, message: `Cannot send an invoice in status ${existing.status}` };
          }

          // Maker-checker: the invoice creator cannot send it themselves;
          // COMPANY_ADMIN/ADMIN only with a recorded selfApprovalReason.
          const selfAppr = evaluateSelfApproval({
            creatorId: existing.created_by,
            actorId: sub,
            actorRole: role,
            reason: sendBody.selfApprovalReason,
            entity: 'invoice',
          });

          const updated = await tx.invoice.update({
            where: { id },
            data: {
              status: 'SENT',
              sent_at: new Date(),
              self_approved: selfAppr.selfApproved,
              self_approval_reason: selfAppr.reason,
            },
            include: { items: true, payments: true },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId: existing.project_id,
            actorId: sub,
            action: 'INVOICE_SENT',
            entityType: 'Invoice',
            entityId: id,
            changes: {
              invoiceNo: existing.invoice_no,
              selfApproved: selfAppr.selfApproved,
              selfApprovalReason: selfAppr.reason,
            },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });
          return updated;
        });

        return reply.send({ invoice: formatInvoice(invoice) });
      } catch (rawErr) {
        const err = rawErr as RouteError;
        if (err?.status) { if (err.retryAfterSeconds) reply.header('Retry-After', String(err.retryAfterSeconds)); return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message }); }
        throw err;
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/invoices/:id/payments - Record a payment (partial or full)
  // -------------------------------------------------------------------------
  server.post(
    '/api/v1/invoices/:id/payments',
    {
      schema: {"tags": ["Invoices"], "summary": "Record payment (Idempotency-Key required)", "security": [{"cookieAuth": []}], "parameters": [{"name": "id", "in": "path", "required": true, "schema": {"type": "string", "format": "uuid"}}, {"name": "Idempotency-Key", "in": "header", "required": true, "schema": {"type": "string"}}], "requestBody": {"content": {"application/json": {"schema": {"type": "object", "required": ["amount", "method"], "properties": {"amount": {"type": "number"}, "method": {"type": "string", "enum": ["CASH", "BANK_TRANSFER", "M_PESA", "CHEQUE", "CARD", "OTHER"]}, "reference": {"type": "string"}, "note": {"type": "string"}}}}}}},
 preHandler: [server.authenticate, requirePermission(Permissions.INVOICE_EDIT)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invoice not found' });
      }
      // Idempotent payment recording (Stage-7): every payment POST must carry
      // an Idempotency-Key; a replay returns the originally recorded payment.
      const idempotencyKey = (request.headers['idempotency-key'] as string | undefined)?.trim();
      if (!idempotencyKey || idempotencyKey.length > 255) {
        return reply.status(400).send({
          statusCode: 400, error: 'Bad Request',
          message: 'Idempotency-Key header is required for payment recording',
        });
      }
      const parsed = RecordInvoicePaymentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0]?.message });
      }
      const data = parsed.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          // Row lock FIRST: serialise all payment posts on this invoice, then
          // re-check the idempotency key — a concurrent same-key request that
          // queued on the lock must see the committed replay, not double-post.
          await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${id}::uuid FOR UPDATE`;

          return recordInvoicePaymentTx(tx, {
            tenantId,
            invoiceId: id,
            amount: data.amount,
            method: data.method,
            reference: data.reference ?? null,
            note: data.note ?? null,
            paidAt: data.paidAt ? new Date(`${data.paidAt}T00:00:00Z`) : null,
            recordedBy: sub,
            idempotencyKey,
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
            buildBody: (invoice, payment) => ({ invoice: formatInvoice(invoice as InvoiceRecord), payment }),
          });
        });

        return reply.status(result.status).send(result.body);
      } catch (rawErr) {
        const err = rawErr as RouteError;
        const p2002Text = (JSON.stringify(err?.meta ?? '') + ' ' + String(err?.message ?? '')).toLowerCase();
        if (err?.code === 'P2002' && (p2002Text.includes('reference') || p2002Text.includes('invoicepayment') || p2002Text.includes('invoice_payments'))) {
          return reply.status(409).send({
            statusCode: 409, error: 'Conflict', code: 'DUPLICATE_PAYMENT_REFERENCE',
            message: 'A payment with this reference has already been recorded',
          });
        }
        if (err?.status) { if (err.retryAfterSeconds) reply.header('Retry-After', String(err.retryAfterSeconds)); return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message }); }
        throw err;
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/invoices/:id/void - Void a draft/sent invoice
  // -------------------------------------------------------------------------
  server.post(
    '/api/v1/invoices/:id/void',
    {
      schema: {"tags": ["Invoices"], "summary": "Void invoice", "security": [{"cookieAuth": []}], "parameters": [{"name": "id", "in": "path", "required": true, "schema": {"type": "string", "format": "uuid"}}], "requestBody": {"content": {"application/json": {"schema": {"type": "object", "required": ["reason"], "properties": {"reason": {"type": "string"}}}}}}},
 preHandler: [server.authenticate, requirePermission(Permissions.INVOICE_EDIT)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invoice not found' });
      }
      const parsed = VoidInvoiceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0]?.message });
      }

      try {
        const invoice = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.invoice.findFirst({ where: { id } });
          if (!existing) throw { status: 404, message: 'Invoice not found' };
          if (existing.status !== 'DRAFT' && existing.status !== 'SENT') {
            throw { status: 409, message: `Only DRAFT or SENT invoices can be voided (current: ${existing.status})` };
          }

          const updated = await tx.invoice.update({
            where: { id },
            data: {
              status: 'VOID',
              voided_at: new Date(),
              void_reason: parsed.data.reason,
            },
            include: { items: true, payments: true },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId: existing.project_id,
            actorId: sub,
            action: 'INVOICE_VOIDED',
            entityType: 'Invoice',
            entityId: id,
            changes: { reason: parsed.data.reason, previousStatus: existing.status },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });
          return updated;
        });

        return reply.send({ invoice: formatInvoice(invoice) });
      } catch (rawErr) {
        const err = rawErr as RouteError;
        if (err?.status) { if (err.retryAfterSeconds) reply.header('Retry-After', String(err.retryAfterSeconds)); return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message }); }
        throw err;
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/invoices/:id/pdf - Render invoice PDF
  // -------------------------------------------------------------------------
  server.get(
    '/api/v1/invoices/:id/pdf',
    { preHandler: [server.authenticate, requirePermission(Permissions.INVOICE_VIEW)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invoice not found' });
      }

      try {
        // I6: short read tx — render + audit happen outside it.
        const { pdfData, invoiceProjectId } = await withTenantTx(prisma, tenantId, async (tx) => {
          const invoice = await tx.invoice.findFirst({
            where: { id },
            include: {
              items: { orderBy: { sort_order: 'asc' } },
              payments: { orderBy: { paid_at: 'asc' } },
              project: { select: { id: true, name: true, code: true, location: true, nca_project_no: true, project_type: true, project_subtype: true } },
            },
          });
          if (!invoice) throw { status: 404, message: 'Invoice not found' };

          const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });

          const pdfData: InvoicePdfData = {
            invoiceNo: `INV-${String(invoice.invoice_no).padStart(5, '0')}`,
            title: invoice.title,
            status: effectiveStatus(invoice),
            issueDate: invoice.issue_date ? (invoice.issue_date.toISOString().split('T')[0] ?? '') : '',
            dueDate: invoice.due_date ? (invoice.due_date.toISOString().split('T')[0] ?? '') : '',
            poNumber: invoice.po_number,
            client: {
              name: invoice.client_name,
              email: invoice.client_email,
              phone: invoice.client_phone,
              billTo: invoice.bill_to,
            },
            contractor: {
              name: tenant?.name ?? '',
              kraPin: tenant?.kra_pin ?? null,
              currency: invoice.currency,
            },
            project: invoice.project
              ? { name: invoice.project.name, code: invoice.project.code, location: invoice.project.location, projectType: invoice.project.project_type, projectSubtype: invoice.project.project_subtype }
              : null,
            items: invoice.items.map((it) => ({
              description: it.description,
              section: it.section,
              unit: it.unit,
              quantity: it.quantity.toString(),
              unitRate: it.unit_rate.toString(),
              total: formatMoneyNumber(it.total_amount.toString()),
            })),
            totals: {
              subtotal: formatMoneyNumber(invoice.subtotal.toString()),
              taxPct: invoice.tax_pct.toString(),
              taxAmount: formatMoneyNumber(invoice.tax_amount.toString()),
              total: formatMoneyNumber(invoice.total.toString()),
              amountPaid: formatMoneyNumber(invoice.amount_paid.toString()),
              balanceDue: formatMoneyNumber(invoice.balance_due.toString()),
            },
            terms: invoice.terms,
            notes: invoice.notes,
            paybill: invoice.paybill,
            payments: invoice.payments.map((p) => ({
              amount: formatMoneyNumber(p.amount.toString()),
              method: p.method,
              reference: p.reference,
              paidAt: p.paid_at.toISOString().split('T')[0] ?? '',
            })),
          };

          return { pdfData, invoiceProjectId: invoice.project_id };
        });

        const buffer = await renderPdfToBufferLimited(React.createElement(InvoicePdf, { data: pdfData }));

        // Append-only audit log in its own short tx (I6).
        await withTenantTx(prisma, tenantId, (tx) => recordAuditLog(tx, {
          tenantId,
          projectId: invoiceProjectId,
          actorId: sub,
          action: 'INVOICE_PDF_GENERATED',
          entityType: 'Invoice',
          entityId: id,
          changes: { invoiceNo: pdfData.invoiceNo },
          ipAddress: request.ip,
          userAgent: (request.headers['user-agent'] as string) || null,
        }));

        const result = { buffer, invoiceNo: pdfData.invoiceNo };

        return reply
          .type('application/pdf')
          .header('Content-Disposition', `attachment; filename="${result.invoiceNo}.pdf"`)
          .send(result.buffer);
      } catch (rawErr) {
        const err = rawErr as RouteError;
        if (err?.status) { if (err.retryAfterSeconds) reply.header('Retry-After', String(err.retryAfterSeconds)); return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message }); }
        throw err;
      }
    },
  );
};
