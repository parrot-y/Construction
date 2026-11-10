import path from 'node:path';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, withTenantTx } from '@construction/db';
import { Role, Roles } from '@construction/permissions';
import { contentTypeForKey, parseStorageKey, resolveUploadPath } from '../lib/uploadSecurity';
import { getStorageDriver } from '../lib/storage';

const TENANT_WIDE: ReadonlySet<string> = new Set([Roles.COMPANY_ADMIN, Roles.ADMIN, Roles.EXECUTIVE]);
const INLINE_TYPES = /^image\/|application\/pdf$|^video\//;

/**
 * Authenticated, tenant-scoped file serving (audit H-02).
 * Replaces the previously public fastify-static /uploads mount: every object
 * under {tenantId}/{projectId}/{file} now requires a session, a matching
 * tenant, and project membership (or a tenant-wide role).
 */
export const fileRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.get(
    '/uploads/*',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const user = request.user;
      const storageKey = (request.params as { '*': string })['*'];
      const parsed = parseStorageKey(storageKey);
      if (!parsed) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'File not found' });
      }
      if (parsed.tenantId !== user.tenantId) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'File not found' });
      }

      const uploadRoot = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
      const filePath = resolveUploadPath(storageKey, uploadRoot);
      if (!filePath) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'File not found' });
      }
      if (!TENANT_WIDE.has(user.role as Role)) {
        const member = await withTenantTx(prisma, user.tenantId, (tx) =>
          tx.projectMember.findFirst({
            where: { project_id: parsed.projectId, user_id: user.sub },
            select: { id: true },
          }),
        );
        if (!member) {
          return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Not a project member' });
        }
      }

      // Stage-2 privacy: CLIENT/OWNER may only fetch files that are either
      // not site-diary photos at all, or photos explicitly marked
      // client-visible. Internal photo keys are refused even for members.
      if (user.role === Roles.CLIENT || user.role === Roles.OWNER) {
        const photo = await withTenantTx(prisma, user.tenantId, (tx) =>
          tx.sitePhoto.findFirst({
            where: { storage_key: storageKey },
            select: { client_visible: true },
          }),
        );
        if (photo && photo.client_visible !== true) {
          return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'File not shared with you' });
        }
      }

      const body = await getStorageDriver().get(storageKey);
      if (!body) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'File not found' });
      }

      const contentType = contentTypeForKey(storageKey);
      const filename = path.basename(storageKey).replace(/[^a-zA-Z0-9._-]/g, '_');
      const disposition = INLINE_TYPES.test(contentType) ? 'inline' : 'attachment';

      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `${disposition}; filename="${filename}"`)
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', 'private, max-age=300')
        .send(body);
    },
  );
};
