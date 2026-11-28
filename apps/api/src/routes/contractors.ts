import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { ContractorFirmInputSchema, UpdateContractorFirmSchema } from '@construction/validation';
import { requirePermission } from '../plugins/rbac';
import { listParams, listPage } from '../lib/pagination';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serialize(f: any) {
  return {
    id: f.id,
    firmName: f.firm_name,
    kraPin: f.kra_pin,
    contactPerson: f.contact_person,
    phone: f.phone,
    email: f.email,
    workCategories: f.work_categories ?? [],
    approvalStatus: f.approval_status,
    approvedBy: f.approved_by,
    approvedAt: f.approved_at?.toISOString?.() ?? f.approved_at,
    statusReason: f.status_reason,
    notes: f.notes,
    isActive: f.is_active,
    packageCount: f._count?.packages ?? f.packageCount ?? undefined,
    createdBy: f.created_by,
    createdAt: f.created_at?.toISOString?.() ?? f.created_at,
    updatedAt: f.updated_at?.toISOString?.() ?? f.updated_at,
  };
}

const FIRM_INCLUDE = {
  _count: { select: { packages: true } },
};

/** Legal approval-status transitions. BLACKLISTED is terminal. */
const APPROVAL_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['APPROVED'],
  APPROVED: ['SUSPENDED', 'BLACKLISTED'],
  SUSPENDED: ['APPROVED', 'BLACKLISTED'],
  BLACKLISTED: [],
};

