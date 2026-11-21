import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { listParams, listPage } from '../lib/pagination';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import type { Prisma } from '@construction/db';
import { Permissions } from '@construction/permissions';
import {
  CreateChecklistTemplateSchema,
  CreateChecklistAssignmentSchema,
  SubmitChecklistResponseSchema,
  ReviewChecklistAssignmentSchema,
} from '@construction/validation';
import { requirePermission } from '../plugins/rbac';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ASSIGN_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS', 'DRAFT'],
  IN_PROGRESS: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: ['IN_PROGRESS'],
};

/**
 * Gate-5 G5-6: Checklist templates + assignments — observed
 * Checklists > New Template (15 trades, question builder, global
 * flag) and Assignments > Assign a form (per-trade lifecycle).
 */
export const checklistsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // ---- Templates ----

  // GET /api/v1/checklists/templates?trade=&kind=&q=
  server.get(
    '/api/v1/checklists/templates',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { trade, kind, q } = request.query as { trade?: string; kind?: string; q?: string };
      const pg = listParams(request);
      try {
        const data = await withTenantTx(prisma, tenantId, async (tx) =>
          tx.checklistTemplate.findMany({
            where: {
              status: 'ACTIVE',
              ...(trade ? { trade_category: trade } : {}),
              ...(kind ? { kind } : {}),
              ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
            },
            orderBy: { created_at: 'desc' },
            skip: pg.skip,
            take: pg.limit + 1,
          }),
        );
        const paged = listPage(data, pg);
        return reply.status(200).send({ data: paged.data, page: paged.page, count: paged.data.length });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list templates' });
      }
    },
  );

  // POST /api/v1/checklists/templates
  server.post(
    '/api/v1/checklists/templates',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = CreateChecklistTemplateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid template', details: parsed.error.errors });
      }
      const data = parsed.data;
      const author = (request.user as any).full_name || (request.user as any).email || 'Team member';
      try {
        const tpl = await withTenantTx(prisma, tenantId, async (tx) => {
          const t = await tx.checklistTemplate.create({
            data: {
              tenant_id: tenantId,
              title: data.title,
              trade_category: data.tradeCategory,
              kind: data.kind,
              is_global: data.isGlobal,
              questions: data.questions,
              created_by_id: sub,
              created_by_name: author,
            },
          });
          await recordAuditLog(tx, {
            tenantId, actorId: sub,
            action: 'CHECKLIST_TEMPLATE_CREATED', entityType: 'ChecklistTemplate', entityId: t.id,
            changes: { title: data.title, trade: data.tradeCategory, kind: data.kind, questions: data.questions.length },
          });
          return t;
        });
        return reply.status(201).send({ data: tpl });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create template' });
      }
    },
  );

  // PATCH /api/v1/checklists/templates/:id — edit / archive
  server.patch(
    '/api/v1/checklists/templates/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Template not found' });
      const body = request.body as { title?: string; questions?: Prisma.InputJsonValue; status?: string };
      try {
        const tpl = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.checklistTemplate.findUnique({ where: { id } });
          if (!existing) throw { status: 404, message: 'Template not found' };
          const updated = await tx.checklistTemplate.update({
            where: { id },
            data: {
              ...(body.title !== undefined ? { title: body.title } : {}),
              ...(body.questions !== undefined ? { questions: body.questions } : {}),
              ...(body.status !== undefined ? { status: body.status } : {}),
            },
          });
          await recordAuditLog(tx, {
            tenantId, actorId: sub,
            action: 'CHECKLIST_TEMPLATE_UPDATED', entityType: 'ChecklistTemplate', entityId: id,
            changes: { fields: Object.keys(body) },
          });
          return updated;
        });
        return reply.status(200).send({ data: tpl });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update template' });
      }
    },
  );

  // ---- Assignments ----

  // GET /api/v1/projects/:projectId/checklist-assignments?trade=&status=
  server.get(
    '/api/v1/projects/:projectId/checklist-assignments',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      const { trade, status } = request.query as { trade?: string; status?: string };
      const pg = listParams(request);
      if (!UUID_REGEX.test(projectId)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      try {
        const data = await withTenantTx(prisma, tenantId, async (tx) =>
          tx.checklistAssignment.findMany({
            where: {
              project_id: projectId,
              ...(trade ? { trade } : {}),
              ...(status ? { status } : {}),
            },
            orderBy: { created_at: 'desc' },
            skip: pg.skip,
            take: pg.limit + 1,
          }),
        );
        const paged = listPage(data, pg);
        return reply.status(200).send({
          data: paged.data.map((a) => ({
            ...a,
            due_date: a.due_date?.toISOString().slice(0, 10) ?? null,
            submitted_at: a.submitted_at?.toISOString() ?? null,
            created_at: a.created_at.toISOString(),
            updated_at: a.updated_at.toISOString(),
          })),
          page: paged.page,
          count: paged.data.length,
        });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list assignments' });
      }
    },
  );

  // POST /api/v1/projects/:projectId/checklist-assignments — assign a form/template to a trade
  server.post(
    '/api/v1/projects/:projectId/checklist-assignments',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };
      if (!UUID_REGEX.test(projectId)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      const parsed = CreateChecklistAssignmentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid assignment', details: parsed.error.errors });
      }
      const data = parsed.data;
      try {
        const assignment = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };
          if (data.templateId) {
            const tpl = await tx.checklistTemplate.findFirst({ where: { id: data.templateId, status: 'ACTIVE' } });
            if (!tpl) throw { status: 404, message: 'Template not found' };
          }
          const a = await tx.checklistAssignment.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              template_id: data.templateId ?? null,
              title: data.title,
              trade: data.trade,
              assigned_to_name: data.assignedToName ?? null,
              due_date: data.dueDate ? new Date(`${data.dueDate}T00:00:00.000Z`) : null,
              status: 'ASSIGNED', // assigned straight away — observed lifecycle starts at Assigned
              created_by_id: sub,
            },
          });
          await recordAuditLog(tx, {
            tenantId, projectId, actorId: sub,
            action: 'CHECKLIST_ASSIGNED', entityType: 'ChecklistAssignment', entityId: a.id,
            changes: { title: data.title, trade: data.trade, templateId: data.templateId ?? null },
          });
          return a;
        });
        return reply.status(201).send({ data: assignment });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to assign checklist' });
      }
    },
  );

  // GET /api/v1/projects/:projectId/checklist-assignments/:id — detail incl template questions
  server.get(
    '/api/v1/projects/:projectId/checklist-assignments/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, id } = request.params as { projectId: string; id: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Assignment not found' });
      }
      try {
        const data = await withTenantTx(prisma, tenantId, async (tx) => {
          const a = await tx.checklistAssignment.findFirst({ where: { id, project_id: projectId } });
          if (!a) throw { status: 404, message: 'Assignment not found' };
          let template = null;
          if (a.template_id) {
            template = await tx.checklistTemplate.findUnique({ where: { id: a.template_id } });
          }
          return { ...a, template };
        });
        return reply.status(200).send({ data });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load assignment' });
      }
    },
  );

  // POST /api/v1/projects/:projectId/checklist-assignments/:id/start — ASSIGNED→IN_PROGRESS
  server.post(
    '/api/v1/projects/:projectId/checklist-assignments/:id/start',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, id } = request.params as { projectId: string; id: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Assignment not found' });
      }
      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const a = await tx.checklistAssignment.findFirst({ where: { id, project_id: projectId } });
          if (!a) throw { status: 404, message: 'Assignment not found' };
          const allowed = ASSIGN_TRANSITIONS[a.status] ?? [];
          if (!allowed.includes('IN_PROGRESS')) throw { status: 400, message: `Cannot start from ${a.status}` };
          const u = await tx.checklistAssignment.update({ where: { id }, data: { status: 'IN_PROGRESS' } });
          await recordAuditLog(tx, { tenantId, projectId, actorId: sub, action: 'CHECKLIST_STARTED', entityType: 'ChecklistAssignment', entityId: id, changes: { from: a.status, to: 'IN_PROGRESS' } });
          return u;
        });
        return reply.status(200).send({ data: updated });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to start assignment' });
      }
    },
  );

  // POST /api/v1/projects/:projectId/checklist-assignments/:id/submit — IN_PROGRESS→SUBMITTED w/ responses
  server.post(
    '/api/v1/projects/:projectId/checklist-assignments/:id/submit',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, id } = request.params as { projectId: string; id: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Assignment not found' });
      }
      const parsed = SubmitChecklistResponseSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid responses', details: parsed.error.errors });
      }
      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const a = await tx.checklistAssignment.findFirst({ where: { id, project_id: projectId } });
          if (!a) throw { status: 404, message: 'Assignment not found' };
          if (a.status !== 'IN_PROGRESS' && a.status !== 'ASSIGNED') {
            throw { status: 400, message: `Cannot submit from ${a.status}` };
          }
          const u = await tx.checklistAssignment.update({
            where: { id },
            data: { status: 'SUBMITTED', responses: parsed.data.responses, submitted_at: new Date() },
          });
          await recordAuditLog(tx, { tenantId, projectId, actorId: sub, action: 'CHECKLIST_SUBMITTED', entityType: 'ChecklistAssignment', entityId: id, changes: { responseCount: parsed.data.responses.length } });
          return u;
        });
        return reply.status(200).send({ data: updated });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to submit' });
      }
    },
  );

  // POST /api/v1/projects/:projectId/checklist-assignments/:id/review — SUBMITTED→APPROVED/REJECTED
  server.post(
    '/api/v1/projects/:projectId/checklist-assignments/:id/review',
    { preHandler: [server.authenticate, requirePermission(Permissions.INSPECTION_REVIEW)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, id } = request.params as { projectId: string; id: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Assignment not found' });
      }
      const parsed = ReviewChecklistAssignmentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid review', details: parsed.error.errors });
      }
      const { decision, notes } = parsed.data;
      const reviewer = (request.user as any).full_name || (request.user as any).email || 'Reviewer';
      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const a = await tx.checklistAssignment.findFirst({ where: { id, project_id: projectId } });
          if (!a) throw { status: 404, message: 'Assignment not found' };
          if (a.status !== 'SUBMITTED') throw { status: 400, message: `Cannot review from ${a.status}` };
          const u = await tx.checklistAssignment.update({
            where: { id },
            data: {
              status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
              reviewed_by_name: reviewer,
              review_notes: notes ?? null,
            },
          });
          await recordAuditLog(tx, { tenantId, projectId, actorId: sub, action: 'CHECKLIST_REVIEWED', entityType: 'ChecklistAssignment', entityId: id, changes: { decision, notes: notes ?? null } });
          return u;
        });
        return reply.status(200).send({ data: updated });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to review' });
      }
    },
  );
};
