import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import {
  RateMasterEntryInputSchema,
  UpdateRateMasterEntrySchema,
  BulkRateMasterSchema,
} from '@construction/validation';
import { requirePermission } from '../plugins/rbac';
import { listParams, listPage } from '../lib/pagination';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trimmed decimal string — '780.0000' -> '780', '1150.5555' stays. */
function rateString(d: unknown): string {
  const n = Number(d);
  return Number.isFinite(n) ? String(n) : String(d ?? '0');
}

function serialize(e: any) {
  return {
    id: e.id,
    country: e.country,
    stateRegion: e.state_region,
    city: e.city,
    itemType: e.item_type,
    materialType: e.material_type,
    materialSubType: e.material_subtype,
    description: e.description,
    unit: e.unit,
    unitRateKes: rateString(e.unit_rate_kes),
    effectiveFrom: e.effective_from ? e.effective_from.toISOString().split('T')[0] : null,
    effectiveTo: e.effective_to ? e.effective_to.toISOString().split('T')[0] : null,
    source: e.source,
    notes: e.notes,
    createdBy: e.created_by,
    createdAt: e.created_at?.toISOString?.() ?? e.created_at,
    updatedAt: e.updated_at?.toISOString?.() ?? e.updated_at,
  };
}

/** Natural upsert key — geo + typing + unit + normalised description. */
function naturalKey(e: {
  country?: string | null; stateRegion?: string | null; city?: string | null;
  itemType?: string | null; materialType?: string | null; materialSubType?: string | null;
  unit?: string | null; description?: string | null;
}): string {
  return [
    (e.country ?? 'Kenya').trim().toLowerCase(),
    (e.stateRegion ?? '').trim().toLowerCase(),
    (e.city ?? '').trim().toLowerCase(),
    (e.itemType ?? 'MATERIAL').trim().toLowerCase(),
    (e.materialType ?? '').trim().toLowerCase(),
    (e.materialSubType ?? '').trim().toLowerCase(),
    (e.unit ?? '').trim().toLowerCase(),
    (e.description ?? '').trim().toLowerCase(),
  ].join('|');
}

function entryData(tenantId: string, d: any, actor: string, source = 'MANUAL') {
  return {
    tenant_id: tenantId,
    country: d.country ?? 'Kenya',
    state_region: d.stateRegion ?? null,
    city: d.city ?? null,
    item_type: d.itemType ?? 'MATERIAL',
    material_type: d.materialType ?? null,
    material_subtype: d.materialSubType ?? null,
    description: d.description,
    unit: d.unit,
    unit_rate_kes: d.unitRateKes,
    effective_from: d.effectiveFrom ? new Date(`${d.effectiveFrom}T00:00:00Z`) : null,
    effective_to: d.effectiveTo ? new Date(`${d.effectiveTo}T00:00:00Z`) : null,
    source,
    notes: d.notes ?? null,
    created_by: actor,
  };
}

