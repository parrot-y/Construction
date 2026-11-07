import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { CreateCompanyDocumentSchema, UpdateCompanyDocumentSchema } from '@construction/validation';
import { requirePermission } from '../plugins/rbac';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPIRING_SOON_DAYS = 60;

/**
 * Gate-5 G5-7: Company documents vault — observed Files & reports >
 * Company documents / Unfiled documents. Tenant-level (not
 * project-scoped), categorized, expiry-aware.
 * Read: REPORT_VIEW (all internal roles except worker-level).
 * Write: DOCUMENT_MANAGE.
 */
export const companyDocumentsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/company/documents — vault list (?category=, ?expiring=60, ?unfiled=1, ?q=)
  server.get(
    '/api/v1/company/documents',
    { preHandler: [server.authenticate, requirePermission(Permissions.REPORT_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { category, expiring, unfiled, q } = request.query as { category?: string; expiring?: string; unfiled?: string; q?: string };
      try {
        const soon = new Date(Date.now() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);
        const data = await withTenantTx(prisma, tenantId, async (tx) => {
          const docs = await tx.companyDocument.findMany({
            where: {
              status: 'ACTIVE',
              ...(category ? { category } : {}),
              ...(unfiled === '1' ? { category: null } : {}),
              ...(expiring === '1' ? { expiry_date: { not: null, lte: soon } } : {}),
              ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { reference_no: { contains: q, mode: 'insensitive' } }] } : {}),
            },
            orderBy: [{ expiry_date: 'asc' }, { created_at: 'desc' }],
          });
          const today = new Date();
          return docs.map((d) => ({
            ...d,
            expiry_status: !d.expiry_date ? 'NONE' : d.expiry_date < today ? 'EXPIRED' : d.expiry_date <= soon ? 'EXPIRING_SOON' : 'VALID',
            created_at: d.created_at.toISOString(),
            updated_at: d.updated_at.toISOString(),
            expiry_date: d.expiry_date?.toISOString().slice(0, 10) ?? null,
          }));
        });
        return reply.status(200).send({ data, count: data.length });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list documents' });
      }
    },
  );

  // POST /api/v1/company/documents
  server.post(
    '/api/v1/company/documents',
    { preHandler: [server.authenticate, requirePermission(Permissions.DOCUMENT_MANAGE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = CreateCompanyDocumentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid document', details: parsed.error.errors });
      }
      const data = parsed.data;
      const uploader = (request.user as any).full_name || (request.user as any).email || 'Team member';
      try {
        const doc = await withTenantTx(prisma, tenantId, async (tx) => {
          const d = await tx.companyDocument.create({
            data: {
              tenant_id: tenantId,
              title: data.title,
              category: data.category ?? null,
              reference_no: data.referenceNo ?? null,
              file_name: data.fileName ?? null,
              mime_type: data.mimeType ?? null,
              file_size: data.fileSize ?? null,
              storage_key: data.storageKey ?? null,
              expiry_date: data.expiryDate ? new Date(`${data.expiryDate}T00:00:00.000Z`) : null,
              notes: data.notes ?? null,
              uploaded_by_id: sub,
              uploaded_by_name: uploader,
            },
          });
          await recordAuditLog(tx, {
            tenantId, actorId: sub,
            action: 'COMPANY_DOC_CREATED', entityType: 'CompanyDocument', entityId: d.id,
            changes: { title: data.title, category: data.category ?? 'UNFILED' },
          });
          return d;
        });
        return reply.status(201).send({ data: doc });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create document' });
      }
    },
  );

  // PATCH /api/v1/company/documents/:id — categorize (file), edit metadata, archive
  server.patch(
    '/api/v1/company/documents/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.DOCUMENT_MANAGE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Document not found' });
      const parsed = UpdateCompanyDocumentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid update', details: parsed.error.errors });
      }
      const data = parsed.data;
      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const doc = await tx.companyDocument.findUnique({ where: { id } });
          if (!doc) throw { status: 404, message: 'Document not found' };
          const result = await tx.companyDocument.update({
            where: { id },
            data: {
              ...(data.title !== undefined ? { title: data.title } : {}),
              ...(data.category !== undefined ? { category: data.category } : {}),
              ...(data.referenceNo !== undefined ? { reference_no: data.referenceNo } : {}),
              ...(data.expiryDate !== undefined ? { expiry_date: data.expiryDate === null ? null : new Date(`${data.expiryDate}T00:00:00.000Z`) } : {}),
              ...(data.status !== undefined ? { status: data.status } : {}),
              ...(data.notes !== undefined ? { notes: data.notes } : {}),
            },
          });
          await recordAuditLog(tx, {
            tenantId, actorId: sub,
            action: 'COMPANY_DOC_UPDATED', entityType: 'CompanyDocument', entityId: id,
            changes: { fields: Object.keys(data), filedTo: data.category ?? undefined },
          });
          return result;
        });
        return reply.status(200).send({ data: updated });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update document' });
      }
    },
  );

  // GET /api/v1/company/documents/expiring — dedicated expiring-soon feed
  server.get(
    '/api/v1/company/documents/expiring',
    { preHandler: [server.authenticate, requirePermission(Permissions.REPORT_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      try {
        const data = await withTenantTx(prisma, tenantId, async (tx) => {
          const docs = await tx.companyDocument.findMany({
            where: { status: 'ACTIVE', expiry_date: { not: null } },
            orderBy: { expiry_date: 'asc' },
          });
          const today = new Date();
          const soon = new Date(Date.now() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);
          return docs
            .map((d) => ({
              ...d,
              expiry_status: (d.expiry_date as Date) < today ? 'EXPIRED' : (d.expiry_date as Date) <= soon ? 'EXPIRING_SOON' : 'VALID',
              expiry_date: (d.expiry_date as Date).toISOString().slice(0, 10),
            }))
            .filter((d) => d.expiry_status !== 'VALID');
        });
        return reply.status(200).send({ data, count: data.length });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load expiring documents' });
      }
    },
  );
};
