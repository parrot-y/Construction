import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { requirePermission } from '../plugins/rbac';
import { getStorageDriver } from '../lib/storage';
import { enqueueExportJob } from '../jobs/queue';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXPORT_KINDS = ['financials', 'cost'] as const;

/**
 * P5.10 — queued report exports. The console POSTs here instead of hitting
 * the synchronous *.xlsx endpoints; the pg-boss worker builds the workbook
 * off the request path, stores it via the storage driver, and the client
 * polls GET /export-jobs/:id until READY then downloads.
 */
export const exportJobsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  for (const kind of EXPORT_KINDS) {
    server.post(
      `/api/v1/projects/:projectId/reports/${kind}/export`,
      { preHandler: [server.authenticate, requirePermission(Permissions.REPORT_GENERATE)] },
      async (request, reply) => {
        const { tenantId, sub } = request.user;
        const { projectId } = request.params as { projectId: string };
        if (!UUID_REGEX.test(projectId)) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
        }
        const project = await withTenantTx(prisma, tenantId, (tx) =>
          tx.project.findFirst({ where: { id: projectId }, select: { id: true } }),
        );
        if (!project) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
        }
        const job = await withTenantTx(prisma, tenantId, (tx) =>
          tx.exportJob.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              report_kind: kind,
              requested_by_id: sub,
            },
          }),
        );
        // Best-effort enqueue; if the queue is down the job stays PENDING and
        // the sweep reaper picks it up once pg-boss is back.
        await enqueueExportJob(job.id);
        return reply.status(202).send({ data: { jobId: job.id, status: job.status } });
      },
    );
  }

  server.get(
    '/api/v1/export-jobs/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.REPORT_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Export job not found' });
      }
      const job = await withTenantTx(prisma, tenantId, (tx) =>
        tx.exportJob.findFirst({ where: { id } }),
      );
      if (!job) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Export job not found' });
      }
      return reply.send({
        data: {
          id: job.id,
          report_kind: job.report_kind,
          project_id: job.project_id,
          status: job.status,
          filename: job.filename,
          size_bytes: job.size_bytes,
          error: job.error,
          created_at: job.created_at,
          finished_at: job.finished_at,
        },
      });
    },
  );

  server.get(
    '/api/v1/export-jobs/:id/download',
    { preHandler: [server.authenticate, requirePermission(Permissions.REPORT_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Export job not found' });
      }
      const job = await withTenantTx(prisma, tenantId, (tx) =>
        tx.exportJob.findFirst({ where: { id } }),
      );
      if (!job || job.status !== 'READY' || !job.storage_key || !job.filename) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Export file not ready' });
      }
      // storage_key is server-generated (exports/<tenant>/<job>/<file>); the
      // prefix check is defence-in-depth against path traversal on local disk.
      if (!job.storage_key.startsWith(`exports/${tenantId}/`)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Export file not found' });
      }
      const buffer = await getStorageDriver().get(job.storage_key);
      if (!buffer) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Export file not found' });
      }
      reply.header('Content-Type', XLSX_CONTENT_TYPE);
      reply.header('Content-Disposition', `attachment; filename="${job.filename}"`);
      return reply.send(buffer);
    },
  );
};