export const rateMasterRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/rate-master — filters: country/stateRegion/city/itemType/
  // materialType/materialSubType/unit/q + pagination.
  server.get(
    '/api/v1/rate-master',
    { preHandler: [server.authenticate, requirePermission(Permissions.BOQ_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const q = request.query as Record<string, string | undefined>;
      const pg = listParams(request);
      const term = q.q?.trim();
      try {
        const where: Record<string, unknown> = { tenant_id: tenantId };
        if (q.country) where.country = { equals: q.country, mode: 'insensitive' };
        if (q.stateRegion) where.state_region = { contains: q.stateRegion, mode: 'insensitive' };
        if (q.city) where.city = { contains: q.city, mode: 'insensitive' };
        if (q.itemType) where.item_type = q.itemType.toUpperCase();
        if (q.materialType) where.material_type = { contains: q.materialType, mode: 'insensitive' };
        if (q.materialSubType) where.material_subtype = { contains: q.materialSubType, mode: 'insensitive' };
        if (q.unit) where.unit = { equals: q.unit, mode: 'insensitive' };
        if (term) {
          where.OR = [
            { description: { contains: term, mode: 'insensitive' } },
            { material_type: { contains: term, mode: 'insensitive' } },
            { material_subtype: { contains: term, mode: 'insensitive' } },
          ];
        }
        const rows = await withTenantTx(prisma, tenantId, (tx) =>
          tx.rateMasterEntry.findMany({
            where,
            orderBy: [{ material_type: 'asc' }, { description: 'asc' }],
            skip: pg.skip,
            take: pg.limit + 1,
          }),
        );
        const paged = listPage(rows, pg);
        return reply.send({ entries: paged.data.map(serialize), page: paged.page });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list rate-master entries' });
      }
    },
  );

  // GET /api/v1/rate-master/lookup?q=&unit=&limit= — ranked best matches for
  // prefilling BoQ lines and PO rates.
  server.get(
    '/api/v1/rate-master/lookup',
    { preHandler: [server.authenticate, requirePermission(Permissions.BOQ_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const q = request.query as { q?: string; unit?: string; limit?: string };
      const term = (q.q ?? '').trim().toLowerCase();
      const unit = (q.unit ?? '').trim().toLowerCase();
      const limit = Math.min(Math.max(parseInt(q.limit ?? '10', 10) || 10, 1), 50);
      try {
        const rows = await withTenantTx(prisma, tenantId, async (tx) => {
          const candidates = await tx.rateMasterEntry.findMany({
            where: {
              tenant_id: tenantId,
              ...(term
                ? {
                    OR: [
                      { description: { contains: term, mode: 'insensitive' } },
                      { material_type: { contains: term, mode: 'insensitive' } },
                      { material_subtype: { contains: term, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            take: 500,
          });
          const today = new Date();
          const scored = candidates.map((e) => {
            const desc = e.description.toLowerCase();
            const mtype = (e.material_type ?? '').toLowerCase();
            const msub = (e.material_subtype ?? '').toLowerCase();
            let score = 0;
            if (term) {
              if (msub && msub === term) score += 100;
              else if (msub && msub.includes(term)) score += 60;
              if (mtype && (mtype === term || mtype.includes(term) || term.includes(mtype))) score += 40;
              if (desc.includes(term)) score += 30;
              else if (term.split(/\s+/).some((w) => w.length > 2 && desc.includes(w))) score += 10;
            }
            if (unit && e.unit.toLowerCase() === unit) score += 15;
            // Prefer currently-effective rates.
            const fromOk = !e.effective_from || e.effective_from <= today;
            const toOk = !e.effective_to || e.effective_to >= today;
            if (fromOk && toOk) score += 5;
            return { e, score };
          });
          scored.sort((a, b) => b.score - a.score || a.e.description.localeCompare(b.e.description));
          return scored.slice(0, limit).map((s) => s.e);
        });
        return reply.send({ matches: rows.map(serialize) });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Rate lookup failed' });
      }
    },
  );

  // GET /api/v1/rate-master/:id
  server.get(
    '/api/v1/rate-master/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.BOQ_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Rate entry not found' });
      try {
        const entry = await withTenantTx(prisma, tenantId, (tx) =>
          tx.rateMasterEntry.findFirst({ where: { id, tenant_id: tenantId } }),
        );
        if (!entry) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Rate entry not found' });
        return reply.send({ entry: serialize(entry) });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load rate entry' });
      }
    },
  );

  // POST /api/v1/rate-master — single create.
  server.post(
    '/api/v1/rate-master',
    { preHandler: [server.authenticate, requirePermission(Permissions.BOQ_EDIT)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = RateMasterEntryInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid rate entry', details: parsed.error.errors });
      }
      try {
        const entry = await withTenantTx(prisma, tenantId, async (tx) => {
          const e = await tx.rateMasterEntry.create({ data: entryData(tenantId, parsed.data, sub) });
          await recordAuditLog(tx, {
            tenantId, actorId: sub, action: 'CREATE', entityType: 'RATE_MASTER_ENTRY', entityId: e.id,
            changes: { description: e.description, unitRateKes: rateString(e.unit_rate_kes) },
          });
          return e;
        });
        return reply.status(201).send({ entry: serialize(entry) });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create rate entry' });
      }
    },
  );

  // POST /api/v1/rate-master/bulk — upsert ≤500 entries by natural key.
  server.post(
    '/api/v1/rate-master/bulk',
    { preHandler: [server.authenticate, requirePermission(Permissions.BOQ_IMPORT)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = BulkRateMasterSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid bulk payload', details: parsed.error.errors });
      }
      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.rateMasterEntry.findMany({ where: { tenant_id: tenantId } });
          const byKey = new Map(existing.map((e) => [naturalKey({
            country: e.country, stateRegion: e.state_region, city: e.city, itemType: e.item_type,
            materialType: e.material_type, materialSubType: e.material_subtype, unit: e.unit, description: e.description,
          }), e.id]));

          let created = 0;
          let updated = 0;
          for (const d of parsed.data.entries) {
            const key = naturalKey(d);
            const existingId = byKey.get(key);
            if (existingId) {
              await tx.rateMasterEntry.update({
                where: { id: existingId },
                data: {
                  unit_rate_kes: d.unitRateKes,
                  effective_from: d.effectiveFrom ? new Date(`${d.effectiveFrom}T00:00:00Z`) : null,
                  effective_to: d.effectiveTo ? new Date(`${d.effectiveTo}T00:00:00Z`) : null,
                  notes: d.notes ?? null,
                  source: 'IMPORT',
                },
              });
              updated++;
            } else {
              const e = await tx.rateMasterEntry.create({ data: entryData(tenantId, d, sub, 'IMPORT') });
              byKey.set(key, e.id);
              created++;
            }
          }
          await recordAuditLog(tx, {
            tenantId, actorId: sub, action: 'BULK_IMPORT', entityType: 'RATE_MASTER_ENTRY', entityId: tenantId,
            changes: { created, updated, total: parsed.data.entries.length },
          });
          return { created, updated, total: parsed.data.entries.length };
        });
        return reply.send(result);
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Bulk rate import failed' });
      }
    },
  );

  // PATCH /api/v1/rate-master/:id
  server.patch(
    '/api/v1/rate-master/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.BOQ_EDIT)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Rate entry not found' });
      const parsed = UpdateRateMasterEntrySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid rate entry update', details: parsed.error.errors });
      }
      const d = parsed.data;
      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.rateMasterEntry.findFirst({ where: { id, tenant_id: tenantId } });
          if (!existing) throw { status: 404, message: 'Rate entry not found' };
          const e = await tx.rateMasterEntry.update({
            where: { id },
            data: {
              ...(d.country !== undefined ? { country: d.country } : {}),
              ...(d.stateRegion !== undefined ? { state_region: d.stateRegion } : {}),
              ...(d.city !== undefined ? { city: d.city } : {}),
              ...(d.itemType !== undefined ? { item_type: d.itemType } : {}),
              ...(d.materialType !== undefined ? { material_type: d.materialType } : {}),
              ...(d.materialSubType !== undefined ? { material_subtype: d.materialSubType } : {}),
              ...(d.description !== undefined ? { description: d.description } : {}),
              ...(d.unit !== undefined ? { unit: d.unit } : {}),
              ...(d.unitRateKes !== undefined ? { unit_rate_kes: d.unitRateKes } : {}),
              ...(d.effectiveFrom !== undefined ? { effective_from: d.effectiveFrom ? new Date(`${d.effectiveFrom}T00:00:00Z`) : null } : {}),
              ...(d.effectiveTo !== undefined ? { effective_to: d.effectiveTo ? new Date(`${d.effectiveTo}T00:00:00Z`) : null } : {}),
              ...(d.notes !== undefined ? { notes: d.notes } : {}),
            },
          });
          await recordAuditLog(tx, {
            tenantId, actorId: sub, action: 'UPDATE', entityType: 'RATE_MASTER_ENTRY', entityId: id,
            changes: { fields: Object.keys(d) },
          });
          return e;
        });
        return reply.send({ entry: serialize(updated) });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update rate entry' });
      }
    },
  );

  // DELETE /api/v1/rate-master/:id
  server.delete(
    '/api/v1/rate-master/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.BOQ_EDIT)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Rate entry not found' });
      try {
        await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.rateMasterEntry.findFirst({ where: { id, tenant_id: tenantId } });
          if (!existing) throw { status: 404, message: 'Rate entry not found' };
          await tx.rateMasterEntry.delete({ where: { id } });
          await recordAuditLog(tx, {
            tenantId, actorId: sub, action: 'DELETE', entityType: 'RATE_MASTER_ENTRY', entityId: id,
            changes: { description: existing.description },
          });
        });
        return reply.status(204).send();
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to delete rate entry' });
      }
    },
  );
};