export const contractorRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/contractors — filters: q/status/category + pagination.
  server.get(
    '/api/v1/contractors',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const q = request.query as Record<string, string | undefined>;
      const pg = listParams(request);
      try {
        const where: Record<string, unknown> = { tenant_id: tenantId, is_active: true };
        if (q.status) where.approval_status = q.status.toUpperCase();
        if (q.category) where.work_categories = { has: q.category.toUpperCase() };
        const term = q.q?.trim();
        if (term) {
          where.OR = [
            { firm_name: { contains: term, mode: 'insensitive' } },
            { kra_pin: { contains: term, mode: 'insensitive' } },
            { contact_person: { contains: term, mode: 'insensitive' } },
          ];
        }
        const rows = await withTenantTx(prisma, tenantId, (tx) =>
          tx.contractorFirm.findMany({
            where,
            include: FIRM_INCLUDE,
            orderBy: { firm_name: 'asc' },
            skip: pg.skip,
            take: pg.limit + 1,
          }),
        );
        const paged = listPage(rows, pg);
        return reply.send({ contractors: paged.data.map(serialize), page: paged.page });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list contractors' });
      }
    },
  );

  // GET /api/v1/contractors/:id — firm detail + linked packages.
  server.get(
    '/api/v1/contractors/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Contractor not found' });
      try {
        const firm = await withTenantTx(prisma, tenantId, (tx) =>
          tx.contractorFirm.findFirst({
            where: { id, tenant_id: tenantId },
            include: {
              _count: { select: { packages: true } },
              packages: {
                orderBy: { created_at: 'desc' },
                take: 50,
                include: { project: { select: { id: true, name: true, code: true } } },
              },
            },
          }),
        );
        if (!firm) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Contractor not found' });
        return reply.send({
          contractor: serialize(firm),
          packages: firm.packages.map((p: any) => ({
            id: p.id,
            projectId: p.project_id,
            projectName: p.project?.name ?? null,
            tradeCategory: p.trade_category,
            subcontractSum: p.subcontract_sum?.toString?.() ?? p.subcontract_sum,
            status: p.status,
            createdAt: p.created_at?.toISOString?.() ?? p.created_at,
          })),
        });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load contractor' });
      }
    },
  );

  // POST /api/v1/contractors — register a firm (starts PENDING).
  server.post(
    '/api/v1/contractors',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = ContractorFirmInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid contractor', details: parsed.error.errors });
      }
      const d = parsed.data;
      const kraPin = d.kraPin?.trim() || null;
      try {
        const firm = await withTenantTx(prisma, tenantId, async (tx) => {
          const created = await tx.contractorFirm.create({
            data: {
              tenant_id: tenantId,
              firm_name: d.firmName.trim(),
              kra_pin: kraPin,
              contact_person: d.contactPerson ?? null,
              phone: d.phone ?? null,
              email: d.email || null,
              work_categories: d.workCategories.map((c) => c.trim().toUpperCase()).filter(Boolean),
              notes: d.notes ?? null,
              created_by: sub,
            },
            include: FIRM_INCLUDE,
          });
          await recordAuditLog(tx, {
            tenantId, actorId: sub, action: 'CREATE', entityType: 'CONTRACTOR_FIRM', entityId: created.id,
            changes: { firmName: created.firm_name, kraPin: created.kra_pin },
          });
          return created;
        });
        return reply.status(201).send({ contractor: serialize(firm) });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: 'A contractor with this KRA PIN already exists' });
        }
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create contractor' });
      }
    },
  );

  // PATCH /api/v1/contractors/:id — edit fields and/or transition approval status.
  server.patch(
    '/api/v1/contractors/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_APPROVE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Contractor not found' });
      const parsed = UpdateContractorFirmSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid contractor update', details: parsed.error.errors });
      }
      const d = parsed.data;
      try {
        const firm = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.contractorFirm.findFirst({ where: { id, tenant_id: tenantId } });
          if (!existing) throw { status: 404, message: 'Contractor not found' };

          const data: Record<string, unknown> = {};
          const changes: Record<string, unknown> = {};

          if (d.firmName !== undefined) { data.firm_name = d.firmName.trim(); changes.firmName = data.firm_name; }
          if (d.kraPin !== undefined) { data.kra_pin = d.kraPin?.trim() || null; changes.kraPin = data.kra_pin; }
          if (d.contactPerson !== undefined) { data.contact_person = d.contactPerson ?? null; changes.contactPerson = data.contact_person; }
          if (d.phone !== undefined) { data.phone = d.phone ?? null; changes.phone = data.phone; }
          if (d.email !== undefined) { data.email = d.email || null; changes.email = data.email; }
          if (d.workCategories !== undefined) {
            data.work_categories = d.workCategories.map((c) => c.trim().toUpperCase()).filter(Boolean);
            changes.workCategories = data.work_categories;
          }
          if (d.notes !== undefined) { data.notes = d.notes ?? null; changes.notes = data.notes; }
          if (d.isActive !== undefined) { data.is_active = d.isActive; changes.isActive = d.isActive; }

          if (d.approvalStatus !== undefined && d.approvalStatus !== existing.approval_status) {
            const allowed = APPROVAL_TRANSITIONS[existing.approval_status] ?? [];
            if (!allowed.includes(d.approvalStatus)) {
              throw { status: 409, message: `Cannot move a contractor from ${existing.approval_status} to ${d.approvalStatus}` };
            }
            data.approval_status = d.approvalStatus;
            data.status_reason = d.statusReason ?? null;
            changes.approval = { from: existing.approval_status, to: d.approvalStatus, reason: d.statusReason ?? null };
            if (d.approvalStatus === 'APPROVED') {
              data.approved_by = sub;
              data.approved_at = new Date();
            } else {
              data.approved_by = null;
              data.approved_at = null;
            }
          } else if (d.statusReason !== undefined && d.approvalStatus === undefined) {
            data.status_reason = d.statusReason ?? null;
          }

          const updated = await tx.contractorFirm.update({ where: { id }, data, include: FIRM_INCLUDE });
          await recordAuditLog(tx, {
            tenantId, actorId: sub, action: 'UPDATE', entityType: 'CONTRACTOR_FIRM', entityId: id,
            changes,
          });
          return updated;
        });
        return reply.send({ contractor: serialize(firm) });
      } catch (err: any) {
        if (err?.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        if (err?.code === 'P2002') {
          return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: 'A contractor with this KRA PIN already exists' });
        }
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update contractor' });
      }
    },
  );
};
