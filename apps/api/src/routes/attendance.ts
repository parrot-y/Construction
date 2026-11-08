import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { RecordAttendanceSchema, CheckInOutSchema } from '@construction/validation';
import { requirePermission } from '../plugins/rbac';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function todayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function hoursBetween(inAt?: Date | null, outAt?: Date | null): number | null {
  if (!inAt || !outAt) return null;
  return Math.round(((outAt.getTime() - inAt.getTime()) / 3600000) * 100) / 100;
}

function formatRow(a: any) {
  return {
    ...a,
    work_date: a.work_date?.toISOString().slice(0, 10),
    check_in_at: a.check_in_at?.toISOString() ?? null,
    check_out_at: a.check_out_at?.toISOString() ?? null,
    hours_worked: a.hours_worked?.toString() ?? null,
    created_at: a.created_at.toISOString(),
    updated_at: a.updated_at.toISOString(),
  };
}

/**
 * Gate-5 G5-10: Daily attendance — observed Site > Attendance
 * (Today / History / Check In / Report Leave or Off-Day).
 * Upsert-per-day semantics: one row per laborer/project/date.
 */
export const attendanceRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/projects/:projectId/attendance?date=YYYY-MM-DD&status=
  server.get(
    '/api/v1/projects/:projectId/attendance',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      const { date, status, from, to } = request.query as { date?: string; status?: string; from?: string; to?: string };
      if (!UUID_REGEX.test(projectId)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const laborers = await tx.siteLaborer.findMany({
            where: { project_id: projectId, is_active: true },
            select: { id: true, full_name: true, worker_code: true, trade_category: true },
          });
          const where: any = { project_id: projectId };
          if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) where.work_date = new Date(`${date}T00:00:00.000Z`);
          else if (from || to) {
            where.work_date = {};
            if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) where.work_date.gte = new Date(`${from}T00:00:00.000Z`);
            if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) where.work_date.lte = new Date(`${to}T00:00:00.000Z`);
          } else {
            where.work_date = todayUTC();
          }
          if (status) where.status = status;
          const rows = await tx.dailyAttendance.findMany({
            where,
            include: {
              laborer: { select: { id: true, full_name: true, worker_code: true, trade_category: true } },
              crew: { select: { id: true, name: true, trade: true } },
            },
            orderBy: [{ work_date: 'desc' }, { created_at: 'asc' }],
          });
          return { laborers, rows: rows.map(formatRow) };
        });
        return reply.status(200).send({
          data: result.rows,
          laborers: result.laborers,
          count: result.rows.length,
          summary: {
            present: result.rows.filter((r: any) => r.status === 'PRESENT' || r.status === 'HALF_DAY').length,
            on_leave: result.rows.filter((r: any) => r.status === 'LEAVE' || r.status === 'OFF_DAY').length,
            absent: result.rows.filter((r: any) => r.status === 'ABSENT').length,
          },
        });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load attendance' });
      }
    },
  );

  // POST /api/v1/projects/:projectId/attendance — record/upsert day status
  server.post(
    '/api/v1/projects/:projectId/attendance',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };
      if (!UUID_REGEX.test(projectId)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      const parsed = RecordAttendanceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid attendance', details: parsed.error.errors });
      }
      const data = parsed.data;
      const workDate = data.workDate ? new Date(`${data.workDate}T00:00:00.000Z`) : todayUTC();
      const recorder = (request.user as any).full_name || (request.user as any).email || 'Site team';

      try {
        const row = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };
          const laborer = await tx.siteLaborer.findFirst({ where: { id: data.laborerId, project_id: projectId } });
          if (!laborer) throw { status: 404, message: 'Laborer not found on this project' };
          if (data.crewId) {
            const crew = await tx.crew.findFirst({ where: { id: data.crewId, tenant_id: tenantId } });
            if (!crew) throw { status: 404, message: 'Crew not found' };
          }

          const existing = await tx.dailyAttendance.findUnique({
            where: { tenant_id_project_id_laborer_id_work_date: { tenant_id: tenantId, project_id: projectId, laborer_id: data.laborerId, work_date: workDate } },
          });
          const saved = existing
            ? await tx.dailyAttendance.update({
                where: { id: existing.id },
                data: {
                  status: data.status,
                  notes: data.notes ?? existing.notes,
                  crew_id: data.crewId ?? existing.crew_id,
                  recorded_by_id: sub,
                  recorded_by_name: recorder,
                },
              })
            : await tx.dailyAttendance.create({
                data: {
                  tenant_id: tenantId,
                  project_id: projectId,
                  laborer_id: data.laborerId,
                  crew_id: data.crewId ?? null,
                  work_date: workDate,
                  status: data.status,
                  notes: data.notes ?? null,
                  recorded_by_id: sub,
                  recorded_by_name: recorder,
                },
              });
          await recordAuditLog(tx, {
            tenantId, projectId, actorId: sub,
            action: existing ? 'ATTENDANCE_UPDATED' : 'ATTENDANCE_RECORDED',
            entityType: 'DailyAttendance', entityId: saved.id,
            changes: { laborer: laborer.full_name, workDate: workDate.toISOString().slice(0, 10), status: data.status },
          });
          return { saved, isNew: !existing };
        });
        return reply.status(row.isNew ? 201 : 200).send({ data: formatRow(row.saved) });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to record attendance' });
      }
    },
  );

  // POST /api/v1/projects/:projectId/attendance/check-in — stamp check-in (creates PRESENT row if none)
  server.post(
    '/api/v1/projects/:projectId/attendance/check-in',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };
      if (!UUID_REGEX.test(projectId)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      const parsed = CheckInOutSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid check-in', details: parsed.error.errors });
      }
      const data = parsed.data;
      const workDate = data.workDate ? new Date(`${data.workDate}T00:00:00.000Z`) : todayUTC();
      const now = new Date();

      try {
        const row = await withTenantTx(prisma, tenantId, async (tx) => {
          const laborer = await tx.siteLaborer.findFirst({ where: { id: data.laborerId, project_id: projectId } });
          if (!laborer) throw { status: 404, message: 'Laborer not found on this project' };
          const existing = await tx.dailyAttendance.findUnique({
            where: { tenant_id_project_id_laborer_id_work_date: { tenant_id: tenantId, project_id: projectId, laborer_id: data.laborerId, work_date: workDate } },
          });
          if (existing?.check_in_at) throw { status: 400, message: 'Already checked in for this date' };
          const saved = existing
            ? await tx.dailyAttendance.update({ where: { id: existing.id }, data: { check_in_at: now, status: existing.status === 'LEAVE' || existing.status === 'OFF_DAY' ? existing.status : 'PRESENT' } })
            : await tx.dailyAttendance.create({
                data: { tenant_id: tenantId, project_id: projectId, laborer_id: data.laborerId, work_date: workDate, status: 'PRESENT', check_in_at: now, recorded_by_id: sub, recorded_by_name: (request.user as any).full_name || (request.user as any).email },
              });
          await recordAuditLog(tx, {
            tenantId, projectId, actorId: sub,
            action: 'ATTENDANCE_CHECK_IN', entityType: 'DailyAttendance', entityId: saved.id,
            changes: { laborer: laborer.full_name, workDate: workDate.toISOString().slice(0, 10) },
          });
          return saved;
        });
        return reply.status(200).send({ data: formatRow(row) });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to check in' });
      }
    },
  );

  // POST /api/v1/projects/:projectId/attendance/check-out — stamp check-out + compute hours
  server.post(
    '/api/v1/projects/:projectId/attendance/check-out',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };
      if (!UUID_REGEX.test(projectId)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      const parsed = CheckInOutSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid check-out', details: parsed.error.errors });
      }
      const data = parsed.data;
      const workDate = data.workDate ? new Date(`${data.workDate}T00:00:00.000Z`) : todayUTC();
      const now = new Date();

      try {
        const row = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.dailyAttendance.findUnique({
            where: { tenant_id_project_id_laborer_id_work_date: { tenant_id: tenantId, project_id: projectId, laborer_id: data.laborerId, work_date: workDate } },
          });
          if (!existing) throw { status: 404, message: 'No attendance record for this date — check in first' };
          if (!existing.check_in_at) throw { status: 400, message: 'No check-in recorded for this date' };
          if (existing.check_out_at) throw { status: 400, message: 'Already checked out for this date' };
          const hours = hoursBetween(existing.check_in_at, now);
          const saved = await tx.dailyAttendance.update({
            where: { id: existing.id },
            data: { check_out_at: now, hours_worked: hours ?? undefined },
          });
          await recordAuditLog(tx, {
            tenantId, projectId, actorId: sub,
            action: 'ATTENDANCE_CHECK_OUT', entityType: 'DailyAttendance', entityId: saved.id,
            changes: { laborerId: data.laborerId, hours },
          });
          return saved;
        });
        return reply.status(200).send({ data: formatRow(row) });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to check out' });
      }
    },
  );
};
