import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { toDecimal, toCurrencyString, Decimal } from '@construction/money';
import {
  CreateSupplierSchema,
  CreatePurchaseOrderSchema,
  PoInvoiceReviewSchema,
} from '@construction/validation';
import { requirePermission } from '../plugins/rbac';
import { listParams, listPage } from '../lib/pagination';
import { notifyTeam } from '../lib/notify';
import { PRODUCT_NAME } from '../lib/product';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PO_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  ACCEPTED: 'Accepted by supplier',
  PART_DELIVERED: 'Part delivered',
  DELIVERED: 'Delivered',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

function poDto(po: any) {
  return {
    id: po.id,
    poNumber: po.po_number,
    supplierId: po.supplier_id,
    supplierName: po.supplier?.name ?? null,
    status: po.status,
    statusLabel: PO_STATUS_LABELS[po.status] || po.status,
    orderDate: po.order_date,
    expectedDeliveryDate: po.expected_delivery_date,
    totalAmount: po.total_amount_kes?.toString() ?? null,
    notes: po.notes,
    issuedAt: po.issued_at,
    items: (po.items || []).map((i: any) => ({
      id: i.id,
      description: i.description,
      unit: i.unit,
      quantity: i.quantity.toString(),
      rate: i.rate.toString(),
      lineTotal: toCurrencyString(toDecimal(i.quantity.toString()).times(toDecimal(i.rate.toString()))),
    })),
    invoices: (po.invoices || []).map((iv: any) => ({
      id: iv.id,
      reference: iv.reference,
      amount: iv.amount.toString(),
      status: iv.status,
      statusLabel: iv.status === 'REVIEW_REQUIRED' ? 'Over-invoice — awaiting PM review' : iv.status === 'ACCEPTED' ? 'Accepted' : iv.status === 'REJECTED' ? 'Rejected' : 'Submitted',
      note: iv.note,
      reviewReason: iv.review_reason,
      costEntryId: iv.cost_entry_id,
      createdAt: iv.created_at,
    })),
  };
}

/** Sum of delivered quantities per PO item (from linked diary deliveries). */
async function deliveredByItem(tx: any, poId: string) {
  const rows = await tx.materialDelivery.groupBy({
    by: ['purchase_order_item_id'],
    where: { purchase_order_id: poId, purchase_order_item_id: { not: null } },
    _sum: { quantity: true },
  });
  const map = new Map<string, Decimal>();
  for (const r of rows) {
    if (r.purchase_order_item_id) {
      map.set(r.purchase_order_item_id, toDecimal(r._sum.quantity?.toString() ?? '0'));
    }
  }
  return map;
}

