import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { CreateCorrespondenceSchema, UpdateCorrespondenceSchema } from '@construction/validation';
import { requirePermission } from '../plugins/rbac';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corrRef(n: number) {
  return `COR-${String(n).padStart(3, '0')}`;
}

/**
 * Gate-5 G5-8: Correspondence log — observed Projects > Correspondence.
 * Formal project letters: LETTER/SUBMITTAL/TRANSMITTAL/NOTICE with
 * direction, parties, reference, status lifecycle.
 */
export const correspondenceRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/projects/:projectId/correspondence
  server.get(
    '/api/v1/projects/:projectId/correspondence',
    { preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      const { type, direction, status, q } = request.query as { type?: string; direction?: string; status?: string; q?: string };
      if (!UUID_REGEX.test(projectId)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      try {
        const data = await withTenantTx(prisma, tenantId, async (tx) => {
          const rows = await tx.correspondenceItem.findMany({
            where: {
              project_id: projectId,
              ...(type ? { type } : {}),
              ...(direction ? { direction } : {}),
              ...(status ? { status } : {}),
              ...(q ? { OR: [{ subject: { contains: q, mode: 'insensitive' } }, { reference: { contains: q, mode: 'insensitive' } }, { from_name: { contains: q, mode: 'insensitive' } }, { to_name: { contains: q, mode: 'insensitive' } }] } : {}),
            },
            orderBy: { created_at: 'desc' },
          });
          return rows.map((c) => ({
            ...c,
            ref: corrRef(c.corr_number),
            letter_date: c.letter_date?.toISOString().slice(0, 10) ?? null,
            created_at: c.created_at.toISOString(),
            updated_at: c.updated_at.toISOString(),
          }));
        });
        return reply.status(200).send({ data, count: data.length });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list correspondence' });
      }
    },
  );

  // POST /api/v1/projects/:projectId/correspondence
  server.post(
    '/api/v1/projects/:projectId/correspondence',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };
      if (!UUID_REGEX.test(projectId)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });

      const parsed = CreateCorrespondenceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid correspondence', details: parsed.error.errors });
      }
      const data = parsed.data;

      try {
        const created = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const last = await tx.correspondenceItem.findFirst({
            where: { project_id: projectId },
            orderBy: { corr_number: 'desc' },
            select: { corr_number: true },
          });
          const corrNumber = (last?.corr_number ?? 0) + 1;

          const item = await tx.correspondenceItem.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              corr_number: corrNumber,
              type: data.type,
              direction: data.direction,
              subject: data.subject,
              from_name: data.fromName,
              to_name: data.toName,
              reference: data.reference ?? null,
              letter_date: data.letterDate ? new Date(`${data.letterDate}T00:00:00.000Z`) : null,
              body: data.body ?? null,
              attachment_name: data.attachmentName ?? null,
              created_by_id: sub,
            },
          });
          await recordAuditLog(tx, {
            tenantId, projectId, actorId: sub,
            action: 'CORRESPONDENCE_CREATED', entityType: 'CorrespondenceItem', entityId: item.id,
            changes: { ref: corrRef(corrNumber), type: data.type, direction: data.direction },
          });
          return { ...item, ref: corrRef(corrNumber) };
        });
        return reply.status(201).send({ data: created });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create correspondence' });
      }
    },
  );

  // PATCH /api/v1/projects/:projectId/correspondence/:itemId — status + edits
  server.patch(
    '/api/v1/projects/:projectId/correspondence/:itemId',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, itemId } = request.params as { projectId: string; itemId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(itemId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Correspondence not found' });
      }
      const parsed = UpdateCorrespondenceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid update', details: parsed.error.errors });
      }
      const data = parsed.data;
      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const item = await tx.correspondenceItem.findFirst({ where: { id: itemId, project_id: projectId } });
          if (!item) throw { status: 404, message: 'Correspondence not found' };
          const result = await tx.correspondenceItem.update({
            where: { id: itemId },
            data: {
              ...(data.status !== undefined ? { status: data.status } : {}),
              ...(data.subject !== undefined ? { subject: data.subject } : {}),
              ...(data.reference !== undefined ? { reference: data.reference } : {}),
              ...(data.body !== undefined ? { body: data.body } : {}),
            },
          });
          await recordAuditLog(tx, {
            tenantId, projectId, actorId: sub,
            action: 'CORRESPONDENCE_UPDATED', entityType: 'CorrespondenceItem', entityId: itemId,
            changes: { fields: Object.keys(data), ref: corrRef(item.corr_number) },
          });
          return { ...result, ref: corrRef(result.corr_number) };
        });
        return reply.status(200).send({ data: updated });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update correspondence' });
      }
    },
  );
};
