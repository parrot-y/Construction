import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { CreateGatePassSchema, GatePassActionSchema } from '@construction/validation';
import { requirePermission } from '../plugins/rbac';
import { listParams, listPage } from '../lib/pagination';
import { nextDocumentNumber } from '../lib/counters';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serialize(p: any) {
  return {
    id: p.id,
    passNumber: p.pass_number,
    projectId: p.project_id,
    storeLocation: p.store_location,
    issuedToName: p.issued_to_name,
    issuedToPhone: p.issued_to_phone,
    destination: p.destination,
    vehicleRegistration: p.vehicle_registration,
    purpose: p.purpose,
    items: p.items,
    status: p.status,
    authorizedBy: p.authorized_by,
    authorizedAt: p.authorized_at?.toISOString?.() ?? p.authorized_at,
    exitedAt: p.exited_at?.toISOString?.() ?? p.exited_at,
    exitConfirmedBy: p.exit_confirmed_by,
    cancelReason: p.cancel_reason,
    notes: p.notes,
    createdBy: p.created_by,
    createdAt: p.created_at?.toISOString?.() ?? p.created_at,
    updatedAt: p.updated_at?.toISOString?.() ?? p.updated_at,
  };
}

const PROJECT_INCLUDE = { project: { select: { id: true, name: true, code: true } } };

function withProjectName(p: any) {
  const s = serialize(p);
  return { ...s, projectName: p.project?.name ?? null, projectCode: p.project?.code ?? null };
}

/** Legal status transitions for a gate pass: action → { fromStatus: toStatus }. */
const TRANSITIONS: Record<string, Record<string, string>> = {
  authorize: { PENDING: 'AUTHORIZED' },
  exit: { AUTHORIZED: 'EXITED' },
  cancel: { PENDING: 'CANCELLED', AUTHORIZED: 'CANCELLED' },
};

export const gatePassRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/gate-passes — filters: projectId/status/store/q + pagination.
  server.get(
    '/api/v1/gate-passes',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const q = request.query as Record<string, string | undefined>;
      const pg = listParams(request);
      try {
        const where: Record<string, unknown> = { tenant_id: tenantId };
        if (q.projectId && UUID_REGEX.test(q.projectId)) where.project_id = q.projectId;
        if (q.status) where.status = q.status.toUpperCase();
        if (q.store) where.store_location = { contains: q.store, mode: 'insensitive' };
        const term = q.q?.trim();
        if (term) {
          where.OR = [
            { issued_to_name: { contains: term, mode: 'insensitive' } },
            { destination: { contains: term, mode: 'insensitive' } },
            { vehicle_registration: { contains: term, mode: 'insensitive' } },
            { pass_number: { contains: term, mode: 'insensitive' } },
          ];
        }
        const rows = await withTenantTx(prisma, tenantId, (tx) =>
          tx.gatePass.findMany({
            where,
            include: PROJECT_INCLUDE,
            orderBy: { created_at: 'desc' },
            skip: pg.skip,
            take: pg.limit + 1,
          }),
        );
        const paged = listPage(rows, pg);
        return reply.send({ passes: paged.data.map(withProjectName), page: paged.page });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list gate passes' });
      }
    },
  );

  // GET /api/v1/gate-passes/:id
  server.get(
    '/api/v1/gate-passes/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Gate pass not found' });
      try {
        const pass = await withTenantTx(prisma, tenantId, (tx) =>
          tx.gatePass.findFirst({ where: { id, tenant_id: tenantId }, include: PROJECT_INCLUDE }),
        );
        if (!pass) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Gate pass not found' });
        return reply.send({ pass: withProjectName(pass) });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load gate pass' });
      }
    },
  );

  // POST /api/v1/gate-passes — create a PENDING pass; pass number is atomic.
  server.post(
    '/api/v1/gate-passes',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = CreateGatePassSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid gate pass', details: parsed.error.errors });
      }
      const d = parsed.data;
      try {
        const pass = await withTenantTx(prisma, tenantId, async (tx) => {
          if (d.projectId) {
            const proj = await tx.project.findFirst({ where: { id: d.projectId, tenant_id: tenantId } });
            if (!proj) throw { status: 404, message: 'Project not found' };
          }
          const n = await nextDocumentNumber(tx, tenantId, 'GATE_PASS');
          const p = await tx.gatePass.create({
            data: {
              tenant_id: tenantId,
              pass_number: `GATE-${String(n).padStart(4, '0')}`,
              project_id: d.projectId ?? null,
              store_location: d.storeLocation ?? null,
              issued_to_name: d.issuedToName,
              issued_to_phone: d.issuedToPhone ?? null,
              destination: d.destination ?? null,
              vehicle_registration: d.vehicleRegistration ?? null,
              purpose: d.purpose ?? null,
              items: d.items,
              notes: d.notes ?? null,
              created_by: sub,
            },
            include: PROJECT_INCLUDE,
          });
          await recordAuditLog(tx, {
            tenantId, actorId: sub, action: 'CREATE', entityType: 'GATE_PASS', entityId: p.id,
            changes: { passNumber: p.pass_number, issuedTo: p.issued_to_name, items: d.items.length },
          });
          return p;
        });
        return reply.status(201).send({ pass: withProjectName(pass) });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create gate pass' });
      }
    },
  );

  // POST /api/v1/gate-passes/:id/:action — authorize | exit | cancel.
  for (const action of ['authorize', 'exit', 'cancel'] as const) {
    server.post(
      `/api/v1/gate-passes/:id/${action}`,
      {
        preHandler: [
          server.authenticate,
          requirePermission(action === 'authorize' || action === 'cancel' ? Permissions.COST_APPROVE : Permissions.COST_CREATE),
        ],
      },
      async (request, reply) => {
        const { tenantId, sub } = request.user;
        const { id } = request.params as { id: string };
        if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Gate pass not found' });
        const parsed = GatePassActionSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid gate pass action', details: parsed.error.errors });
        }
        const d = parsed.data;
        try {
          const pass = await withTenantTx(prisma, tenantId, async (tx) => {
            const existing = await tx.gatePass.findFirst({ where: { id, tenant_id: tenantId } });
            if (!existing) throw { status: 404, message: 'Gate pass not found' };
            const nextStatus = TRANSITIONS[action]?.[existing.status];
            if (!nextStatus) {
              throw { status: 409, message: `Cannot ${action} a gate pass in status ${existing.status}` };
            }
            const data: Record<string, unknown> = { status: nextStatus };
            if (action === 'authorize') {
              data.authorized_by = sub;
              data.authorized_at = new Date();
            } else if (action === 'exit') {
              data.exited_at = new Date();
              data.exit_confirmed_by = sub;
              if (d.vehicleRegistration) data.vehicle_registration = d.vehicleRegistration;
            } else {
              data.cancel_reason = d.reason ?? null;
            }
            const updated = await tx.gatePass.update({ where: { id }, data, include: PROJECT_INCLUDE });
            await recordAuditLog(tx, {
              tenantId, actorId: sub, action: action.toUpperCase(), entityType: 'GATE_PASS', entityId: id,
              changes: { from: existing.status, to: nextStatus, ...(d.reason ? { reason: d.reason } : {}) },
            });
            return updated;
          });
          return reply.send({ pass: withProjectName(pass) });
        } catch (err: any) {
          if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
          server.log.error(err);
          return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: `Failed to ${action} gate pass` });
        }
      },
    );
  }
};
