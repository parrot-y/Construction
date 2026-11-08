import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions, hasPermission, Role } from '@construction/permissions';
import { toDecimal, toCurrencyString, Decimal } from '@construction/money';
import {
  CreateCommitmentSchema,
  UpdateCommitmentSchema,
  CreatePaymentApplicationSchema,
  PaymentApplicationActionSchema,
} from '@construction/validation';
import { requirePermission } from '../plugins/rbac';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Gate-4 S5: Commitments -> Claims -> Payment Applications.
 * Retention is derived as min(cumulative*pct, contractValue*capPct);
 * advance recovery is min(outstanding advance, gross*recoverPct).
 * All money math uses @construction/money Decimal (ADR-005).
 */

function dec(v: any): Decimal {
  return toDecimal(v?.toString() ?? '0');
}

function money(v: any): string {
  return toCurrencyString(v == null ? '0' : v.toString());
}

function formatCommitment(c: any, stats?: { certified: Decimal; retentionHeld: Decimal; advanceOutstanding: Decimal; netOwed: Decimal }) {
  return {
    ...c,
    contract_value: money(c.contract_value),
    advance_amount: money(c.advance_amount),
    advance_paid: money(c.advance_paid),
    ...(stats
      ? {
          certified_to_date: money(stats.certified),
          retention_held: money(stats.retentionHeld),
          advance_outstanding: money(stats.advanceOutstanding),
          net_amount_owed: money(stats.netOwed),
        }
      : {}),
  };
}

function formatApplication(a: any) {
  return {
    ...a,
    period_start: a.period_start ? a.period_start.toISOString().slice(0, 10) : null,
    period_end: a.period_end ? a.period_end.toISOString().slice(0, 10) : null,
    gross_claimed: money(a.gross_claimed),
    previous_certified: money(a.previous_certified),
    cumulative_certified: money(a.cumulative_certified),
    retention_withheld: money(a.retention_withheld),
    retention_held: money(a.retention_held),
    advance_recovered: money(a.advance_recovered),
    advance_outstanding: money(a.advance_outstanding),
    wht_amount: money(a.wht_amount),
    previous_balance: money(a.previous_balance),
    net_payable: money(a.net_payable),
    submitted_at: a.submitted_at?.toISOString() ?? null,
    approved_at: a.approved_at?.toISOString() ?? null,
    paid_at: a.paid_at?.toISOString() ?? null,
  };
}

