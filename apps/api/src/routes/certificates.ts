import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import type { Prisma } from '@construction/db';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions, hasPermission, Role } from '@construction/permissions';
import { toDecimal, toCurrencyString, Decimal } from '@construction/money';
import {
  CreatePaymentCertificateSchema,
  UpdatePaymentCertificateSchema,
  PaymentCertificateActionSchema,
  CreateInvoiceFromCertificateSchema,
  CloseoutTransitionSchema,
  PaymentCertificateLineInput,
} from '@construction/validation';
import { requirePermission, requireAnyPermission } from '../plugins/rbac';
import { listParams, listPage } from '../lib/pagination';
import { evaluateSelfApproval } from '../plugins/makerChecker';
import { nextDocumentNumber } from '../lib/counters';
import { getTaxSettings } from '../lib/tax';
import { notifyTeam } from '../lib/notify';
import type { RouteError } from '../types/errors';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ADR-008 / Gate-4 S4: interim payment certificates (IPC) and the project
 * closeout stage machine. All money math uses @construction/money Decimal.
 */

const CLOSEOUT_ORDER = ['IN_PROGRESS', 'HANDED_OVER', 'DEFECTS_LIABILITY', 'DEFECTS_EXPIRED', 'CLOSED'] as const;
type CloseoutStage = (typeof CLOSEOUT_ORDER)[number];

const NEXT_STAGE: Record<CloseoutStage, CloseoutStage | null> = {
  IN_PROGRESS: 'HANDED_OVER',
  HANDED_OVER: 'DEFECTS_LIABILITY',
  DEFECTS_LIABILITY: 'DEFECTS_EXPIRED',
  DEFECTS_EXPIRED: 'CLOSED',
  CLOSED: null,
};

type CertRecord = {
  period_start?: Date | null; period_end?: Date | null;
  this_period_amount?: { toString(): string } | null;
  previous_certified?: { toString(): string } | null;
  cumulative_certified?: { toString(): string } | null;
  retention_pct?: { toString(): string } | null;
  retention_deduction?: { toString(): string } | null;
  retention_held?: { toString(): string } | null;
  retention_released?: { toString(): string } | null;
  advance_recovery?: { toString(): string } | null;
  amount_due_previous?: { toString(): string } | null;
  net_payable?: { toString(): string } | null;
  invoice_id?: string | null; vat_pct?: { toString(): string } | null;
  vat_amount?: { toString(): string } | null; wht_pct?: { toString(): string } | null;
  wht_amount?: { toString(): string } | null; submitted_at?: Date | null; certified_at?: Date | null; paid_at?: Date | null;
  [key: string]: unknown;
};

function formatCert(c: CertRecord | null | undefined) {
  if (!c) return null;
  return {
    ...c,
    period_start: c.period_start ? c.period_start.toISOString().slice(0, 10) : null,
    period_end: c.period_end ? c.period_end.toISOString().slice(0, 10) : null,
    this_period_amount: toCurrencyString(c.this_period_amount?.toString() ?? '0'),
    previous_certified: toCurrencyString(c.previous_certified?.toString() ?? '0'),
    cumulative_certified: toCurrencyString(c.cumulative_certified?.toString() ?? '0'),
    retention_pct: c.retention_pct?.toString() ?? '5.00',
    retention_deduction: toCurrencyString(c.retention_deduction?.toString() ?? '0'),
    retention_held: toCurrencyString(c.retention_held?.toString() ?? '0'),
    retention_released: toCurrencyString(c.retention_released?.toString() ?? '0'),
    advance_recovery: toCurrencyString(c.advance_recovery?.toString() ?? '0'),
    amount_due_previous: toCurrencyString(c.amount_due_previous?.toString() ?? '0'),
    net_payable: toCurrencyString(c.net_payable?.toString() ?? '0'),
    invoice_id: c.invoice_id ?? null,
    vat_pct: c.vat_pct?.toString() ?? '0.00',
    vat_amount: toCurrencyString(c.vat_amount?.toString() ?? '0'),
    wht_pct: c.wht_pct?.toString() ?? '0.00',
    wht_amount: toCurrencyString(c.wht_amount?.toString() ?? '0'),
    submitted_at: c.submitted_at?.toISOString() ?? null,
    certified_at: c.certified_at?.toISOString() ?? null,
    paid_at: c.paid_at?.toISOString() ?? null,
  };
}

/** Contract-sum baseline for the 5% JBC retention cap (mirrors lifecycle.ts). */
async function resolveContractSum(tx: Prisma.TransactionClient, project: { id: string; [key: string]: unknown }): Promise<Decimal> {
  const activeBoq = await tx.bOQ.findFirst({
    where: { project_id: project.id, status: { in: ['ACTIVE', 'APPROVED'] } },
    orderBy: { version: 'desc' },
  });
  const boqTotal = activeBoq ? toDecimal(activeBoq.total_amount.toString()) : new Decimal(0);
  if (boqTotal.greaterThan(0)) return boqTotal;
  const original = toDecimal(project.original_contract_sum?.toString() ?? '0');
  if (original.greaterThan(0)) return original;
  return toDecimal(project.current_approved_budget?.toString() ?? '0');
}

