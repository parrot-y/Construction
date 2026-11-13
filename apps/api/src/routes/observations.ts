import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { listParams, listPage } from '../lib/pagination';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import {
  CreateObservationSchema,
  UpdateObservationStatusSchema,
  CreateCorrectiveActionSchema,
  UpdateCorrectiveActionSchema,
} from '@construction/validation';
import { requirePermission } from '../plugins/rbac';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OBS_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_REVIEW', 'CLOSED'],
  IN_REVIEW: ['CLOSED', 'OPEN'],
  CLOSED: [],
};

function obsRef(n: number) {
  return `OBS-${String(n).padStart(3, '0')}`;
}

export const observationsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/projects/:projectId/observations
  server.get(
    '/api/v1/projects/:projectId/observations',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      const { status, type } = request.query as { status?: string; type?: string };
      const pg = listParams(request);
      if (!UUID_REGEX.test(projectId)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });

      try {
        const data = await withTenantTx(prisma, tenantId, async (tx) => {
          const rows = await tx.siteObservation.findMany({
            where: {
              project_id: projectId,
              ...(status ? { status } : {}),
              ...(type ? { type } : {}),
            },
            include: { corrective_actions: { select: { id: true, title: true, status: true, due_date: true, owner_name: true } } },
            orderBy: { created_at: 'desc' },
            skip: pg.skip,
            take: pg.limit + 1,
          });
          return rows.map((o) => ({ ...o, ref: obsRef(o.obs_number), created_at: o.created_at.toISOString(), updated_at: o.updated_at.toISOString(), closed_at: o.closed_at?.toISOString() ?? null }));
        });
        const paged = listPage(data, pg);
        return reply.status(200).send({ data: paged.data, page: paged.page, count: paged.data.length });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list observations' });
      }
    },
  );

  // POST /api/v1/projects/:projectId/observations
  server.post(
    '/api/v1/projects/:projectId/observations',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };
      if (!UUID_REGEX.test(projectId)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });

      const parsed = CreateObservationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid observation', details: parsed.error.errors });
      }
      const data = parsed.data;
      const raisedBy = (request.user as any).full_name || (request.user as any).email || 'Site team';

      try {
        const created = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const last = await tx.siteObservation.findFirst({
            where: { project_id: projectId },
            orderBy: { obs_number: 'desc' },
            select: { obs_number: true },
          });
          const obsNumber = (last?.obs_number ?? 0) + 1;

          const obs = await tx.siteObservation.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              obs_number: obsNumber,
              title: data.title,
              type: data.type,
              priority: data.priority,
              location: data.location ?? null,
              description: data.description,
              raised_by_id: sub,
              raised_by_name: raisedBy,
            },
          });
          await recordAuditLog(tx, {
            tenantId, projectId, actorId: sub,
            action: 'OBSERVATION_CREATED', entityType: 'SiteObservation', entityId: obs.id,
            changes: { ref: obsRef(obsNumber), type: data.type, priority: data.priority },
          });
          return { ...obs, ref: obsRef(obsNumber) };
        });
        return reply.status(201).send({ data: created });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create observation' });
      }
    },
  );

  // GET /api/v1/projects/:projectId/observations/:obsId
  server.get(
    '/api/v1/projects/:projectId/observations/:obsId',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, obsId } = request.params as { projectId: string; obsId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(obsId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Observation not found' });
      }
      try {
        const obs = await withTenantTx(prisma, tenantId, async (tx) =>
          tx.siteObservation.findFirst({
            where: { id: obsId, project_id: projectId },
            include: { corrective_actions: true },
          }),
        );
        if (!obs) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Observation not found' });
        return reply.status(200).send({ data: { ...obs, ref: obsRef(obs.obs_number) } });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load observation' });
      }
    },
  );

  // PATCH status — guarded transition
  server.patch(
    '/api/v1/projects/:projectId/observations/:obsId/status',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, obsId } = request.params as { projectId: string; obsId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(obsId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Observation not found' });
      }
      const parsed = UpdateObservationStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid status update', details: parsed.error.errors });
      }
      const { status } = parsed.data;
      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const obs = await tx.siteObservation.findFirst({ where: { id: obsId, project_id: projectId } });
          if (!obs) throw { status: 404, message: 'Observation not found' };
          const allowed = OBS_TRANSITIONS[obs.status] ?? [];
          if (!allowed.includes(status)) {
            throw { status: 400, message: `Cannot transition ${obs.status} → ${status}` };
          }
          const result = await tx.siteObservation.update({
            where: { id: obsId },
            data: {
              status,
              closed_at: status === 'CLOSED' ? new Date() : null,
              closed_by_name: status === 'CLOSED' ? ((request.user as any).full_name || (request.user as any).email || 'Site team') : null,
            },
          });
          await recordAuditLog(tx, {
            tenantId, projectId, actorId: sub,
            action: 'OBSERVATION_STATUS_CHANGED', entityType: 'SiteObservation', entityId: obsId,
            changes: { from: obs.status, to: status, ref: obsRef(obs.obs_number) },
          });
          return { ...result, ref: obsRef(result.obs_number) };
        });
        return reply.status(200).send({ data: updated });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update observation' });
      }
    },
  );

  // ---- Corrective actions (action plans) ----

  // GET /api/v1/projects/:projectId/corrective-actions
  server.get(
    '/api/v1/projects/:projectId/corrective-actions',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      const { status } = request.query as { status?: string };
      const pg = listParams(request);
      if (!UUID_REGEX.test(projectId)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      try {
        const data = await withTenantTx(prisma, tenantId, async (tx) =>
          tx.correctiveAction.findMany({
            where: { project_id: projectId, ...(status ? { status } : {}) },
            include: { observation: { select: { id: true, obs_number: true, title: true } } },
            orderBy: { created_at: 'desc' },
            skip: pg.skip,
            take: pg.limit + 1,
          }),
        );
        const now = new Date();
        const paged = listPage(data, pg);
        return reply.status(200).send({
          data: paged.data.map((a) => ({
            ...a,
            effective_status: a.status === 'ACTIVE' && a.due_date && a.due_date < now ? 'OVERDUE' : a.status,
            created_at: a.created_at.toISOString(),
            updated_at: a.updated_at.toISOString(),
            due_date: a.due_date?.toISOString().slice(0, 10) ?? null,
            completed_at: a.completed_at?.toISOString() ?? null,
          })),
          page: paged.page,
          count: paged.data.length,
        });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list corrective actions' });
      }
    },
  );

  // POST /api/v1/projects/:projectId/corrective-actions
  server.post(
    '/api/v1/projects/:projectId/corrective-actions',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };
      if (!UUID_REGEX.test(projectId)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });

      const parsed = CreateCorrectiveActionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid corrective action', details: parsed.error.errors });
      }
      const data = parsed.data;

      try {
        const created = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };
          if (data.observationId) {
            const obs = await tx.siteObservation.findFirst({ where: { id: data.observationId, project_id: projectId } });
            if (!obs) throw { status: 404, message: 'Linked observation not found' };
          }
          const action = await tx.correctiveAction.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              observation_id: data.observationId ?? null,
              title: data.title,
              owner_name: data.ownerName,
              due_date: data.dueDate ? new Date(`${data.dueDate}T00:00:00.000Z`) : null,
              source_ref: data.sourceRef ?? null,
              steps: data.steps,
              created_by_id: sub,
            },
          });
          await recordAuditLog(tx, {
            tenantId, projectId, actorId: sub,
            action: 'CORRECTIVE_ACTION_CREATED', entityType: 'CorrectiveAction', entityId: action.id,
            changes: { title: data.title, owner: data.ownerName, observationId: data.observationId ?? null },
          });
          return action;
        });
        return reply.status(201).send({ data: created });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create corrective action' });
      }
    },
  );

  // PATCH /api/v1/projects/:projectId/corrective-actions/:actionId
  server.patch(
    '/api/v1/projects/:projectId/corrective-actions/:actionId',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, actionId } = request.params as { projectId: string; actionId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(actionId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Corrective action not found' });
      }
      const parsed = UpdateCorrectiveActionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid update', details: parsed.error.errors });
      }
      const data = parsed.data;
      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const action = await tx.correctiveAction.findFirst({ where: { id: actionId, project_id: projectId } });
          if (!action) throw { status: 404, message: 'Corrective action not found' };
          if (action.status === 'COMPLETED' && data.status === 'ACTIVE') {
            throw { status: 400, message: 'Cannot reopen a completed corrective action' };
          }
          const result = await tx.correctiveAction.update({
            where: { id: actionId },
            data: {
              ...(data.status !== undefined ? { status: data.status, completed_at: data.status === 'COMPLETED' ? new Date() : null } : {}),
              ...(data.steps !== undefined ? { steps: data.steps } : {}),
              ...(data.dueDate !== undefined ? { due_date: data.dueDate === null ? null : new Date(`${data.dueDate}T00:00:00.000Z`) } : {}),
              ...(data.ownerName !== undefined ? { owner_name: data.ownerName } : {}),
            },
          });
          await recordAuditLog(tx, {
            tenantId, projectId, actorId: sub,
            action: 'CORRECTIVE_ACTION_UPDATED', entityType: 'CorrectiveAction', entityId: actionId,
            changes: { fields: Object.keys(data) },
          });
          return result;
        });
        return reply.status(200).send({ data: updated });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update corrective action' });
      }
    },
  );
};
