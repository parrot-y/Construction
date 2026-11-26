import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { CreateScheduledReportSchema, UpdateScheduledReportSchema } from '@construction/validation';
import { requirePermission } from '../plugins/rbac';
import { nextRunAt, runScheduledReport } from '../lib/scheduledReportRunner';
import { listParams, listPage } from '../lib/pagination';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const scheduledReportsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/reports/scheduled
  server.get(
    '/api/v1/reports/scheduled',
    { preHandler: [server.authenticate, requirePermission(Permissions.REPORT_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const pg = listParams(request);
      try {
        const data = await withTenantTx(prisma, tenantId, async (tx) =>
          tx.scheduledReport.findMany({
            include: {
              project: { select: { id: true, name: true, code: true } },
              runs: { orderBy: { ran_at: 'desc' }, take: 5, select: { id: true, ran_at: true, status: true, error: true } },
            },
            orderBy: { created_at: 'desc' },
            skip: pg.skip,
            take: pg.limit + 1,
          }),
        );
        const paged = listPage(data, pg);
        return reply.status(200).send({
          data: paged.data.map((r) => ({
            ...r,
            next_run_at: r.next_run_at?.toISOString() ?? null,
            last_run_at: r.last_run_at?.toISOString() ?? null,
            created_at: r.created_at.toISOString(),
          })),
          page: paged.page,
          count: paged.data.length,
        });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list scheduled reports' });
      }
    },
  );

  // POST /api/v1/reports/scheduled
  server.post(
    '/api/v1/reports/scheduled',
    { preHandler: [server.authenticate, requirePermission(Permissions.REPORT_GENERATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = CreateScheduledReportSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid report schedule', details: parsed.error.errors });
      }
      const data = parsed.data;
      try {
        const report = await withTenantTx(prisma, tenantId, async (tx) => {
          if (data.projectId) {
            const project = await tx.project.findFirst({ where: { id: data.projectId } });
            if (!project) throw { status: 404, message: 'Project not found' };
          }
          const r = await tx.scheduledReport.create({
            data: {
              tenant_id: tenantId,
              project_id: data.projectId ?? null,
              name: data.name,
              report_type: data.reportType,
              frequency: data.frequency,
              day_of_week: data.dayOfWeek ?? null,
              day_of_month: data.dayOfMonth ?? null,
              recipients: data.recipients,
              format: data.format,
              next_run_at: nextRunAt(data.frequency, data.dayOfWeek, data.dayOfMonth),
              created_by_id: sub,
            },
          });
          await recordAuditLog(tx, {
            tenantId, projectId: data.projectId ?? undefined, actorId: sub,
            action: 'SCHEDULED_REPORT_CREATED', entityType: 'ScheduledReport', entityId: r.id,
            changes: { name: data.name, type: data.reportType, frequency: data.frequency },
          });
          return r;
        });
        return reply.status(201).send({ data: report });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create scheduled report' });
      }
    },
  );

  // PATCH /api/v1/reports/scheduled/:id — edit / pause / resume
  server.patch(
    '/api/v1/reports/scheduled/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.REPORT_GENERATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Report not found' });
      const parsed = UpdateScheduledReportSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid update', details: parsed.error.errors });
      }
      const data = parsed.data;
      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const report = await tx.scheduledReport.findUnique({ where: { id } });
          if (!report) throw { status: 404, message: 'Report not found' };
          const freq = data.frequency ?? report.frequency;
          const dow = data.dayOfWeek !== undefined ? data.dayOfWeek : report.day_of_week;
          const dom = data.dayOfMonth !== undefined ? data.dayOfMonth : report.day_of_month;
          const result = await tx.scheduledReport.update({
            where: { id },
            data: {
              ...(data.name !== undefined ? { name: data.name } : {}),
              ...(data.status !== undefined ? { status: data.status } : {}),
              ...(data.frequency !== undefined ? { frequency: data.frequency } : {}),
              ...(data.dayOfWeek !== undefined ? { day_of_week: data.dayOfWeek } : {}),
              ...(data.dayOfMonth !== undefined ? { day_of_month: data.dayOfMonth } : {}),
              ...(data.recipients !== undefined ? { recipients: data.recipients } : {}),
              ...(data.format !== undefined ? { format: data.format } : {}),
              // reschedule when timing fields change or report resumes
              ...(data.frequency !== undefined || data.dayOfWeek !== undefined || data.dayOfMonth !== undefined || data.status === 'ACTIVE'
                ? { next_run_at: nextRunAt(freq, dow, dom) }
                : {}),
            },
          });
          await recordAuditLog(tx, {
            tenantId, projectId: report.project_id ?? undefined, actorId: sub,
            action: 'SCHEDULED_REPORT_UPDATED', entityType: 'ScheduledReport', entityId: id,
            changes: { fields: Object.keys(data) },
          });
          return result;
        });
        return reply.status(200).send({ data: updated });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update scheduled report' });
      }
    },
  );

  // POST /api/v1/reports/scheduled/:id/run — execute now, snapshot summary
  server.post(
    '/api/v1/reports/scheduled/:id/run',
    { preHandler: [server.authenticate, requirePermission(Permissions.REPORT_GENERATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Report not found' });
      try {
        const result = await runScheduledReport(tenantId, id, sub);
        return reply.status(200).send({ data: { run_id: result.run.id, ran_at: result.run.ran_at, summary: result.summary, deliveries: result.deliveries } });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to run report' });
      }
    },
  );

  // GET /api/v1/reports/scheduled/:id/runs — run history
  server.get(
    '/api/v1/reports/scheduled/:id/runs',
    { preHandler: [server.authenticate, requirePermission(Permissions.REPORT_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { id } = request.params as { id: string };
      const pg = listParams(request);
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Report not found' });
      try {
        const runs = await withTenantTx(prisma, tenantId, async (tx) =>
          tx.scheduledReportRun.findMany({ where: { report_id: id }, orderBy: { ran_at: 'desc' }, skip: pg.skip, take: pg.limit + 1 }),
        );
        const paged = listPage(runs, pg);
        return reply.status(200).send({
          data: paged.data.map((r) => ({ ...r, ran_at: r.ran_at.toISOString() })),
          page: paged.page,
          count: paged.data.length,
        });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load runs' });
      }
    },
  );
};