/** Certified (payable-decision) total = sum of this_period over CERTIFIED+PAID certs. */
async function certifiedTotal(tx: Prisma.TransactionClient, projectId: string): Promise<Decimal> {
  const agg = await tx.paymentCertificate.aggregate({
    where: { project_id: projectId, status: { in: ['CERTIFIED', 'PAID'] } },
    _sum: { this_period_amount: true },
  });
  return toDecimal(agg._sum.this_period_amount?.toString() ?? '0');
}

async function latestRetentionHeld(tx: Prisma.TransactionClient, projectId: string): Promise<Decimal> {
  const last = await tx.paymentCertificate.findFirst({
    where: { project_id: projectId, status: { in: ['CERTIFIED', 'PAID', 'SUBMITTED', 'UNDER_REVIEW'] } },
    orderBy: { certificate_no: 'desc' },
    select: { retention_held: true },
  });
  return last ? toDecimal(last.retention_held.toString()) : new Decimal(0);
}

interface CertMathInput {
  retentionPct?: string | null;
  retentionReleased?: string | null;
  advanceRecovery?: string | null;
  amountDuePrevious?: string | null;
}

/** Shared JBC retention/net-payable math used by create, patch and preview. */
async function computeCertMath(
  tx: Prisma.TransactionClient,
  project: { id: string; [key: string]: unknown },
  projectId: string,
  thisPeriod: Decimal,
  opts: CertMathInput,
) {
  const previousCertified = await certifiedTotal(tx, projectId);
  const cumulative = previousCertified.plus(thisPeriod);

  const contractSum = await resolveContractSum(tx, project);
  const retentionCap = contractSum.times(5).dividedBy(100);
  const pct = toDecimal(opts.retentionPct ?? '5').dividedBy(100);
  const prevHeld = await latestRetentionHeld(tx, projectId);
  const desiredDeduction = thisPeriod.times(pct);
  const room = Decimal.max(new Decimal(0), retentionCap.minus(prevHeld));
  const retentionDeduction = Decimal.min(desiredDeduction, room).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const released = toDecimal(opts.retentionReleased ?? '0');
  const retentionHeld = Decimal.max(
    new Decimal(0),
    prevHeld.plus(retentionDeduction).minus(released),
  ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const advanceRecovery = toDecimal(opts.advanceRecovery ?? '0');
  const amountDuePrevious = toDecimal(opts.amountDuePrevious ?? '0');
  const netPayable = thisPeriod
    .minus(retentionDeduction)
    .minus(advanceRecovery)
    .plus(amountDuePrevious)
    .plus(released)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return { previousCertified, cumulative, retentionDeduction, retentionHeld, advanceRecovery, amountDuePrevious, netPayable, pct };
}

/** Derive certificate lines + this-period amount from real BoQ progress:
 * per BOQ item, latest completion% x (qty x rate) minus amount already
 * certified on prior CERTIFIED/PAID certificates. */
async function deriveProgressCertificate(tx: Prisma.TransactionClient, tenantId: string, projectId: string) {
  const activeBoq = await tx.bOQ.findFirst({
    where: { project_id: projectId, status: { in: ['ACTIVE', 'APPROVED'] } },
    orderBy: { version: 'desc' },
    include: { sections: { include: { items: true } } },
  });
  if (!activeBoq) return { lines: [] as PaymentCertificateLineInput[], thisPeriodAmount: '0.00', previousCertified: '0.00' };

  const items = (activeBoq.sections as Array<{ items: Array<{ id: string; description: string; unit: string | null; quantity: { toString(): string }; unit_rate: { toString(): string } }> }>).flatMap((sec) => sec.items);

  // Latest cumulative progress per BOQ item
  const progressRows = await tx.progressItem.findMany({
    where: { tenant_id: tenantId, boq_item_id: { in: items.map((i) => i.id) } },
    include: { progress_record: { select: { record_date: true } } },
    orderBy: { progress_record: { record_date: 'desc' } },
  });
  const latestPct = new Map<string, { pct: Decimal; qty: Decimal }>();
  for (const row of progressRows) {
    if (latestPct.has(row.boq_item_id)) continue; // first = latest by date desc
    latestPct.set(row.boq_item_id, {
      pct: toDecimal(row.completion_pct.toString()),
      qty: toDecimal(row.completed_quantity.toString()),
    });
  }

  // Previously certified amount per BOQ item (CERTIFIED/PAID certs only)
  const priorLines = await tx.paymentCertificateLine.findMany({
    where: {
      tenant_id: tenantId,
      certificate: { project_id: projectId, status: { in: ['CERTIFIED', 'PAID'] } },
      boq_item_id: { not: null },
    },
    select: { boq_item_id: true, amount: true },
  });
  const priorByItem = new Map<string, Decimal>();
  for (const l of priorLines) {
    const key = l.boq_item_id as string;
    priorByItem.set(key, (priorByItem.get(key) ?? new Decimal(0)).plus(toDecimal(l.amount.toString())));
  }

  const lines: PaymentCertificateLineInput[] = [];
  let total = new Decimal(0);
  for (const item of items) {
    const prog = latestPct.get(item.id);
    if (!prog || prog.pct.lte(0)) continue;
    const itemValue = toDecimal(item.quantity.toString()).times(toDecimal(item.unit_rate.toString()));
    const earned = itemValue.times(prog.pct);
    const prior = priorByItem.get(item.id) ?? new Decimal(0);
    const thisPeriod = earned.minus(prior);
    if (thisPeriod.lte(new Decimal('0.005'))) continue;
    const rounded = thisPeriod.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    total = total.plus(rounded);
    lines.push({
      boqItemId: item.id,
      description: item.description,
      unit: item.unit,
      progressPct: prog.pct.toFixed(4),
      unitRate: item.unit_rate.toString(),
      amount: rounded.toFixed(2),
    });
  }

  const previousCertified = await certifiedTotal(tx, projectId);
  return {
    lines,
    thisPeriodAmount: total.toFixed(2),
    previousCertified: previousCertified.toFixed(2),
  };
}

/** VAT + client-side WHT for a certificate amount, from tenant tax settings.
 * The taxable base is the current-period net of retention — the amount that
 * is actually invoiced to the client. */
async function computeCertTax(tx: Prisma.TransactionClient, tenantId: string, taxableBase: Decimal) {
  const tax = await getTaxSettings(tx, tenantId);
  const vatAmount = taxableBase.times(tax.vatPct).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const whtBase = taxableBase.plus(vatAmount);
  const whtAmount = whtBase.times(tax.whtContractorPct).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return { vatPct: tax.vatPct, vatAmount, whtPct: tax.whtContractorPct, whtAmount };
}

export const certificatesRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // =========================================================================
  // PAYMENT CERTIFICATES (IPC)
  // =========================================================================

  server.get(
    '/api/v1/projects/:projectId/payment-certificates',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      const pg = listParams(request);
      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }
      try {
        const certs = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };
          const rows = await tx.paymentCertificate.findMany({
            where: { project_id: projectId },
            orderBy: { certificate_no: 'asc' },
            skip: pg.skip,
            take: pg.limit + 1,
          });
          return rows.map(formatCert);
        });
        const paged = listPage(certs, pg);
        return reply.status(200).send({ data: paged.data, page: paged.page, count: paged.data.length });
      } catch (rawErr) {
        const err = rawErr as RouteError;
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list payment certificates' });
      }
    },
  );

  // GET .../payment-certificates/preview — certificate built from real progress:
  // per BOQ item, cumulative completion% x (qty x rate) minus amount already
  // certified on prior CERTIFIED/PAID certificates. Reviewers may edit amounts
  // before creating the DRAFT certificate.
  server.get(
    '/api/v1/projects/:projectId/payment-certificates/preview',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }
      try {
        const preview = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };
          return deriveProgressCertificate(tx, tenantId, projectId);
        });
        return reply.status(200).send({ data: preview });
      } catch (rawErr) {
        const err = rawErr as RouteError;
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to build certificate preview' });
      }
    },
  );

  server.post(
    '/api/v1/projects/:projectId/payment-certificates',
    { preHandler: [server.authenticate, requirePermission(Permissions.CERTIFICATE_MANAGE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };
      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }
      const parsed = CreatePaymentCertificateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid payment certificate payload', details: parsed.error.errors });
      }
      const data = parsed.data;
      if (data.periodEnd < data.periodStart) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'periodEnd must be on or after periodStart' });
      }

      try {
        const cert = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const certificateNo = await nextDocumentNumber(tx, tenantId, `CERT:${projectId}`);

          // Editable review: explicit lines win; thisPeriodAmount may override.
          // When neither is supplied the amount is DERIVED from real BoQ
          // progress (completion% x qty x rate minus previously certified).
          let lineInputs = data.lines ?? null;
          let thisPeriod: Decimal;
          if (lineInputs) {
            thisPeriod = lineInputs.reduce((acc: Decimal, l) => acc.plus(toDecimal(l.amount)), new Decimal(0)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          } else if (data.thisPeriodAmount != null) {
            thisPeriod = toDecimal(data.thisPeriodAmount);
          } else {
            const derived = await deriveProgressCertificate(tx, tenantId, projectId);
            thisPeriod = toDecimal(derived.thisPeriodAmount);
            lineInputs = derived.lines.length > 0 ? derived.lines : null;
          }
          if (data.lines && data.thisPeriodAmount != null) {
            const explicit = toDecimal(data.thisPeriodAmount);
            if (!explicit.equals(thisPeriod)) {
              throw { status: 400, message: 'thisPeriodAmount must equal the sum of line amounts' };
            }
          }

          const math = await computeCertMath(tx, project, projectId, thisPeriod, data);
          // VAT/WHT apply to the amount actually invoiced: this period net of
          // the retention deduction.
          const taxableBase = thisPeriod.minus(math.retentionDeduction);
          const tax = await computeCertTax(tx, tenantId, taxableBase);

          const created = await tx.paymentCertificate.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              certificate_no: certificateNo,
              period_start: new Date(`${data.periodStart}T00:00:00.000Z`),
              period_end: new Date(`${data.periodEnd}T00:00:00.000Z`),
              this_period_amount: thisPeriod.toFixed(2),
              previous_certified: math.previousCertified.toFixed(2),
              cumulative_certified: math.cumulative.toFixed(2),
              retention_pct: math.pct.times(100).toDecimalPlaces(2).toFixed(2),
              retention_deduction: math.retentionDeduction.toFixed(2),
              retention_held: math.retentionHeld.toFixed(2),
              retention_released: toDecimal(data.retentionReleased ?? '0').toFixed(2),
              advance_recovery: math.advanceRecovery.toFixed(2),
              amount_due_previous: math.amountDuePrevious.toFixed(2),
              net_payable: math.netPayable.toFixed(2),
              vat_pct: tax.vatPct.toFixed(2),
              vat_amount: tax.vatAmount.toFixed(2),
              wht_pct: tax.whtPct.toFixed(2),
              wht_amount: tax.whtAmount.toFixed(2),
              submitted_by_id: sub,
              notes: data.notes ?? null,
              lines: lineInputs
                ? {
                    create: lineInputs.map((l, idx: number) => ({
                      tenant_id: tenantId,
                      boq_item_id: l.boqItemId ?? null,
                      description: l.description,
                      unit: l.unit ?? null,
                      progress_pct: l.progressPct ?? null,
                      unit_rate: l.unitRate ?? null,
                      amount: toDecimal(l.amount).toFixed(2),
                      sort_order: idx,
                    })),
                  }
                : undefined,
            },
            include: { lines: { orderBy: { sort_order: 'asc' } } },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'PAYMENT_CERTIFICATE_CREATED',
            entityType: 'PaymentCertificate',
            entityId: created.id,
            changes: {
              certificateNo,
              thisPeriod: thisPeriod.toFixed(2),
              cumulative: math.cumulative.toFixed(2),
              retentionHeld: math.retentionHeld.toFixed(2),
              netPayable: math.netPayable.toFixed(2),
            },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          return formatCert(created);
        });

        return reply.status(201).send({ message: 'Payment certificate drafted', data: cert });
      } catch (rawErr) {
        const err = rawErr as RouteError;
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create payment certificate' });
      }
    },
  );

  // PATCH .../payment-certificates/:certId — editable review while DRAFT
  server.patch(
    '/api/v1/projects/:projectId/payment-certificates/:certId',
    { preHandler: [server.authenticate, requirePermission(Permissions.CERTIFICATE_MANAGE)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, certId } = request.params as { projectId: string; certId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(certId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Payment certificate not found' });
      }
      const parsed = UpdatePaymentCertificateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid certificate update', details: parsed.error.errors });
      }
      const data = parsed.data;

      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const cert = await tx.paymentCertificate.findFirst({ where: { id: certId, project_id: projectId } });
          if (!cert) throw { status: 404, message: 'Payment certificate not found' };
          if (cert.status !== 'DRAFT') {
            throw { status: 409, message: `Only DRAFT certificates can be edited (current: ${cert.status})` };
          }
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const lineInputs = data.lines ?? null;
          const thisPeriod = lineInputs
            ? lineInputs.reduce((acc: Decimal, l) => acc.plus(toDecimal(l.amount)), new Decimal(0)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
            : data.thisPeriodAmount != null
              ? toDecimal(data.thisPeriodAmount)
              : toDecimal(cert.this_period_amount.toString());

          const math = await computeCertMath(tx, project, projectId, thisPeriod, {
            retentionPct: data.retentionPct ?? cert.retention_pct.toString(),
            retentionReleased: data.retentionReleased,
            advanceRecovery: data.advanceRecovery,
            amountDuePrevious: data.amountDuePrevious,
          });
          const tax = await computeCertTax(tx, tenantId, thisPeriod.minus(math.retentionDeduction));

          if (lineInputs) {
            await tx.paymentCertificateLine.deleteMany({ where: { certificate_id: certId } });
            await tx.paymentCertificateLine.createMany({
              data: lineInputs.map((l, idx: number) => ({
                tenant_id: tenantId,
                certificate_id: certId,
                boq_item_id: l.boqItemId ?? null,
                description: l.description,
                unit: l.unit ?? null,
                progress_pct: l.progressPct ?? null,
                unit_rate: l.unitRate ?? null,
                amount: toDecimal(l.amount).toFixed(2),
                sort_order: idx,
              })),
            });
          }

          const row = await tx.paymentCertificate.update({
            where: { id: certId },
            data: {
              this_period_amount: thisPeriod.toFixed(2),
              previous_certified: math.previousCertified.toFixed(2),
              cumulative_certified: math.cumulative.toFixed(2),
              retention_pct: math.pct.times(100).toDecimalPlaces(2).toFixed(2),
              retention_deduction: math.retentionDeduction.toFixed(2),
              retention_held: math.retentionHeld.toFixed(2),
              retention_released: toDecimal(data.retentionReleased ?? cert.retention_released.toString()).toFixed(2),
              advance_recovery: math.advanceRecovery.toFixed(2),
              amount_due_previous: math.amountDuePrevious.toFixed(2),
              net_payable: math.netPayable.toFixed(2),
              vat_pct: tax.vatPct.toFixed(2),
              vat_amount: tax.vatAmount.toFixed(2),
              wht_pct: tax.whtPct.toFixed(2),
              wht_amount: tax.whtAmount.toFixed(2),
              notes: data.notes ?? cert.notes,
            },
            include: { lines: { orderBy: { sort_order: 'asc' } } },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: request.user.sub,
            action: 'PAYMENT_CERTIFICATE_UPDATED',
            entityType: 'PaymentCertificate',
            entityId: certId,
            changes: { thisPeriod: thisPeriod.toFixed(2), lines: lineInputs?.length ?? null },
          });
          return formatCert(row);
        });
        return reply.status(200).send({ message: 'Certificate updated', data: updated });
      } catch (rawErr) {
        const err = rawErr as RouteError;
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: err.status === 404 ? 'Not Found' : 'Bad Request', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update certificate' });
      }
    },
  );

  // POST .../payment-certificates/:certId/create-invoice — issue a client
  // invoice from a CERTIFIED certificate. Links both ways; VAT + WHT lines.
  const createInvoiceFromCertificate = async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId, sub } = request.user;
      const { projectId, certId } = request.params as { projectId: string; certId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(certId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Payment certificate not found' });
      }
      const parsed = CreateInvoiceFromCertificateSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid invoice payload', details: parsed.error.errors });
      }
      const data = parsed.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const cert = await tx.paymentCertificate.findFirst({
            where: { id: certId, project_id: projectId },
            include: { lines: { orderBy: { sort_order: 'asc' } } },
          });
          if (!cert) throw { status: 404, message: 'Payment certificate not found' };
          if (cert.status !== 'CERTIFIED') {
            throw { status: 409, message: `Only CERTIFIED certificates can be invoiced (current: ${cert.status})` };
          }
          if (cert.invoice_id) {
            const existing = await tx.invoice.findUnique({ where: { id: cert.invoice_id } });
            if (existing) return { invoice: existing, alreadyExisted: true };
          }

          const project = await tx.project.findFirst({ where: { id: projectId } });
          const gross = toDecimal(cert.this_period_amount.toString());
          const retentionDeduction = toDecimal(cert.retention_deduction.toString());
          // The invoice bills the net amount certified for payment this period
          // (gross less retention). VAT/WHT were computed on the same base.
          const subtotal = gross.minus(retentionDeduction);
          const vatAmount = toDecimal(cert.vat_amount.toString());
          const whtAmount = toDecimal(cert.wht_amount.toString());
          const vatPct = toDecimal(cert.vat_pct.toString());
          const whtPct = toDecimal(cert.wht_pct.toString());
          const total = subtotal.plus(vatAmount).minus(whtAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

          const clientName =
            data.clientName ??
            (await tx.quote.findFirst({
              where: { OR: [{ project_id: projectId }, { converted_project_id: projectId }], status: { in: ['ACCEPTED', 'CONVERTED'] } },
              orderBy: { created_at: 'desc' },
              select: { client_name: true },
            }))?.client_name ??
            project?.name ??
            'Client';

          const invoiceNo = await nextDocumentNumber(tx, tenantId, 'INVOICE');
          const issueDate = new Date();
          const dueDate = new Date(Date.now() + data.dueDays * 24 * 60 * 60 * 1000);

          const invoice = await tx.invoice.create({
            data: {
              tenant_id: tenantId,
              invoice_no: invoiceNo,
              title: `Payment Certificate IPC-${projectId.slice(0, 8)}-${cert.certificate_no} — ${project?.name ?? 'Project'}`,
              project_id: projectId,
              certificate_id: certId,
              client_name: clientName,
              client_email: data.clientEmail ?? null,
              client_phone: data.clientPhone ?? null,
              bill_to: data.billTo ?? null,
              po_number: data.poNumber ?? null,
              status: 'SENT',
              currency: 'KES',
              subtotal: subtotal.toFixed(2),
              tax_pct: vatPct.toFixed(2),
              tax_amount: vatAmount.toFixed(2),
              wht_pct: whtPct.toFixed(2),
              wht_amount: whtAmount.toFixed(2),
              total: total.toFixed(2),
              amount_paid: '0.00',
              balance_due: total.toFixed(2),
              issue_date: issueDate,
              due_date: dueDate,
              terms: data.terms ?? null,
              notes: data.notes ?? cert.notes,
              sent_at: issueDate,
              created_by: sub,
              items: {
                create: [
                  ...cert.lines.map((l, idx) => ({
                    tenant_id: tenantId,
                    section: `Certificate line ${idx + 1}`,
                    description: l.description,
                    unit: l.unit ?? 'item',
                    quantity: '1',
                    unit_rate: l.amount.toString(),
                    total_amount: l.amount.toString(),
                    sort_order: idx,
                  })),
                  ...(retentionDeduction.gt(0)
                    ? [{
                        tenant_id: tenantId,
                        section: 'Deductions',
                        description: `Retention held @ ${cert.retention_pct.toString()}% (released at Practical Completion)`,
                        unit: 'item',
                        quantity: '1',
                        unit_rate: retentionDeduction.negated().toFixed(2),
                        total_amount: retentionDeduction.negated().toFixed(2),
                        sort_order: 999,
                      }]
                    : []),
                  ...(vatAmount.gt(0)
                    ? [{
                        tenant_id: tenantId,
                        section: 'Tax',
                        description: `VAT @ ${vatPct.toFixed(2)}%`,
                        unit: 'item',
                        quantity: '1',
                        unit_rate: vatAmount.toFixed(2),
                        total_amount: vatAmount.toFixed(2),
                        sort_order: 1000,
                      }]
                    : []),
                  ...(whtAmount.gt(0)
                    ? [{
                        tenant_id: tenantId,
                        section: 'Tax',
                        description: `Withholding tax @ ${whtPct.toFixed(2)}% (deducted)`,
                        unit: 'item',
                        quantity: '1',
                        unit_rate: whtAmount.negated().toFixed(2),
                        total_amount: whtAmount.negated().toFixed(2),
                        sort_order: 1001,
                      }]
                    : []),
                ],
              },
            },
            include: { items: true, payments: true },
          });

          await tx.paymentCertificate.update({
            where: { id: certId },
            data: { invoice_id: invoice.id },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'INVOICE_CREATED_FROM_CERTIFICATE',
            entityType: 'Invoice',
            entityId: invoice.id,
            changes: { certificateId: certId, certificateNo: cert.certificate_no, total: total.toFixed(2) },
          });

          return { invoice, alreadyExisted: false };
        });

        const inv = result.invoice as unknown as { id?: string; invoice_no?: number | string; total?: unknown; [key: string]: unknown };
        return reply.status(result.alreadyExisted ? 200 : 201).send({
          message: result.alreadyExisted ? 'Invoice already exists for this certificate' : 'Invoice created from certificate',
          data: {
            invoice: {
              id: inv.id,
              invoiceNo: inv.invoice_no,
              invoice_no: inv.invoice_no,
              certificateId: inv.certificate_id,
              certificate_id: inv.certificate_id,
              status: inv.status,
              subtotal: inv.subtotal?.toString(),
              taxPct: inv.tax_pct?.toString(),
              tax_pct: inv.tax_pct?.toString(),
              taxAmount: inv.tax_amount?.toString(),
              tax_amount: inv.tax_amount?.toString(),
              whtPct: inv.wht_pct?.toString(),
              wht_pct: inv.wht_pct?.toString(),
              whtAmount: inv.wht_amount?.toString(),
              wht_amount: inv.wht_amount?.toString(),
              total: inv.total?.toString(),
              balanceDue: inv.balance_due?.toString(),
              balance_due: inv.balance_due?.toString(),
            },
          },
        });
      } catch (rawErr) {
        const err = rawErr as RouteError;
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: err.status === 404 ? 'Not Found' : 'Bad Request', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create invoice from certificate' });
      }
  };

  // POST .../payment-certificates/:certId/create-invoice — issue a client
  // invoice from a CERTIFIED certificate. Links both ways; VAT + WHT lines.
  // /invoice is an alias of the same contract (auditor acceptance route name).
  for (const suffix of ['create-invoice', 'invoice']) {
    server.post(
      `/api/v1/projects/:projectId/payment-certificates/:certId/${suffix}`,
      { preHandler: [server.authenticate, requirePermission(Permissions.INVOICE_CREATE)] },
      createInvoiceFromCertificate,
    );
  }

  // POST /api/v1/projects/:projectId/payment-certificates/:certId/action
  server.post(
    '/api/v1/projects/:projectId/payment-certificates/:certId/action',
    {
      preHandler: [
        server.authenticate,
        // Baseline gate; the handler enforces the precise per-action permission
        // (CERTIFICATE_MANAGE for draft/submit/review, COST_APPROVE for certify/reject/paid).
        requireAnyPermission(Permissions.CERTIFICATE_MANAGE, Permissions.COST_APPROVE),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId, certId } = request.params as { projectId: string; certId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(certId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Payment certificate not found' });
      }

      const parsed = PaymentCertificateActionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid action payload', details: parsed.error.errors });
      }
      const { action, comments, paidReference, selfApprovalReason } = parsed.data;

      // Permission matrix: drafting (QS/PM) vs certification authority (COST_APPROVE)
      const needsApprove = action === 'CERTIFY' || action === 'REJECT' || action === 'MARK_PAID';
      const allowed = needsApprove
        ? hasPermission(role as Role, Permissions.COST_APPROVE)
        : hasPermission(role as Role, Permissions.CERTIFICATE_MANAGE);
      if (!allowed) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: `Role "${role}" lacks permission for ${action} on payment certificates`,
        });
      }

      // Allowed transitions
      const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
        SUBMIT: { from: ['DRAFT'], to: 'SUBMITTED' },
        REVIEW: { from: ['SUBMITTED'], to: 'UNDER_REVIEW' },
        CERTIFY: { from: ['UNDER_REVIEW'], to: 'CERTIFIED' },
        REJECT: { from: ['SUBMITTED', 'UNDER_REVIEW'], to: 'REJECTED' },
        MARK_PAID: { from: ['CERTIFIED'], to: 'PAID' },
      };
      const t = TRANSITIONS[action];
      if (!t) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: `Unknown action "${action}"` });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const cert = await tx.paymentCertificate.findFirst({
            where: { id: certId, project_id: projectId },
          });
          if (!cert) throw { status: 404, message: 'Payment certificate not found' };
          if (!t.from.includes(cert.status)) {
            throw { status: 400, message: `Cannot ${action.toLowerCase()} a certificate in ${cert.status} status` };
          }
          // Paid state derives from linked invoice payments — a certificate
          // with an invoice must be settled through /invoices/:id/payments.
          if (action === 'MARK_PAID' && cert.invoice_id) {
            throw {
              status: 409,
              message: 'This certificate has a linked invoice — record the payment on the invoice instead',
            };
          }

          // Maker-checker: the certificate's creator cannot certify or mark it
          // paid themselves; COMPANY_ADMIN/ADMIN only with a recorded reason.
          const selfAppr = (action === 'CERTIFY' || action === 'MARK_PAID')
            ? evaluateSelfApproval({
                creatorId: cert.submitted_by_id,
                actorId: sub,
                actorRole: role,
                reason: selfApprovalReason,
                entity: 'payment certificate',
              })
            : { selfApproved: false, reason: null };

          const now = new Date();
          const data: Record<string, unknown> = {
            status: t.to,
            submitted_at: action === 'SUBMIT' ? now : cert.submitted_at,
            certified_at: action === 'CERTIFY' ? now : cert.certified_at,
            paid_at: action === 'MARK_PAID' ? now : cert.paid_at,
            paid_reference: action === 'MARK_PAID' ? (paidReference ?? cert.paid_reference) : cert.paid_reference,
            certified_by_id: action === 'CERTIFY' ? sub : cert.certified_by_id,
            ...(action === 'CERTIFY' || action === 'MARK_PAID'
              ? { self_approved: selfAppr.selfApproved, self_approval_reason: selfAppr.reason }
              : {}),
          };

          // Atomic claim on current status — prevents double transitions.
          const claim = await tx.paymentCertificate.updateMany({
            where: { id: certId, status: cert.status },
            data,
          });
          if (claim.count !== 1) {
            throw { status: 409, message: 'Certificate was modified concurrently — please retry' };
          }

          const updated = await tx.paymentCertificate.findUniqueOrThrow({ where: { id: certId } });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: `PAYMENT_CERTIFICATE_${action}`,
            entityType: 'PaymentCertificate',
            entityId: certId,
            changes: {
              previousStatus: cert.status,
              newStatus: t.to,
              comments: comments ?? null,
              paidReference: action === 'MARK_PAID' ? (paidReference ?? null) : null,
              netPayable: cert.net_payable.toString(),
              selfApproved: selfAppr.selfApproved,
              selfApprovalReason: selfAppr.reason,
            },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          if (action === 'CERTIFY') {
            await notifyTeam(tx, {
              tenantId,
              projectId,
              senderId: sub,
              body: `IPC-${String(cert.certificate_no).padStart(3, '0')} certified — net payable ${toCurrencyString(cert.net_payable.toString())}. Create the client invoice from the certificate to get paid.`,
            });
          }

          return formatCert(updated);
        });

        return reply.status(200).send({ message: `Certificate ${action.toLowerCase()} processed`, data: result });
      } catch (rawErr) {
        const err = rawErr as RouteError;
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: err.status === 404 ? 'Not Found' : 'Bad Request', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to process certificate action' });
      }
    },
  );

  // =========================================================================
  // CLOSEOUT STAGE MACHINE (ADR-008)
  // =========================================================================

  async function closeoutChecklist(tx: Prisma.TransactionClient, projectId: string) {
    const [pcCert, dlpCerts, openSnags, pendingCerts, project] = await Promise.all([
      tx.defectsLiabilityCertificate.findFirst({
        where: { project_id: projectId, certificate_type: 'PRACTICAL_COMPLETION' },
        orderBy: { issue_date: 'desc' },
      }),
      tx.defectsLiabilityCertificate.findMany({
        where: { project_id: projectId },
        orderBy: { issue_date: 'desc' },
      }),
      tx.snagItem.count({
        where: { project_id: projectId, status: { in: ['OPEN', 'IN_PROGRESS', 'RECTIFIED_BY_CONTRACTOR'] } },
      }),
      tx.paymentCertificate.count({
        where: { project_id: projectId, status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'] } },
      }),
      tx.project.findUnique({ where: { id: projectId } }),
    ]);

    const now = new Date();
    const latestDlp = dlpCerts[0] ?? null;
    const dlpExpired = !!latestDlp?.dlp_expiry_date && new Date(latestDlp.dlp_expiry_date) <= now;
    const dlpActive = !!latestDlp?.dlp_expiry_date && new Date(latestDlp.dlp_expiry_date) > now;

    const stage = (project?.closeout_stage ?? 'IN_PROGRESS') as CloseoutStage;
    const gates: Record<string, boolean> = {
      HANDED_OVER: !!pcCert,
      DEFECTS_LIABILITY: !!pcCert && dlpActive,
      DEFECTS_EXPIRED: !!pcCert && dlpExpired,
      CLOSED: openSnags === 0 && pendingCerts === 0,
    };

    return {
      stage,
      practical_completion_date: project?.practical_completion_date?.toISOString().slice(0, 10) ?? null,
      nextStage: NEXT_STAGE[stage],
      checklist: {
        practicalCompletionCertificate: !!pcCert,
        defectsLiabilityPeriodActive: dlpActive,
        defectsLiabilityExpired: dlpExpired,
        openSnagItems: openSnags,
        pendingPaymentCertificates: pendingCerts,
      },
      gates,
    };
  }

  server.get(
    '/api/v1/projects/:projectId/closeout',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }
      try {
        const data = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };
          return closeoutChecklist(tx, projectId);
        });
        return reply.status(200).send({ data });
      } catch (rawErr) {
        const err = rawErr as RouteError;
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load closeout status' });
      }
    },
  );

  server.post(
    '/api/v1/projects/:projectId/closeout/transition',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_APPROVE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };
      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }
      const parsed = CloseoutTransitionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid closeout transition', details: parsed.error.errors });
      }
      const { stage: target, notes } = parsed.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const current = (project.closeout_stage ?? 'IN_PROGRESS') as CloseoutStage;
          if (NEXT_STAGE[current] !== target) {
            throw {
              status: 400,
              message: `Illegal closeout transition: ${current} -> ${target} (expected ${NEXT_STAGE[current] ?? 'none — already CLOSED'})`,
            };
          }

          const checklist = await closeoutChecklist(tx, projectId);
          if (!checklist.gates[target]) {
            throw { status: 409, message: `Closeout prerequisites not met for ${target}: ${JSON.stringify(checklist.checklist)}` };
          }

          const updateData: Record<string, unknown> = { closeout_stage: target };
          if (target === 'HANDED_OVER' && !project.practical_completion_date) {
            const pcCert = await tx.defectsLiabilityCertificate.findFirst({
              where: { project_id: projectId, certificate_type: 'PRACTICAL_COMPLETION' },
              orderBy: { issue_date: 'desc' },
            });
            updateData.practical_completion_date = pcCert?.effective_date ?? new Date();
          }
          if (target === 'CLOSED' && project.status !== 'COMPLETED') {
            updateData.status = 'COMPLETED';
          }

          // Atomic stage claim.
          const claim = await tx.project.updateMany({
            where: { id: projectId, closeout_stage: current },
            data: updateData,
          });
          if (claim.count !== 1) {
            throw { status: 409, message: 'Closeout stage was modified concurrently — please retry' };
          }

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'CLOSEOUT_STAGE_TRANSITION',
            entityType: 'Project',
            entityId: projectId,
            changes: { previousStage: current, newStage: target, notes: notes ?? null },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          return closeoutChecklist(tx, projectId);
        });

        return reply.status(200).send({ message: `Closeout advanced to ${target}`, data: result });
      } catch (rawErr) {
        const err = rawErr as RouteError;
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: err.status === 404 ? 'Not Found' : 'Bad Request', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to transition closeout stage' });
      }
    },
  );
};
