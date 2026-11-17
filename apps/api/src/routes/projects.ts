import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions, Role } from '@construction/permissions';
import { toDecimal, Decimal } from '@construction/money';
import {
  CreateProjectDetailsSchema,
  UpdateProjectDetailsSchema,
  AssignProjectMemberSchema,
  PROJECT_TYPE_CATEGORIES,
  PROJECT_TYPE_KEYS,
  projectTypeCategory,
  subtypeBelongsToType,
} from '@construction/validation';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../plugins/rbac';
import { listParams, listPage } from '../lib/pagination';
import { TENANT_WIDE_ROLES } from '../plugins/routeAuthorization';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

const PROJECT_TYPE_KEY_SET = new Set<string>(PROJECT_TYPE_KEYS);

/** Phase 2.8: validate the taxonomy pair — unknown type or a subtype that
 *  does not belong to the chosen type is a 400, never silently stored. */
function validateProjectType(type: string | null | undefined, subtype: string | null | undefined): string | null {
  if (type == null || type === '') {
    return subtype ? 'projectSubtype requires projectType' : null;
  }
  if (!PROJECT_TYPE_KEY_SET.has(type)) return `Unknown project type "${type}"`;
  if (subtype && !subtypeBelongsToType(type, subtype)) {
    return `Subtype "${subtype}" does not belong to project type "${type}"`;
  }
  return null;
}

function pctOrThrow(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw { status: 400, message: 'Retention percentages must be between 0 and 100' };
  return n.toFixed(2);
}

/** Seed removable starter content for the chosen project type: BoQ section
 *  headers, schedule milestones and draft checklist assignments. Everything
 *  created is an ordinary row the user can edit or delete. */
async function seedProjectStarters(
  tx: any,
  tenantId: string,
  project: { id: string; project_type?: string | null; start_date?: Date | null },
): Promise<void> {
  const category = projectTypeCategory(project.project_type ?? null);
  if (!category) return;
  const start = project.start_date ?? new Date();

  if (category.starter.boqSections.length) {
    const boq = await tx.bOQ.create({
      data: { tenant_id: tenantId, project_id: project.id, version: 1, status: 'ACTIVE', source_filename: 'Starter sections (project type)' },
      select: { id: true },
    });
    await tx.bOQSection.createMany({
      data: category.starter.boqSections.map((title, i) => ({
        tenant_id: tenantId, boq_id: boq.id, order_idx: i, title,
      })),
    });
  }

  if (category.starter.milestones.length) {
    await tx.projectScheduleTask.createMany({
      data: category.starter.milestones.map((m, i) => {
        const s = new Date(start); s.setUTCDate(s.getUTCDate() + i * 14);
        const e = new Date(s); e.setUTCDate(e.getUTCDate() + 14);
        return {
          tenant_id: tenantId, project_id: project.id, wbs_phase: m.wbs,
          task_name: m.name, planned_start_date: s, planned_end_date: e,
          duration_days: 14, order_index: i, status: 'PLANNED',
        };
      }),
    });
  }

  if (category.starter.checklists.length) {
    await tx.checklistAssignment.createMany({
      data: category.starter.checklists.map((c) => ({
        tenant_id: tenantId, project_id: project.id, title: c.title, trade: c.trade, status: 'DRAFT',
      })),
    });
  }
}

