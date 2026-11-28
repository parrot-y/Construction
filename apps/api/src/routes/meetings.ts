import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { CreateMeetingSchema, UpdateMeetingSchema } from '@construction/validation';
import { requirePermission } from '../plugins/rbac';
import { listParams, listPage } from '../lib/pagination';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RFC 5545 text escaping. */
function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** YYYYMMDDTHHMMSSZ in UTC. */
function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function foldLine(line: string): string {
  // RFC 5545: lines SHOULD NOT exceed 75 octets — fold with CRLF + space.
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    parts.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return parts.join('\r\n');
}

function meetingToIcs(m: any): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SiteSafi//Meetings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${m.id}@sitesafi.app`,
    `DTSTAMP:${icsDate(new Date(m.created_at ?? new Date()))}`,
    `DTSTART:${icsDate(new Date(m.starts_at))}`,
    `DTEND:${icsDate(new Date(m.ends_at))}`,
    `SUMMARY:${icsEscape(m.title)}`,
  ];
  if (m.location) lines.push(`LOCATION:${icsEscape(m.location)}`);
  if (m.description) lines.push(`DESCRIPTION:${icsEscape(m.description)}`);
  if (m.status === 'CANCELLED') lines.push('STATUS:CANCELLED');
  for (const raw of Array.isArray(m.attendees) ? m.attendees : []) {
    const attendee = String(raw).trim();
    if (!attendee) continue;
    if (attendee.includes('@')) {
      lines.push(`ATTENDEE;RSVP=TRUE:mailto:${attendee}`);
    } else {
      lines.push(`ATTENDEE;CN=${icsEscape(attendee)};RSVP=TRUE:mailto:${encodeURIComponent(attendee)}@invalid.local`);
    }
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

function serialize(m: any) {
  return {
    id: m.id,
    projectId: m.project_id,
    title: m.title,
    description: m.description,
    location: m.location,
    startsAt: m.starts_at?.toISOString?.() ?? m.starts_at,
    endsAt: m.ends_at?.toISOString?.() ?? m.ends_at,
    attendees: m.attendees ?? [],
    status: m.status,
    createdById: m.created_by_id,
    createdAt: m.created_at?.toISOString?.() ?? m.created_at,
  };
}

export const meetingsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/meetings?projectId=&status=&from=&to=
  server.get(
    '/api/v1/meetings',
    { preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const q = request.query as { projectId?: string; status?: string; from?: string; to?: string };
      const pg = listParams(request);
      try {
        const rows = await withTenantTx(prisma, tenantId, (tx) =>
          tx.meeting.findMany({
            where: {
              tenant_id: tenantId,
              ...(q.projectId && UUID_REGEX.test(q.projectId) ? { project_id: q.projectId } : {}),
              ...(q.status ? { status: q.status.toUpperCase() } : {}),
              ...(q.from || q.to
                ? {
                    starts_at: {
                      ...(q.from ? { gte: new Date(q.from) } : {}),
                      ...(q.to ? { lte: new Date(q.to) } : {}),
                    },
                  }
                : {}),
            },
            orderBy: { starts_at: 'asc' },
            skip: pg.skip,
            take: pg.limit + 1,
          }),
        );
        const paged = listPage(rows, pg);
        return reply.send({ data: paged.data.map(serialize), page: paged.page });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list meetings' });
      }
    },
  );

  // POST /api/v1/meetings
  server.post(
    '/api/v1/meetings',
    { preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_EDIT)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = CreateMeetingSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid meeting', details: parsed.error.errors });
      }
      const data = parsed.data;
      try {
        const meeting = await withTenantTx(prisma, tenantId, async (tx) => {
          if (data.projectId) {
            const project = await tx.project.findFirst({ where: { id: data.projectId, tenant_id: tenantId } });
            if (!project) throw { status: 404, message: 'Project not found' };
          }
          const m = await tx.meeting.create({
            data: {
              tenant_id: tenantId,
              project_id: data.projectId ?? null,
              title: data.title,
              description: data.description ?? null,
              location: data.location ?? null,
              starts_at: new Date(data.startsAt),
              ends_at: new Date(data.endsAt),
              attendees: data.attendees,
              created_by_id: sub,
            },
          });
          await recordAuditLog(tx, {
            tenantId, projectId: data.projectId ?? undefined, actorId: sub,
            action: 'MEETING_CREATED', entityType: 'Meeting', entityId: m.id,
            changes: { title: data.title, startsAt: data.startsAt },
          });
          return m;
        });
        return reply.status(201).send({ data: serialize(meeting) });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create meeting' });
      }
    },
  );

  // PATCH /api/v1/meetings/:id — edit fields or change status (CANCELLED/HELD)
  server.patch(
    '/api/v1/meetings/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_EDIT)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Meeting not found' });
      const parsed = UpdateMeetingSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid meeting update', details: parsed.error.errors });
      }
      const data = parsed.data;
      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.meeting.findFirst({ where: { id, tenant_id: tenantId } });
          if (!existing) throw { status: 404, message: 'Meeting not found' };
          const startsAt = data.startsAt ? new Date(data.startsAt) : existing.starts_at;
          const endsAt = data.endsAt ? new Date(data.endsAt) : existing.ends_at;
          if (endsAt <= startsAt) throw { status: 400, message: 'endsAt must be after startsAt' };
          const m = await tx.meeting.update({
            where: { id },
            data: {
              ...(data.title !== undefined ? { title: data.title } : {}),
              ...(data.description !== undefined ? { description: data.description } : {}),
              ...(data.location !== undefined ? { location: data.location } : {}),
              ...(data.startsAt !== undefined ? { starts_at: startsAt } : {}),
              ...(data.endsAt !== undefined ? { ends_at: endsAt } : {}),
              ...(data.attendees !== undefined ? { attendees: data.attendees } : {}),
              ...(data.status !== undefined ? { status: data.status } : {}),
            },
          });
          await recordAuditLog(tx, {
            tenantId, projectId: existing.project_id ?? undefined, actorId: sub,
            action: 'MEETING_UPDATED', entityType: 'Meeting', entityId: id,
            changes: { fields: Object.keys(data) },
          });
          return m;
        });
        return reply.send({ data: serialize(updated) });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update meeting' });
      }
    },
  );

  // GET /api/v1/meetings/:id/ics — RFC 5545 calendar export
  server.get(
    '/api/v1/meetings/:id/ics',
    { preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Meeting not found' });
      try {
        const meeting = await withTenantTx(prisma, tenantId, (tx) =>
          tx.meeting.findFirst({ where: { id, tenant_id: tenantId } }),
        );
        if (!meeting) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Meeting not found' });
        const ics = meetingToIcs(meeting);
        const filename = `meeting-${meeting.id.slice(0, 8)}.ics`;
        return reply
          .header('Content-Type', 'text/calendar; charset=utf-8')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(ics);
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to export meeting' });
      }
    },
  );
};
