import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions, hasPermission, Role } from '@construction/permissions';
import { toDecimal, toCurrencyString, Decimal } from '@construction/money';
import {
  CreatePaymentCertificateSchema,
  PaymentCertificateActionSchema,
  CloseoutTransitionSchema,
} from '@construction/validation';
import { requirePermission } from '../plugins/rbac';

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

function formatCert(c: any) {
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
    submitted_at: c.submitted_at?.toISOString() ?? null,
    certified_at: c.certified_at?.toISOString() ?? null,
    paid_at: c.paid_at?.toISOString() ?? null,
  };
}

/** Contract-sum baseline for the 5% JBC retention cap (mirrors lifecycle.ts). */
async function resolveContractSum(tx: any, project: any): Promise<Decimal> {
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
async function certifiedTotal(tx: any, projectId: string): Promise<Decimal> {
  const agg = await tx.paymentCertificate.aggregate({
    where: { project_id: projectId, status: { in: ['CERTIFIED', 'PAID'] } },
    _sum: { this_period_amount: true },
  });
  return toDecimal(agg._sum.this_period_amount?.toString() ?? '0');
}

async function latestRetentionHeld(tx: any, projectId: string): Promise<Decimal> {
  const last = await tx.paymentCertificate.findFirst({
    where: { project_id: projectId, status: { in: ['CERTIFIED', 'PAID', 'SUBMITTED', 'UNDER_REVIEW'] } },
    orderBy: { certificate_no: 'desc' },
    select: { retention_held: true },
  });
  return last ? toDecimal(last.retention_held.toString()) : new Decimal(0);
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
          });
          return rows.map(formatCert);
        });
        return reply.status(200).send({ data: certs, count: certs.length });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list payment certificates' });
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

          const latest = await tx.paymentCertificate.findFirst({
            where: { project_id: projectId },
            orderBy: { certificate_no: 'desc' },
            select: { certificate_no: true },
          });
          const certificateNo = (latest?.certificate_no ?? 0) + 1;

          const thisPeriod = toDecimal(data.thisPeriodAmount ?? '0');
          const previousCertified = await certifiedTotal(tx, projectId);
          const cumulative = previousCertified.plus(thisPeriod);

          // JBC 1999: retention fund capped at 5% of contract sum.
          const contractSum = await resolveContractSum(tx, project);
          const retentionCap = contractSum.times(5).dividedBy(100);
          const pct = toDecimal(data.retentionPct ?? '5').dividedBy(100);
          const prevHeld = await latestRetentionHeld(tx, projectId);
          const desiredDeduction = thisPeriod.times(pct);
          const room = Decimal.max(new Decimal(0), retentionCap.minus(prevHeld));
          const retentionDeduction = Decimal.min(desiredDeduction, room).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          const released = toDecimal(data.retentionReleased ?? '0');
          const retentionHeld = Decimal.max(
            new Decimal(0),
            prevHeld.plus(retentionDeduction).minus(released),
          ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

          const advanceRecovery = toDecimal(data.advanceRecovery ?? '0');
          const amountDuePrevious = toDecimal(data.amountDuePrevious ?? '0');
          const netPayable = thisPeriod
            .minus(retentionDeduction)
            .minus(advanceRecovery)
            .plus(amountDuePrevious)
            .plus(released)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

          const created = await tx.paymentCertificate.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              certificate_no: certificateNo,
              period_start: new Date(`${data.periodStart}T00:00:00.000Z`),
              period_end: new Date(`${data.periodEnd}T00:00:00.000Z`),
              this_period_amount: thisPeriod.toFixed(2),
              previous_certified: previousCertified.toFixed(2),
              cumulative_certified: cumulative.toFixed(2),
              retention_pct: pct.times(100).toDecimalPlaces(2).toFixed(2),
              retention_deduction: retentionDeduction.toFixed(2),
              retention_held: retentionHeld.toFixed(2),
              retention_released: released.toFixed(2),
              advance_recovery: advanceRecovery.toFixed(2),
              amount_due_previous: amountDuePrevious.toFixed(2),
              net_payable: netPayable.toFixed(2),
              submitted_by_id: sub,
              notes: data.notes ?? null,
            },
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
              cumulative: cumulative.toFixed(2),
              retentionHeld: retentionHeld.toFixed(2),
              netPayable: netPayable.toFixed(2),
            },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          return formatCert(created);
        });

        return reply.status(201).send({ message: 'Payment certificate drafted', data: cert });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create payment certificate' });
      }
    },
  );

  // POST /api/v1/projects/:projectId/payment-certificates/:certId/action
  server.post(
    '/api/v1/projects/:projectId/payment-certificates/:certId/action',
    { preHandler: [server.authenticate] },
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
      const { action, comments, paidReference } = parsed.data;

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

          const now = new Date();
          const data: any = {
            status: t.to,
            submitted_at: action === 'SUBMIT' ? now : cert.submitted_at,
            certified_at: action === 'CERTIFY' ? now : cert.certified_at,
            paid_at: action === 'MARK_PAID' ? now : cert.paid_at,
            paid_reference: action === 'MARK_PAID' ? (paidReference ?? cert.paid_reference) : cert.paid_reference,
            certified_by_id: action === 'CERTIFY' ? sub : cert.certified_by_id,
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
            },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          return formatCert(updated);
        });

        return reply.status(200).send({ message: `Certificate ${action.toLowerCase()} processed`, data: result });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: err.status === 404 ? 'Not Found' : 'Bad Request', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to process certificate action' });
      }
    },
  );

  // =========================================================================
  // CLOSEOUT STAGE MACHINE (ADR-008)
  // =========================================================================

  async function closeoutChecklist(tx: any, projectId: string) {
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
      } catch (err: any) {
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

          const updateData: any = { closeout_stage: target };
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
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: err.status === 404 ? 'Not Found' : 'Bad Request', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to transition closeout stage' });
      }
    },
  );
};