/** Certified gross + derived totals for a commitment (APPROVED+PAID applications). */
async function commitmentStats(tx: any, commitmentId: string, contractValue: Decimal) {
  const commitment = await tx.commitment.findUnique({ where: { id: commitmentId } });
  if (!commitment) throw { status: 404, message: 'Commitment not found' };

  const apps = await tx.paymentApplication.findMany({
    where: { commitment_id: commitmentId, status: { in: ['APPROVED', 'PAID'] } },
  });
  const certified = apps.reduce((s: Decimal, a: any) => s.plus(dec(a.gross_claimed)), new Decimal(0));

  // Retention held = min(cumulative*pct, contractValue*capPct), floored at latest app value
  const latestApp = await tx.paymentApplication.findFirst({
    where: { commitment_id: commitmentId, status: { in: ['APPROVED', 'PAID'] } },
    orderBy: { application_no: 'desc' },
  });
  const retentionHeld = latestApp
    ? dec(latestApp.retention_held)
    : Decimal.min(
        certified.times(dec(commitment.retention_pct)).dividedBy(100),
        contractValue.times(dec(commitment.retention_cap_pct)).dividedBy(100),
      ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const advanceRecoveredTotal = apps.reduce((s: Decimal, a: any) => s.plus(dec(a.advance_recovered)), new Decimal(0));
  const advanceOutstanding = Decimal.max(new Decimal(0), dec(commitment.advance_paid).minus(advanceRecoveredTotal));

  // Amount still owed = net_payable of APPROVED (certified but unpaid) applications
  const approvedApps = await tx.paymentApplication.findMany({
    where: { commitment_id: commitmentId, status: 'APPROVED' },
  });
  const netOwed = approvedApps.reduce((s: Decimal, a: any) => s.plus(dec(a.net_payable)), new Decimal(0));

  return { certified, retentionHeld, advanceOutstanding, netOwed };
}

export const commitmentsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // =========================================================================
  // COMMITMENTS
  // =========================================================================

  server.get(
    '/api/v1/projects/:projectId/commitments',
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
          const rows = await tx.commitment.findMany({
            where: { project_id: projectId },
            include: { applications: { orderBy: { application_no: 'asc' } } },
            orderBy: { commitment_no: 'asc' },
          });
          const out = [];
          for (const c of rows) {
            const stats = await commitmentStats(tx, c.id, dec(c.contract_value));
            out.push({
              ...formatCommitment(c, stats),
              applications: c.applications.map(formatApplication),
              application_count: c.applications.length,
            });
          }
          return out;
        });
        return reply.status(200).send({ data, count: data.length });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list commitments' });
      }
    },
  );

  server.post(
    '/api/v1/projects/:projectId/commitments',
    { preHandler: [server.authenticate, requirePermission(Permissions.CERTIFICATE_MANAGE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };
      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }
      const parsed = CreateCommitmentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid commitment payload', details: parsed.error.errors });
      }
      const data = parsed.data;
      if (dec(data.advancePaid).greaterThan(dec(data.advanceAmount)) && dec(data.advanceAmount).greaterThan(0)) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'advancePaid cannot exceed advanceAmount' });
      }

      try {
        const commitment = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const latest = await tx.commitment.findFirst({
            where: { project_id: projectId },
            orderBy: { commitment_no: 'desc' },
            select: { commitment_no: true },
          });
          const commitmentNo = (latest?.commitment_no ?? 0) + 1;

          const created = await tx.commitment.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              commitment_no: commitmentNo,
              vendor_name: data.vendorName,
              vendor_type: data.vendorType,
              scope_description: data.scopeDescription ?? null,
              contract_value: dec(data.contractValue).toFixed(2),
              currency: data.currency || 'KES',
              retention_pct: dec(data.retentionPct ?? '5').toDecimalPlaces(2).toFixed(2),
              retention_cap_pct: dec(data.retentionCapPct ?? '5').toDecimalPlaces(2).toFixed(2),
              advance_amount: dec(data.advanceAmount ?? '0').toFixed(2),
              advance_paid: dec(data.advancePaid ?? '0').toFixed(2),
              advance_recover_pct: dec(data.advanceRecoverPct ?? '0').toDecimalPlaces(2).toFixed(2),
              cost_code: data.costCode ?? null,
              notes: data.notes ?? null,
              status: dec(data.contractValue).greaterThan(0) ? 'ACTIVE' : 'DRAFT',
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'COMMITMENT_CREATED',
            entityType: 'Commitment',
            entityId: created.id,
            changes: {
              commitmentNo,
              vendorName: data.vendorName,
              contractValue: dec(data.contractValue).toFixed(2),
              retentionPct: created.retention_pct.toString(),
            },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          return formatCommitment(created);
        });

        return reply.status(201).send({ message: 'Commitment created', data: commitment });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create commitment' });
      }
    },
  );

  server.patch(
    '/api/v1/projects/:projectId/commitments/:commitmentId',
    { preHandler: [server.authenticate, requirePermission(Permissions.CERTIFICATE_MANAGE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, commitmentId } = request.params as { projectId: string; commitmentId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(commitmentId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Commitment not found' });
      }
      const parsed = UpdateCommitmentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid commitment update', details: parsed.error.errors });
      }
      const data = parsed.data;

      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const commitment = await tx.commitment.findFirst({ where: { id: commitmentId, project_id: projectId } });
          if (!commitment) throw { status: 404, message: 'Commitment not found' };
          if (commitment.status === 'TERMINATED') {
            throw { status: 400, message: 'Cannot modify a terminated commitment' };
          }

          const result = await tx.commitment.update({
            where: { id: commitmentId },
            data: {
              ...(data.vendorName !== undefined ? { vendor_name: data.vendorName } : {}),
              ...(data.scopeDescription !== undefined ? { scope_description: data.scopeDescription } : {}),
              ...(data.status !== undefined ? { status: data.status } : {}),
              ...(data.notes !== undefined ? { notes: data.notes } : {}),
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'COMMITMENT_UPDATED',
            entityType: 'Commitment',
            entityId: commitmentId,
            changes: { fields: Object.keys(data), status: result.status },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          return formatCommitment(result);
        });
        return reply.status(200).send({ data: updated });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update commitment' });
      }
    },
  );

  // =========================================================================
  // PAYMENT APPLICATIONS (claims against a commitment)
  // =========================================================================

  server.post(
    '/api/v1/projects/:projectId/commitments/:commitmentId/applications',
    { preHandler: [server.authenticate, requirePermission(Permissions.CERTIFICATE_MANAGE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, commitmentId } = request.params as { projectId: string; commitmentId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(commitmentId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Commitment not found' });
      }
      const parsed = CreatePaymentApplicationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid payment application payload', details: parsed.error.errors });
      }
      const data = parsed.data;
      if (data.periodEnd < data.periodStart) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'periodEnd must be on or after periodStart' });
      }

      try {
        const application = await withTenantTx(prisma, tenantId, async (tx) => {
          const commitment = await tx.commitment.findFirst({ where: { id: commitmentId, project_id: projectId } });
          if (!commitment) throw { status: 404, message: 'Commitment not found' };
          if (!['ACTIVE', 'COMPLETED'].includes(commitment.status)) {
            throw { status: 400, message: `Cannot claim against a ${commitment.status.toLowerCase()} commitment` };
          }

          const gross = dec(data.grossClaimed);
          if (gross.lte(0)) throw { status: 400, message: 'grossClaimed must be greater than zero' };

          const priorApps = await tx.paymentApplication.findMany({
            where: { commitment_id: commitmentId, status: { in: ['APPROVED', 'PAID'] } },
            orderBy: { application_no: 'desc' },
          });
          const previousCertified = priorApps.reduce((s: Decimal, a: any) => s.plus(dec(a.gross_claimed)), new Decimal(0));
          const cumulative = previousCertified.plus(gross);

          // Retention: cumulative held = min(cumulative*pct, contractValue*capPct)
          const retentionPct = dec(commitment.retention_pct);
          const capPct = dec(commitment.retention_cap_pct);
          const contractValue = dec(commitment.contract_value);
          const prevHeld = priorApps.length ? dec(priorApps[0]!.retention_held) : new Decimal(0);
          const newHeldTarget = Decimal.min(
            cumulative.times(retentionPct).dividedBy(100),
            contractValue.times(capPct).dividedBy(100),
          ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          const retentionHeld = Decimal.max(newHeldTarget, prevHeld);
          const retentionWithheld = Decimal.max(new Decimal(0), retentionHeld.minus(prevHeld));

          // Advance recovery: % of gross claim until advance_paid fully recovered
          const advancePaid = dec(commitment.advance_paid);
          const recoverPct = dec(commitment.advance_recover_pct);
          const priorRecovered = priorApps.reduce((s: Decimal, a: any) => s.plus(dec(a.advance_recovered)), new Decimal(0));
          const advanceOutstandingBefore = Decimal.max(new Decimal(0), advancePaid.minus(priorRecovered));
          const advanceRecovered = Decimal.min(
            advanceOutstandingBefore,
            gross.times(recoverPct).dividedBy(100),
          ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          const advanceOutstanding = Decimal.max(new Decimal(0), advanceOutstandingBefore.minus(advanceRecovered));

          const whtPct = dec(data.whtPct ?? '0');
          const whtAmount = gross.times(whtPct).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          const previousBalance = dec(data.previousBalance ?? '0');
          const netPayable = gross
            .minus(retentionWithheld)
            .minus(advanceRecovered)
            .minus(whtAmount)
            .plus(previousBalance)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

          const latest = await tx.paymentApplication.findFirst({
            where: { commitment_id: commitmentId },
            orderBy: { application_no: 'desc' },
            select: { application_no: true },
          });
          const applicationNo = (latest?.application_no ?? 0) + 1;

          const created = await tx.paymentApplication.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              commitment_id: commitmentId,
              application_no: applicationNo,
              period_start: new Date(`${data.periodStart}T00:00:00.000Z`),
              period_end: new Date(`${data.periodEnd}T00:00:00.000Z`),
              gross_claimed: gross.toFixed(2),
              previous_certified: previousCertified.toFixed(2),
              cumulative_certified: cumulative.toFixed(2),
              retention_withheld: retentionWithheld.toFixed(2),
              retention_held: retentionHeld.toFixed(2),
              advance_recovered: advanceRecovered.toFixed(2),
              advance_outstanding: advanceOutstanding.toFixed(2),
              wht_pct: whtPct.toDecimalPlaces(2).toFixed(2),
              wht_amount: whtAmount.toFixed(2),
              previous_balance: previousBalance.toFixed(2),
              net_payable: netPayable.toFixed(2),
              submitted_by_id: sub,
              notes: data.notes ?? null,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'PAYMENT_APPLICATION_CREATED',
            entityType: 'PaymentApplication',
            entityId: created.id,
            changes: {
              applicationNo,
              commitmentId,
              gross: gross.toFixed(2),
              retentionWithheld: retentionWithheld.toFixed(2),
              advanceRecovered: advanceRecovered.toFixed(2),
              netPayable: netPayable.toFixed(2),
            },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          return formatApplication(created);
        });

        return reply.status(201).send({ message: 'Payment application drafted', data: application });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create payment application' });
      }
    },
  );

  server.post(
    '/api/v1/projects/:projectId/commitments/:commitmentId/applications/:applicationId/action',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId, commitmentId, applicationId } = request.params as {
        projectId: string;
        commitmentId: string;
        applicationId: string;
      };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(commitmentId) || !UUID_REGEX.test(applicationId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Payment application not found' });
      }
      const parsed = PaymentApplicationActionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid action payload', details: parsed.error.errors });
      }
      const { action, comments, paidReference } = parsed.data;

      const needsApprove = action === 'APPROVE' || action === 'REJECT' || action === 'MARK_PAID';
      const allowed = needsApprove
        ? hasPermission(role as Role, Permissions.COST_APPROVE)
        : hasPermission(role as Role, Permissions.CERTIFICATE_MANAGE);
      if (!allowed) {
        return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: `Role "${role}" lacks permission for ${action}` });
      }

      const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
        SUBMIT: { from: ['DRAFT'], to: 'SUBMITTED' },
        APPROVE: { from: ['SUBMITTED'], to: 'APPROVED' },
        REJECT: { from: ['SUBMITTED'], to: 'REJECTED' },
        MARK_PAID: { from: ['APPROVED'], to: 'PAID' },
      };
      const t = TRANSITIONS[action];
      if (!t) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: `Unknown action "${action}"` });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const app = await tx.paymentApplication.findFirst({
            where: { id: applicationId, commitment_id: commitmentId, project_id: projectId },
          });
          if (!app) throw { status: 404, message: 'Payment application not found' };
          if (!t.from.includes(app.status)) {
            throw { status: 400, message: `Cannot ${action.toLowerCase()} an application in ${app.status} status` };
          }

          const now = new Date();
          const data: any = {
            status: t.to,
            submitted_at: action === 'SUBMIT' ? now : app.submitted_at,
            approved_at: action === 'APPROVE' ? now : app.approved_at,
            paid_at: action === 'MARK_PAID' ? now : app.paid_at,
            paid_reference: action === 'MARK_PAID' ? (paidReference ?? app.paid_reference) : app.paid_reference,
            approved_by_id: action === 'APPROVE' ? sub : app.approved_by_id,
          };

          const claim = await tx.paymentApplication.updateMany({
            where: { id: applicationId, status: app.status },
            data,
          });
          if (claim.count !== 1) {
            throw { status: 409, message: 'Application was modified concurrently — please retry' };
          }

          const updated = await tx.paymentApplication.findUniqueOrThrow({ where: { id: applicationId } });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: `PAYMENT_APPLICATION_${action}`,
            entityType: 'PaymentApplication',
            entityId: applicationId,
            changes: {
              previousStatus: app.status,
              newStatus: t.to,
              comments: comments ?? null,
              paidReference: action === 'MARK_PAID' ? (paidReference ?? null) : null,
              netPayable: app.net_payable.toString(),
            },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          return formatApplication(updated);
        });

        return reply.status(200).send({ message: `Application ${action.toLowerCase()} processed`, data: result });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: err.status === 404 ? 'Not Found' : 'Bad Request', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to process application action' });
      }
    },
  );
};