export const projectRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/projects (requires PROJECT_VIEW)
  server.get(
    '/api/v1/projects',
    {
      schema: {"tags": ["Projects"], "summary": "List projects", "security": [{"cookieAuth": []}]},
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)],
    },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;

      // Non-tenant-wide roles can only act on projects they belong to —
      // requireProjectMembership 403s everything else, so the picker must
      // not offer projects the caller can't open.
      const tenantWide = TENANT_WIDE_ROLES.has(role as Role);
      const pg = listParams(request);
      const projects = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.project.findMany({
          where: tenantWide ? {} : { members: { some: { user_id: sub } } },
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, full_name: true, email: true },
                },
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip: pg.skip,
          take: pg.limit + 1,
        });
      });

      return reply.status(200).send({ ...listPage(projects, pg) });
    },
  );

  // GET /api/v1/projects/:id (requires PROJECT_VIEW)
  server.get(
    '/api/v1/projects/:id',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { id } = request.params as { id: string };

      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      const project = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.project.findUnique({
          where: { id },
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, full_name: true, email: true, phone_number: true },
                },
              },
            },
            boqs: { select: { id: true, version: true, total_amount: true, status: true } },
          },
        });
      });

      if (!project) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      return reply.status(200).send({ data: project });
    },
  );

  // GET /api/v1/projects/:id/checklist — guided onboarding checklist computed
  // from real project data. Each step reports done/not-done and deep-links to
  // the console section that completes it.
  server.get(
    '/api/v1/projects/:id/checklist',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      try {
        const steps = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findUnique({ where: { id }, select: { id: true, closeout_stage: true } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const [acceptedQuote, activeBoq, memberCount, diaryCount, certCount, paidInvoiceCount] = await Promise.all([
            tx.quote.findFirst({
              where: { OR: [{ converted_project_id: id }, { project_id: id }] },
              select: { id: true },
            }),
            tx.bOQ.findFirst({ where: { project_id: id, status: { in: ['ACTIVE', 'APPROVED'] } }, select: { id: true } }),
            tx.projectMember.count({ where: { project_id: id } }),
            tx.siteDiary.count({ where: { project_id: id } }),
            tx.paymentCertificate.count({ where: { project_id: id, status: { in: ['CERTIFIED', 'PAID'] } } }),
            tx.invoice.count({ where: { project_id: id, status: 'PAID' } }),
          ]);

          const closeoutDone = !['IN_PROGRESS', 'NOT_STARTED'].includes(project.closeout_stage ?? 'IN_PROGRESS');

          return [
            { key: 'quote', label: 'Quote accepted', done: !!acceptedQuote, href: 'quotes' },
            { key: 'boq', label: 'BoQ imported', done: !!activeBoq, href: 'boq' },
            { key: 'team', label: 'Team assigned', done: memberCount >= 2, href: 'team' },
            { key: 'diary', label: 'First site diary filed', done: diaryCount > 0, href: 'site' },
            { key: 'certificate', label: 'First payment certificate certified', done: certCount > 0, href: 'certificates' },
            { key: 'invoice', label: 'First invoice paid', done: paidInvoiceCount > 0, href: 'invoices' },
            { key: 'closeout', label: 'Project closeout', done: closeoutDone, href: 'closeout' },
          ];
        });

        return reply.status(200).send({ data: { steps } });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to load project checklist' });
      }
    },
  );

  // POST /api/v1/projects (requires PROJECT_CREATE) — Gate-4 S8 full onboarding payload
  server.post(
    '/api/v1/projects',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_CREATE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;

      const parseResult = CreateProjectDetailsSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid project payload',
          details: parseResult.error.errors,
        });
      }
      const body = parseResult.data;

      const typeError = validateProjectType(body.projectType, body.projectSubtype);
      if (typeError) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: typeError });
      }

      const result = await withTenantTx(prisma, tenantId, async (tx) => {
        // Legacy aliases: budget / originalContractSum / currentApprovedBudget
        const legacyValue =
          body.contractValue ??
          (body.originalContractSum != null ? String(body.originalContractSum) : null) ??
          (body.budget != null ? String(body.budget) : null);
        const contractValue = legacyValue ? toDecimal(legacyValue) : null;
        const approvedBudget =
          body.currentApprovedBudget != null
            ? toDecimal(String(body.currentApprovedBudget))
            : (contractValue ?? 0);
        const project = await tx.project.create({
          data: {
            tenant_id: tenantId,
            name: body.name,
            code: body.code,
            description: body.description ?? null,
            location: body.location ?? null,
            map_latitude: body.mapLatitude != null ? toDecimal(body.mapLatitude) : null,
            map_longitude: body.mapLongitude != null ? toDecimal(body.mapLongitude) : null,
            contract_currency: body.contractCurrency || 'KES',
            money_at_risk_kes: body.moneyAtRiskKes ? toDecimal(body.moneyAtRiskKes) : null,
            nca_project_no: body.ncaProjectNo ?? null,
            project_type: body.projectType ?? null,
            project_subtype: body.projectSubtype ?? null,
            ...(body.retentionRatePct != null ? { retention_rate_pct: pctOrThrow(body.retentionRatePct) } : {}),
            ...(body.retentionCapPct != null ? { retention_cap_pct: pctOrThrow(body.retentionCapPct) } : {}),
            ...(body.retentionFirstMoietyPct != null ? { retention_first_moiety_pct: pctOrThrow(body.retentionFirstMoietyPct) } : {}),
            status: body.status || 'PLANNING',
            original_contract_sum: contractValue ?? 0,
            current_approved_budget: approvedBudget,
            start_date: body.startDate ? toDateOnly(body.startDate) : null,
            target_end_date: body.targetEndDate ? toDateOnly(body.targetEndDate) : null,
            members: {
              create: {
                tenant_id: tenantId,
                user_id: sub,
                role: 'PROJECT_LEAD',
              },
            },
          },
        });

        await recordAuditLog(tx, {
          tenantId,
          projectId: project.id,
          actorId: sub,
          action: 'PROJECT_CREATED',
          entityType: 'Project',
          entityId: project.id,
          changes: {
            name: body.name,
            code: body.code,
            contractValue: contractValue?.toFixed(2) ?? null,
            status: project.status,
          },
        });

        await seedProjectStarters(tx, tenantId, project);

        return project;
      });

      return reply.status(201).send({ data: result });
    },
  );

  // PATCH /api/v1/projects/:id (requires PROJECT_EDIT) — Gate-4 S8 edit-project coverage
  server.patch(
    '/api/v1/projects/:id',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_EDIT)],
    },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { id } = request.params as { id: string };

      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = UpdateProjectDetailsSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid project update',
          details: parseResult.error.errors,
        });
      }
      const body = parseResult.data;

      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.project.findUnique({ where: { id } });
          if (!existing) throw { status: 404, message: 'Project not found' };

          const data: Record<string, any> = {};
          if (body.name !== undefined) data.name = body.name;
          if (body.code !== undefined) data.code = body.code;
          if (body.description !== undefined) data.description = body.description;
          if (body.location !== undefined) data.location = body.location;
          if (body.mapLatitude !== undefined) data.map_latitude = body.mapLatitude === null ? null : toDecimal(body.mapLatitude);
          if (body.mapLongitude !== undefined) data.map_longitude = body.mapLongitude === null ? null : toDecimal(body.mapLongitude);
          if (body.contractCurrency !== undefined) data.contract_currency = body.contractCurrency;
          if (body.moneyAtRiskKes !== undefined) data.money_at_risk_kes = body.moneyAtRiskKes === null ? null : toDecimal(body.moneyAtRiskKes);
          if (body.ncaProjectNo !== undefined) data.nca_project_no = body.ncaProjectNo;
          if (body.projectType !== undefined || body.projectSubtype !== undefined) {
            const nextType = body.projectType !== undefined ? body.projectType : existing.project_type;
            const nextSubtype = body.projectSubtype !== undefined ? body.projectSubtype : existing.project_subtype;
            const typeError = validateProjectType(nextType, nextSubtype);
            if (typeError) throw { status: 400, message: typeError };
            data.project_type = nextType ?? null;
            data.project_subtype = nextSubtype ?? null;
          }
          if (body.status !== undefined) data.status = body.status;
          if (body.startDate !== undefined) data.start_date = body.startDate === null ? null : toDateOnly(body.startDate);
          if (body.targetEndDate !== undefined) data.target_end_date = body.targetEndDate === null ? null : toDateOnly(body.targetEndDate);

          if (body.contractValue !== undefined) {
            const newValue = body.contractValue === null ? new Decimal(0) : toDecimal(body.contractValue);
            data.original_contract_sum = newValue;
            // Keep approved budget in sync while it still equals the old contract sum
            // (pre-variation state); once variations have moved it, leave it alone.
            if (toDecimal(existing.current_approved_budget.toString()).equals(toDecimal(existing.original_contract_sum.toString()))) {
              data.current_approved_budget = newValue;
            }
          }

          // Round H3: project retention terms are commercial contract data —
          // admin/PM_QS only, and locked once the first payment certificate
          // exists (the rate/cap must not move mid-contract).
          const retentionFields = ['retentionRatePct', 'retentionCapPct', 'retentionFirstMoietyPct'] as const;
          const touchesRetention = retentionFields.some((f) => body[f] !== undefined);
          if (touchesRetention) {
            if (!['COMPANY_ADMIN', 'PM_QS', 'ADMIN'].includes(String(role))) {
              throw { status: 403, message: 'Only a company admin or PM/QS can change retention terms' };
            }
            const certCount = await tx.paymentCertificate.count({ where: { project_id: id } });
            if (certCount > 0) {
              throw { status: 409, message: 'Retention terms are locked — a payment certificate already exists for this project' };
            }
            const pct = (v: string) => {
              const d = toDecimal(v);
              if (d.lt(0) || d.gt(100)) throw { status: 400, message: 'Retention percentages must be between 0 and 100' };
              return d.toFixed(2);
            };
            if (body.retentionRatePct !== undefined && body.retentionRatePct !== null) data.retention_rate_pct = pct(body.retentionRatePct);
            if (body.retentionCapPct !== undefined && body.retentionCapPct !== null) data.retention_cap_pct = pct(body.retentionCapPct);
            if (body.retentionFirstMoietyPct !== undefined && body.retentionFirstMoietyPct !== null) data.retention_first_moiety_pct = pct(body.retentionFirstMoietyPct);
          }

          const before = await tx.project.findUnique({
            where: { id },
            select: { retention_rate_pct: true, retention_cap_pct: true, retention_first_moiety_pct: true },
          });
          const project = await tx.project.update({ where: { id }, data });

          // progressPct → real ProgressRecord (no duplicated manual field)
          if (body.progressPct !== undefined && body.progressPct !== null) {
            const pct = toDecimal(body.progressPct);
            if (pct.lt(0) || pct.gt(100)) {
              throw { status: 400, message: 'progressPct must be between 0 and 100' };
            }
            await tx.progressRecord.create({
              data: {
                tenant_id: tenantId,
                project_id: id,
                record_date: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
                overall_progress: pct.dividedBy(100).toFixed(4),
                notes: 'Manual progress update via project settings',
              },
            });
          }

          await recordAuditLog(tx, {
            tenantId,
            projectId: project.id,
            actorId: sub,
            action: 'PROJECT_UPDATED',
            entityType: 'Project',
            entityId: project.id,
            changes: {
              fields: Object.keys(body),
              ...(touchesRetention && before
                ? {
                    retention: {
                      ratePct: { from: before.retention_rate_pct?.toString(), to: project.retention_rate_pct?.toString() },
                      capPct: { from: before.retention_cap_pct?.toString(), to: project.retention_cap_pct?.toString() },
                      firstMoietyPct: { from: before.retention_first_moiety_pct?.toString(), to: project.retention_first_moiety_pct?.toString() },
                    },
                  }
                : {}),
            },
          });

          return project;
        });

        return reply.status(200).send({ data: updated });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update project' });
      }
    },
  );

  // POST /api/v1/projects/:id/members (requires PROJECT_EDIT) — PM/Architect/QS assignment
  server.post(
    '/api/v1/projects/:id/members',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_EDIT)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };

      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project or Member not found' });
      }

      const parseResult = AssignProjectMemberSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid member assignment',
          details: parseResult.error.errors,
        });
      }
      const body = parseResult.data;

      try {
        const assignment = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findUnique({ where: { id }, select: { id: true } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const member = await tx.projectMember.upsert({
            where: {
              project_id_user_id: {
                project_id: id,
                user_id: body.userId,
              },
            },
            update: { role: body.role },
            create: {
              tenant_id: tenantId,
              project_id: id,
              user_id: body.userId,
              role: body.role,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId: id,
            actorId: sub,
            action: 'PROJECT_MEMBER_ASSIGNED',
            entityType: 'ProjectMember',
            entityId: member.id,
            changes: { userId: body.userId, role: body.role },
          });

          return member;
        });

        return reply.status(200).send({ data: assignment });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({ statusCode: err.status, error: 'Not Found', message: err.message });
        }
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to assign member' });
      }
    },
  );

  // DELETE /api/v1/projects/:id/members/:userId (requires PROJECT_EDIT)
  server.delete(
    '/api/v1/projects/:id/members/:userId',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_EDIT)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id, userId } = request.params as { id: string; userId: string };

      if (!UUID_REGEX.test(id) || !UUID_REGEX.test(userId)) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project or Member not found' });
      }

      await withTenantTx(prisma, tenantId, async (tx) => {
        await tx.projectMember.delete({
          where: {
            project_id_user_id: {
              project_id: id,
              user_id: userId,
            },
          },
        });

        await recordAuditLog(tx, {
          tenantId,
          projectId: id,
          actorId: sub,
          action: 'PROJECT_MEMBER_REMOVED',
          entityType: 'ProjectMember',
          entityId: userId,
          changes: { userId },
        });
      });

      return reply.status(200).send({ success: true, message: 'Member removed from project' });
    },
  );

  // GET /api/v1/project-types — shared taxonomy + the tenant's editable NCA
  // class bands. Any authenticated user may read (the wizard and filters need
  // it); only COMPANY_MANAGE holders may edit the bands.
  server.get(
    '/api/v1/project-types',
    {
      preHandler: [server.authenticate],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const rules = await withTenantTx(prisma, tenantId, async (tx) =>
        tx.ncaClassRule.findMany({ orderBy: [{ trade: 'asc' }, { class_label: 'asc' }] }),
      );
      return reply.status(200).send({
        data: {
          categories: PROJECT_TYPE_CATEGORIES,
          ncaRules: rules,
        },
      });
    },
  );

  // PATCH /api/v1/project-types/nca-rules/:id — adjust an NCA band when NCA
  // publishes new limits. Company admins only; audited.
  server.patch(
    '/api/v1/project-types/nca-rules/:id',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ error: 'Not Found', message: 'NCA rule not found' });
      }
      const body = (request.body || {}) as Record<string, any>;
      const data: Record<string, any> = {};
      if (body.minContractValue !== undefined) data.min_contract_value = body.minContractValue === null ? null : toDecimal(String(body.minContractValue));
      if (body.maxContractValue !== undefined) data.max_contract_value = body.maxContractValue === null ? null : toDecimal(String(body.maxContractValue));
      if (body.notes !== undefined) data.notes = body.notes === null ? null : String(body.notes).slice(0, 255);
      if (body.trade !== undefined) data.trade = String(body.trade).slice(0, 60);
      if (body.classLabel !== undefined) data.class_label = String(body.classLabel).slice(0, 10);
      if (!Object.keys(data).length) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No fields to update' });
      }

      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.ncaClassRule.findUnique({ where: { id } });
          if (!existing) throw { status: 404, message: 'NCA rule not found' };
          const rule = await tx.ncaClassRule.update({ where: { id }, data });
          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'NCA_RULE_UPDATED',
            entityType: 'NcaClassRule',
            entityId: id,
            changes: { fields: Object.keys(data) },
          });
          return rule;
        });
        return reply.status(200).send({ data: updated });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ error: 'Not Found', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update NCA rule' });
      }
    },
  );
};