export const procurementRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // =========================================================================
  // SUPPLIERS — tenant-level records that portal links and deliveries bind to
  // =========================================================================
  server.get(
    '/api/v1/suppliers',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const pg = listParams(request);
      const rows = await withTenantTx(prisma, tenantId, (tx) =>
        tx.supplier.findMany({ orderBy: { name: 'asc' }, skip: pg.skip, take: pg.limit + 1 }),
      );
      const paged = listPage(rows, pg);
      return reply.status(200).send({
        data: paged.data.map((s) => ({
          id: s.id, name: s.name, contactPerson: s.contact_person,
          phone: s.phone, email: s.email, isActive: s.is_active,
          createdAt: s.created_at,
        })),
        page: paged.page,
      });
    },
  );

  server.post(
    '/api/v1/suppliers',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = CreateSupplierSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid supplier payload', details: parsed.error.flatten() });
      }
      const d = parsed.data;
      const supplier = await withTenantTx(prisma, tenantId, async (tx) => {
        const created = await tx.supplier.create({
          data: {
            tenant_id: tenantId,
            name: d.name,
            contact_person: d.contactPerson || null,
            phone: d.phone || null,
            email: d.email || null,
          },
        });
        await recordAuditLog(tx, {
          tenantId, actorId: sub, action: 'SUPPLIER_CREATED',
          entityType: 'Supplier', entityId: created.id, changes: { name: d.name },
        });
        return created;
      });
      return reply.status(201).send({
        data: {
          id: supplier.id, name: supplier.name, contactPerson: supplier.contact_person,
          phone: supplier.phone, email: supplier.email, isActive: supplier.is_active,
        },
      });
    },
  );

  server.get(
    '/api/v1/suppliers/:supplierId',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { supplierId } = request.params as { supplierId: string };
      if (!UUID_REGEX.test(supplierId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Supplier not found' });
      }
      const supplier = await withTenantTx(prisma, tenantId, (tx) =>
        tx.supplier.findFirst({ where: { id: supplierId } }),
      );
      if (!supplier) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Supplier not found' });
      }
      return reply.status(200).send({
        data: {
          id: supplier.id, name: supplier.name, contactPerson: supplier.contact_person,
          phone: supplier.phone, email: supplier.email, isActive: supplier.is_active,
        },
      });
    },
  );

  // =========================================================================
  // PURCHASE ORDERS
  // =========================================================================
  server.get(
    '/api/v1/projects/:projectId/purchase-orders',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      const pg = listParams(request);
      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }
      const pos = await withTenantTx(prisma, tenantId, (tx) =>
        tx.purchaseOrder.findMany({
          where: { project_id: projectId },
          include: { items: true, invoices: true, supplier: { select: { id: true, name: true } } },
          orderBy: { created_at: 'desc' },
          skip: pg.skip,
          take: pg.limit + 1,
        }),
      );
      const paged = listPage(pos.map(poDto), pg);
      return reply.status(200).send({ data: paged.data, page: paged.page });
    },
  );

  server.post(
    '/api/v1/projects/:projectId/purchase-orders',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };
      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }
      const parsed = CreatePurchaseOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid purchase order payload', details: parsed.error.flatten() });
      }
      const d = parsed.data;

      try {
        const po = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId }, select: { id: true } });
          if (!project) throw { status: 404, message: 'Project not found' };
          // Resolve the supplier by id, or by name (created on first use so a
          // PO can be raised without a prior supplier onboarding step).
          let supplier: { id: string; name: string } | null = null;
          if (d.supplierId) {
            supplier = await tx.supplier.findFirst({ where: { id: d.supplierId, is_active: true }, select: { id: true, name: true } });
          } else if (d.supplierName) {
            const name = d.supplierName.trim();
            supplier = await tx.supplier.findFirst({
              where: { name: { equals: name, mode: 'insensitive' }, is_active: true },
              select: { id: true, name: true },
            });
            if (!supplier) {
              supplier = await tx.supplier.create({
                data: { tenant_id: tenantId, name, contact_person: 'Accounts' },
                select: { id: true, name: true },
              });
            }
          }
          if (!supplier) throw { status: 400, message: 'supplierId or supplierName is required' };

          const total = d.items.reduce(
            (acc, i) => acc.plus(toDecimal(i.quantity).times(toDecimal(i.rate ?? i.unitRate ?? 0))),
            toDecimal('0'),
          );

          const year = new Date().getFullYear();
          const count = await tx.purchaseOrder.count({ where: { project_id: projectId } });
          const poNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`;

          const created = await tx.purchaseOrder.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              po_number: poNumber,
              supplier_id: supplier.id,
              status: 'DRAFT',
              order_date: d.orderDate ? new Date(`${d.orderDate}T00:00:00Z`) : new Date(),
              expected_delivery_date: d.expectedDeliveryDate ? new Date(`${d.expectedDeliveryDate}T00:00:00Z`) : null,
              notes: d.notes || null,
              total_amount_kes: total.toFixed(2),
              created_by_id: sub,
              items: {
                create: d.items.map((i) => ({
                  tenant_id: tenantId,
                  description: i.description,
                  unit: i.unit,
                  quantity: i.quantity,
                  rate: i.rate ?? i.unitRate ?? 0,
                })),
              },
            },
            include: { items: true, invoices: true, supplier: { select: { id: true, name: true } } },
          });

          await recordAuditLog(tx, {
            tenantId, projectId, actorId: sub, action: 'PURCHASE_ORDER_CREATED',
            entityType: 'PurchaseOrder', entityId: created.id,
            changes: { poNumber, supplierId: supplier.id, total: total.toFixed(2), items: d.items.length },
          });
          return created;
        });
        return reply.status(201).send({ data: poDto(po) });
      } catch (err: any) {
        if (err?.status) {
          return reply.status(err.status).send({ statusCode: err.status, error: err.status === 404 ? 'Not Found' : 'Bad Request', message: err.message });
        }
        throw err;
      }
    },
  );

  server.get(
    '/api/v1/projects/:projectId/purchase-orders/:poId',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, poId } = request.params as { projectId: string; poId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(poId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Purchase order not found' });
      }
      const po = await withTenantTx(prisma, tenantId, (tx) =>
        tx.purchaseOrder.findFirst({
          where: { id: poId, project_id: projectId },
          include: { items: true, invoices: true, supplier: { select: { id: true, name: true } } },
        }),
      );
      if (!po) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Purchase order not found' });
      }
      return reply.status(200).send({ data: poDto(po) });
    },
  );

  // DRAFT -> ISSUED: posts the procurement commitment to the cost ledger.
  server.post(
    '/api/v1/projects/:projectId/purchase-orders/:poId/issue',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_APPROVE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, poId } = request.params as { projectId: string; poId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(poId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Purchase order not found' });
      }
      try {
        const po = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.purchaseOrder.findFirst({
            where: { id: poId, project_id: projectId },
            include: { items: true, supplier: true },
          });
          if (!existing) throw { status: 404, message: 'Purchase order not found' };
          if (existing.status !== 'DRAFT') {
            throw { status: 409, message: `Only DRAFT purchase orders can be issued (current: ${existing.status})` };
          }

          // Commitment record for the supplier spend.
          const latest = await tx.commitment.findFirst({
            where: { project_id: projectId },
            orderBy: { commitment_no: 'desc' },
            select: { commitment_no: true },
          });
          const commitment = await tx.commitment.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              commitment_no: (latest?.commitment_no ?? 0) + 1,
              vendor_name: existing.supplier.name,
              vendor_type: 'SUPPLIER',
              contract_value: existing.total_amount_kes.toString(),
              status: 'ACTIVE',
            },
          });

          // Cost-ledger entry: committed spend sits PENDING until invoices
          // are accepted — approved budget is never inflated by a PO alone.
          const costEntry = await tx.costEntry.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              commitment_id: commitment.id,
              cost_category: 'MATERIAL',
              amount: existing.total_amount_kes.toString(),
              vendor_name: existing.supplier.name,
              description: `PO ${existing.po_number} issued — ${existing.items.length} line(s), committed spend`,
              invoice_ref: existing.po_number,
              status: 'PENDING',
              created_by_id: sub,
            },
          });

          const updated = await tx.purchaseOrder.update({
            where: { id: existing.id },
            data: { status: 'ISSUED', issued_at: new Date(), commitment_id: commitment.id },
            include: { items: true, invoices: true, supplier: { select: { id: true, name: true } } },
          });

          await recordAuditLog(tx, {
            tenantId, projectId, actorId: sub, action: 'PURCHASE_ORDER_ISSUED',
            entityType: 'PurchaseOrder', entityId: existing.id,
            changes: { poNumber: existing.po_number, commitmentId: commitment.id, costEntryId: costEntry.id, total: existing.total_amount_kes.toString() },
          });
          await notifyTeam(tx, {
            tenantId, projectId, senderId: sub, senderName: PRODUCT_NAME,
            body: `PO ${existing.po_number} issued to ${existing.supplier.name} — committed ${toCurrencyString(toDecimal(existing.total_amount_kes.toString()))}. Awaiting supplier acceptance.`,
          });
          return updated;
        });
        return reply.status(200).send({ data: poDto(po) });
      } catch (err: any) {
        const st = err?.status ?? 400;
        return reply.status(st).send({ statusCode: st, error: st === 404 ? 'Not Found' : 'Conflict', message: err?.message || 'Issue failed' });
      }
    },
  );

  // Three-way match: ordered vs delivered vs invoiced per line + PO status.
  server.get(
    '/api/v1/projects/:projectId/purchase-orders/:poId/match',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, poId } = request.params as { projectId: string; poId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(poId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Purchase order not found' });
      }
      const result = await withTenantTx(prisma, tenantId, async (tx) => {
        const po = await tx.purchaseOrder.findFirst({
          where: { id: poId, project_id: projectId },
          include: { items: true, invoices: true },
        });
        if (!po) return null;

        const delivered = await deliveredByItem(tx, po.id);
        const liveInvoices = po.invoices.filter((i) => i.status !== 'REJECTED');
        const invoicedTotal = liveInvoices
          .reduce((acc, i) => acc.plus(toDecimal(i.amount.toString())), toDecimal('0'));
        const poTotal = toDecimal(po.total_amount_kes.toString());

        // Invoiced amounts allocated per line (invoices may be unallocated —
        // those surface as unallocatedInvoicedAmount at PO level).
        const invoicedByItem = new Map<string, ReturnType<typeof toDecimal>>();
        let unallocatedInvoiced = toDecimal('0');
        for (const inv of liveInvoices) {
          const amt = toDecimal(inv.amount.toString());
          const key = (inv as any).purchase_order_item_id as string | null;
          if (key && po.items.some((it) => it.id === key)) {
            invoicedByItem.set(key, (invoicedByItem.get(key) ?? toDecimal('0')).plus(amt));
          } else {
            unallocatedInvoiced = unallocatedInvoiced.plus(amt);
          }
        }

        let deliveredTotalDec = toDecimal('0');
        const lines = po.items.map((item) => {
          const orderedQty = toDecimal(item.quantity.toString());
          const rate = toDecimal(item.rate.toString());
          const deliveredQty = delivered.get(item.id) ?? toDecimal('0');
          deliveredTotalDec = deliveredTotalDec.plus(deliveredQty.times(rate));
          const lineInvoicedAmount = invoicedByItem.get(item.id) ?? toDecimal('0');
          const lineInvoicedQty = rate.gt(0) ? lineInvoicedAmount.div(rate) : toDecimal('0');
          const fullyDelivered = deliveredQty.gte(orderedQty);
          const lineStatus = deliveredQty.lte(0) ? 'PENDING_DELIVERY' : fullyDelivered ? 'DELIVERED' : 'PART_DELIVERED';
          return {
            itemId: item.id,
            description: item.description,
            unit: item.unit,
            orderedQuantity: orderedQty.toString(),
            deliveredQuantity: deliveredQty.toString(),
            invoicedQuantity: lineInvoicedQty.toFixed(4),
            orderedAmount: toCurrencyString(orderedQty.times(rate)),
            deliveredAmount: toCurrencyString(deliveredQty.times(rate)),
            invoicedAmount: toCurrencyString(lineInvoicedAmount),
            status: lineStatus,
          };
        });

        // Contract statuses: MATCHED | PARTIALLY_DELIVERED | OVER_INVOICED |
        // MISMATCH. Billed-for-more-than-delivered is OVER_INVOICED even when
        // the invoice total is within the PO total (auditor stage-3 contract).
        const allDelivered = lines.every((l) => l.status === 'DELIVERED');
        const someDelivered = lines.some((l) => l.deliveredQuantity !== '0');
        const lineOverInvoiced = lines.some((l) => {
          const invQty = toDecimal(l.invoicedQuantity);
          const delQty = toDecimal(l.deliveredQuantity);
          return invQty.gt(delQty.plus('0.0001'));
        });
        let status: string;
        if (invoicedTotal.gt(poTotal) || invoicedTotal.gt(deliveredTotalDec) || lineOverInvoiced) {
          status = 'OVER_INVOICED';
        } else if (allDelivered && invoicedTotal.gt(0)) {
          status = 'MATCHED';
        } else if (someDelivered || (invoicedTotal.gt(0) && !allDelivered)) {
          status = 'PARTIALLY_DELIVERED';
        } else {
          status = 'MISMATCH';
        }

        const totalOrderedQty = po.items.reduce((a, i) => a.plus(toDecimal(i.quantity.toString())), toDecimal('0'));
        const totalDeliveredQty = po.items.reduce((a, i) => a.plus(delivered.get(i.id) ?? toDecimal('0')), toDecimal('0'));

        return {
          purchaseOrderId: po.id,
          poNumber: po.po_number,
          status,
          // Aggregate views (auditor contract reads ordered/delivered/invoiced).
          ordered: { quantity: totalOrderedQty.toString(), amount: toCurrencyString(poTotal) },
          delivered: { quantity: totalDeliveredQty.toString(), amount: toCurrencyString(deliveredTotalDec) },
          invoiced: { amount: invoicedTotal.toString(), quantity: invoicedTotal.toString() },
          poStatus: po.status,
          orderedTotal: toCurrencyString(poTotal),
          deliveredTotal: toCurrencyString(deliveredTotalDec),
          invoicedTotal: toCurrencyString(invoicedTotal),
          unallocatedInvoicedAmount: toCurrencyString(unallocatedInvoiced),
          lines,
          invoices: po.invoices.map((i) => ({
            id: i.id, reference: i.reference, amount: i.amount.toString(), status: i.status,
          })),
        };
      });
      if (!result) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Purchase order not found' });
      }
      return reply.status(200).send({ data: result });
    },
  );

  // PM review of a supplier invoice — the ONLY path that posts actuals.
  server.post(
    '/api/v1/projects/:projectId/purchase-orders/:poId/invoices/:invoiceId/review',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_APPROVE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, poId, invoiceId } = request.params as { projectId: string; poId: string; invoiceId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(poId) || !UUID_REGEX.test(invoiceId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invoice not found' });
      }
      const parsed = PoInvoiceReviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid review payload', details: parsed.error.flatten() });
      }
      const d = parsed.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const po = await tx.purchaseOrder.findFirst({
            where: { id: poId, project_id: projectId },
            include: { items: true, invoices: true, supplier: true },
          });
          if (!po) throw { status: 404, message: 'Purchase order not found' };
          const invoice = po.invoices.find((i: any) => i.id === invoiceId);
          if (!invoice) throw { status: 404, message: 'Supplier invoice not found' };
          if (!['SUBMITTED', 'REVIEW_REQUIRED'].includes(invoice.status)) {
            throw { status: 409, message: `Invoice already ${invoice.status.toLowerCase()}` };
          }

          // Over-invoice guard: accepting beyond the PO total requires an
          // explicit override — cost posting is blocked until this review.
          const amount = toDecimal(invoice.amount.toString());
          const poTotal = toDecimal(po.total_amount_kes.toString());
          const otherAccepted = po.invoices
            .filter((i) => i.id !== invoice.id && i.status === 'ACCEPTED')
            .reduce((acc, i) => acc.plus(toDecimal(i.amount.toString())), toDecimal('0'));
          const isOver = otherAccepted.plus(amount).gt(poTotal);
          if (isOver && !d.approveOverInvoice) {
            throw { status: 409, code: 'OVER_INVOICED', message: 'Invoice exceeds the PO total — approveOverInvoice with a reason is required' };
          }
          if (isOver && !d.reason?.trim()) {
            throw { status: 400, message: 'A review reason is required to approve an over-invoice' };
          }

          let costEntryId: string | null = null;
          if (d.action === 'ACCEPT') {
            // Actuals post here — APPROVED cost entry against the PO commitment.
            const commitment = po.commitment_id
              ? await tx.commitment.findFirst({ where: { id: po.commitment_id } })
              : await tx.commitment.findFirst({
                  where: { project_id: projectId, vendor_name: po.supplier.name, vendor_type: 'SUPPLIER', status: 'ACTIVE' },
                });
            const entry = await tx.costEntry.create({
              data: {
                tenant_id: tenantId,
                project_id: projectId,
                commitment_id: commitment?.id ?? null,
                cost_category: 'MATERIAL',
                amount: amount.toFixed(2),
                vendor_name: po.supplier.name,
                description: `Supplier invoice ${invoice.reference} against PO ${po.po_number}`,
                invoice_ref: invoice.reference,
                status: 'APPROVED',
                created_by_id: sub,
              },
            });
            costEntryId = entry.id;
          }

          const updated = await tx.purchaseOrderInvoice.update({
            where: { id: invoice.id },
            data: {
              status: d.action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
              reviewed_by_id: sub,
              reviewed_at: new Date(),
              review_reason: d.reason || null,
              cost_entry_id: costEntryId,
            },
          });

          // Refresh PO status from delivery/invoice state.
          const delivered = await deliveredByItem(tx, po.id);
          const allDelivered = po.items.every((i) => (delivered.get(i.id) ?? toDecimal('0')).gte(toDecimal(i.quantity.toString())));
          const anyDelivered = [...delivered.values()].some((q) => q.gt(0));
          const hasOpenInvoice = po.invoices.some((i) => i.id !== invoice.id && ['SUBMITTED', 'REVIEW_REQUIRED'].includes(i.status));
          let newPoStatus = po.status;
          if (po.status !== 'DRAFT' && po.status !== 'CANCELLED' && po.status !== 'CLOSED') {
            if (allDelivered) newPoStatus = hasOpenInvoice ? 'PART_DELIVERED' : 'DELIVERED';
            else if (anyDelivered) newPoStatus = 'PART_DELIVERED';
            else if (['ISSUED', 'ACCEPTED'].includes(po.status)) newPoStatus = po.status;
          }
          if (newPoStatus !== po.status) {
            await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: newPoStatus } });
          }

          await recordAuditLog(tx, {
            tenantId, projectId, actorId: sub,
            action: `PO_INVOICE_${d.action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED'}`,
            entityType: 'PurchaseOrderInvoice', entityId: invoice.id,
            changes: { poId: po.id, poNumber: po.po_number, reference: invoice.reference, amount: invoice.amount.toString(), overInvoice: isOver, costEntryId },
          });
          if (isOver) {
            await notifyTeam(tx, {
              tenantId, projectId, senderId: sub, senderName: PRODUCT_NAME,
              body: `Over-invoice on PO ${po.po_number} (${invoice.reference}) reviewed by PM — ${d.action === 'ACCEPT' ? 'approved with override' : 'rejected'}.`,
            });
          }
          return updated;
        });
        return reply.status(200).send({ data: result });
      } catch (err: any) {
        const st = err?.status ?? 400;
        return reply.status(st).send({ statusCode: st, error: st === 404 ? 'Not Found' : 'Conflict', code: err?.code, message: err?.message || 'Review failed' });
      }
    },
  );
};
