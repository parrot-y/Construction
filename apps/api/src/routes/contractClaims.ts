import { FastifyInstance } from 'fastify';
import { prisma, withTenantTx, recordAuditLog } from '@construction/db';
import { getTaxSettings } from '../lib/tax';
import {
  CreateDelayEventSchema,
  ReviewDelayEventSchema,
  CreateTaxCertificateSchema,
  RemitTaxCertificateSchema,
} from '@construction/validation';
import { toDecimal } from '@construction/money';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function contractClaimsRoutes(server: FastifyInstance) {
  // ===========================================================================
  // MODULE 1: WEATHER DELAY & EXTENSION OF TIME (JBC 1999 CLAUSE 25/32)
  // ===========================================================================

  // 1.1 Create Delay Event / EOT Claim
  server.post(
    '/api/v1/projects/:projectId/delay-events',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateDelayEventSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid delay claim payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;
      const dailyLadDecimal = toDecimal(data.dailyLadRateKes || '50000.00');

      try {
        const delayEvent = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const created = await tx.projectDelayEvent.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              delay_type: data.delayType,
              title: data.title,
              start_date: new Date(data.startDate),
              end_date: new Date(data.endDate),
              days_claimed: data.daysClaimed,
              critical_path_impact: data.criticalPathImpact,
              daily_lad_rate_kes: dailyLadDecimal.toFixed(2),
              site_diary_reference: data.siteDiaryReference || null,
              meteorological_proof: data.meteorologicalProof || null,
              notes: data.notes || null,
              status: 'PENDING_REVIEW',
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'DELAY_EVENT_CLAIMED',
            entityType: 'ProjectDelayEvent',
            entityId: created.id,
            projectId,
          });

          return created;
        });

        return reply.status(201).send(delayEvent);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to create delay event claim');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create delay event claim' });
      }
    },
  );

  // 1.2 List Delay Events & Calculate EOT Summary
  server.get(
    '/api/v1/projects/:projectId/delay-events',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const events = await tx.projectDelayEvent.findMany({
            where: { project_id: projectId },
            orderBy: { start_date: 'desc' },
          });

          let totalDaysClaimed = 0;
          let totalApprovedDays = 0;
          let totalFinancialRelief = toDecimal(0);
          let approvedCount = 0;

          for (const ev of events) {
            totalDaysClaimed += ev.days_claimed;
            if (ev.status === 'APPROVED_BY_ARCHITECT' && ev.approved_days) {
              totalApprovedDays += ev.approved_days;
              approvedCount++;
              if (ev.lad_financial_relief_kes) {
                totalFinancialRelief = totalFinancialRelief.plus(toDecimal(ev.lad_financial_relief_kes));
              }
            }
          }

          return {
            delayEvents: events,
            summary: {
              totalClaimsCount: events.length,
              approvedClaimsCount: approvedCount,
              totalDaysClaimed,
              totalApprovedDays,
              totalFinancialReliefKes: totalFinancialRelief.toFixed(2),
            },
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        request.log.error(err, 'Failed to retrieve delay events');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to retrieve delay events' });
      }
    },
  );

  // 1.3 Review Delay Event (Architect Approval or QS Recommendation)
  server.put(
    '/api/v1/projects/:projectId/delay-events/:id/review',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, id } = request.params as { projectId: string; id: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      const parseResult = ReviewDelayEventSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid review payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.projectDelayEvent.findFirst({
            where: { id, project_id: projectId },
          });
          if (!existing) throw { status: 404, message: 'Delay event not found' };

          let reliefDecimal: string | null = null;
          if (data.status === 'APPROVED_BY_ARCHITECT' && data.approvedDays && data.approvedDays > 0) {
            const dailyLad = toDecimal(existing.daily_lad_rate_kes);
            reliefDecimal = dailyLad.times(data.approvedDays).toFixed(2);
          }

          const ev = await tx.projectDelayEvent.update({
            where: { id },
            data: {
              status: data.status,
              approved_days: data.approvedDays ?? null,
              lad_financial_relief_kes: reliefDecimal,
              certifying_authority: data.certifyingAuthority,
              notes: data.notes || existing.notes,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'DELAY_EVENT_REVIEWED',
            entityType: 'ProjectDelayEvent',
            entityId: ev.id,
            projectId,
          });

          return ev;
        });

        return reply.status(200).send(updated);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to review delay event');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to review delay event' });
      }
    },
  );

  // ===========================================================================
  // MODULE 2: KRA STATUTORY WITHHOLDING TAX (CAP 470) & WHVAT CERTIFICATES
  // ===========================================================================

  // 2.1 Generate Statutory Tax Certificate (3% WHT, 2% WHVAT)
  server.post(
    '/api/v1/projects/:projectId/tax-certificates',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateTaxCertificateSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid tax certificate payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;
      const grossDecimal = toDecimal(data.grossAmount);
      // Rates resolve from tenant tax settings unless explicitly overridden.
      const taxSettings = await withTenantTx(prisma, tenantId, async (tx) => getTaxSettings(tx, tenantId));
      const whtRateDecimal = data.whtRatePct != null ? toDecimal(data.whtRatePct) : taxSettings.whtContractorPct;
      const whvatRateDecimal = data.whvatRatePct != null ? toDecimal(data.whvatRatePct) : taxSettings.whvatPct;

      // Kenyan KRA Cap 470 Mathematical Formulation:
      // WHT = Gross * (whtRate / 100)
      // WHVAT = Gross * (whvatRate / 100)
      // Net = Gross - WHT - WHVAT
      const whtDeducted = grossDecimal.times(whtRateDecimal).dividedBy(100);
      const whvatDeducted = grossDecimal.times(whvatRateDecimal).dividedBy(100);
      const netPayable = grossDecimal.minus(whtDeducted).minus(whvatDeducted);

      const generatedCertNo = `KRA-WHT-${Date.now().toString().slice(-6)}`;

      try {
        const certificate = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const cert = await tx.statutoryTaxCertificate.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              certificate_no: generatedCertNo,
              payee_type: data.payeeType,
              payee_name: data.payeeName,
              payee_kra_pin: data.payeeKraPin,
              invoice_or_ipc_ref: data.invoiceOrIpcRef,
              gross_amount: grossDecimal.toFixed(2),
              wht_rate_pct: whtRateDecimal.toFixed(2),
              wht_deducted: whtDeducted.toFixed(2),
              whvat_rate_pct: whvatRateDecimal.toFixed(2),
              whvat_deducted: whvatDeducted.toFixed(2),
              net_payable: netPayable.toFixed(2),
              status: 'GENERATED',
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'TAX_CERTIFICATE_GENERATED',
            entityType: 'StatutoryTaxCertificate',
            entityId: cert.id,
            projectId,
          });

          return cert;
        });

        return reply.status(201).send(certificate);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to generate statutory tax certificate');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to generate statutory tax certificate' });
      }
    },
  );

  // 2.2 List Tax Certificates & Calculate Withholding Aggregates
  server.get(
    '/api/v1/projects/:projectId/tax-certificates',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const certs = await tx.statutoryTaxCertificate.findMany({
            where: { project_id: projectId },
            orderBy: { created_at: 'desc' },
          });

          let totalGross = toDecimal(0);
          let totalWht = toDecimal(0);
          let totalWhvat = toDecimal(0);
          let totalNet = toDecimal(0);

          for (const c of certs) {
            totalGross = totalGross.plus(toDecimal(c.gross_amount));
            totalWht = totalWht.plus(toDecimal(c.wht_deducted));
            totalWhvat = totalWhvat.plus(toDecimal(c.whvat_deducted));
            totalNet = totalNet.plus(toDecimal(c.net_payable));
          }

          return {
            certificates: certs,
            summary: {
              totalCertificates: certs.length,
              totalGrossCertifiedKes: totalGross.toFixed(2),
              totalWhtDeductedKes: totalWht.toFixed(2),
              totalWhvatDeductedKes: totalWhvat.toFixed(2),
              totalNetDisbursedKes: totalNet.toFixed(2),
            },
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        request.log.error(err, 'Failed to list tax certificates');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list tax certificates' });
      }
    },
  );

  // 2.3 Remit Tax Certificate to KRA iTax
  server.put(
    '/api/v1/projects/:projectId/tax-certificates/:id/remit',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, id } = request.params as { projectId: string; id: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      const parseResult = RemitTaxCertificateSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid remittance payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.statutoryTaxCertificate.findFirst({
            where: { id, project_id: projectId },
          });
          if (!existing) throw { status: 404, message: 'Tax certificate not found' };

          const cert = await tx.statutoryTaxCertificate.update({
            where: { id },
            data: {
              status: data.status,
              itax_acknowledgement_receipt: data.itaxAcknowledgementReceipt,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'TAX_CERTIFICATE_REMITTED',
            entityType: 'StatutoryTaxCertificate',
            entityId: cert.id,
            projectId,
          });

          return cert;
        });

        return reply.status(200).send(updated);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to update tax certificate remittance');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update tax certificate remittance' });
      }
    },
  );
}
