import { verifyUpload } from '../lib/uploadSecurity';
import { getStorageDriver } from '../lib/storage';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import {
  CreateSiteDiarySchema,
  CreateProgressRecordSchema,
  SitePhotoInputSchema,
  UpdateSitePhotoVisibilitySchema,
} from '@construction/validation';
import { requirePermission } from '../plugins/rbac';
import { notifyTeam } from '../lib/notify';

/**
 * Stage-2 privacy: CLIENT and OWNER never receive internal diary notes or
 * photos that were not explicitly marked client-visible. Everything else
 * (weather, status, headcounts, deliveries, visible photos) is shared.
 */
function toClientSafeDiary<T extends { general_notes?: string | null; photos?: any[] }>(diary: T): T {
  return {
    ...diary,
    general_notes: null,
    photos: (diary.photos || []).filter((p: any) => p.client_visible === true),
  };
}

export const siteRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // ---------------------------------------------------------------------------
  // 0. POST /api/v1/projects/:projectId/uploads - Real file upload (photos, docs)
  // ---------------------------------------------------------------------------
  server.post(
    '/api/v1/projects/:projectId/uploads',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.SITE_DIARY_CREATE),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      const project = await withTenantTx(prisma, tenantId, async (tx) =>
        tx.project.findFirst({ where: { id: projectId, tenant_id: tenantId }, select: { id: true } }),
      );
      if (!project) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No file uploaded' });
      }

      const buffer = await file.toBuffer();
      const spec = verifyUpload(buffer, file.mimetype);
      if (!spec) {
        return reply.status(415).send({
          statusCode: 415,
          error: 'Unsupported Media Type',
          message: `File type ${file.mimetype} not allowed or content failed verification (images, PDF, MP4/MOV only)`,
        });
      }

      // Extension comes from the verified mime type — never the client filename.
      const storageKey = `${tenantId}/${projectId}/${randomUUID()}${spec.ext}`;
      await getStorageDriver().put(storageKey, buffer);

      await withTenantTx(prisma, tenantId, async (tx) => {
        await recordAuditLog(tx, {
          tenantId,
          actorId: sub,
          action: 'FILE_UPLOAD',
          entityType: 'Project',
          entityId: projectId,
          changes: { storageKey, filename: file.filename, mimetype: file.mimetype, sizeBytes: buffer.length },
        });
      });

      return reply.status(201).send({
        data: {
          storageKey,
          url: `/uploads/${storageKey}`,
          filename: file.filename,
          mimetype: file.mimetype,
          sizeBytes: buffer.length,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // 1. POST /api/v1/projects/:projectId/site-diaries - Create/Sync Daily Site Diary
  // ---------------------------------------------------------------------------
  server.post(
    '/api/v1/projects/:projectId/site-diaries',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.SITE_DIARY_CREATE),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };
      const idempotencyKey = (request.headers['idempotency-key'] as string | undefined)?.trim();

      const parseResult = CreateSiteDiarySchema.safeParse({
        ...(request.body as Record<string, unknown>),
        projectId,
      });

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid site diary data',
          details: parseResult.error.errors,
        });
      }

      const data = parseResult.data;
      const entryDate = new Date(`${data.entryDate}T00:00:00.000Z`);

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          // Idempotency check: if key already exists, return cached response (ADR-004)
          if (idempotencyKey) {
            const existingIdempotency = await tx.idempotencyKey.findUnique({
              where: {
                tenant_id_idempotency_key: {
                  tenant_id: tenantId,
                  idempotency_key: idempotencyKey,
                },
              },
            });

            if (existingIdempotency) {
              return {
                isCached: true,
                status: existingIdempotency.response_status,
                body: existingIdempotency.response_body,
              };
            }
          }

          // Verify project exists
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });

          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          // Check if diary for this date already exists; if so, update or recreate children
          let diary = await tx.siteDiary.findUnique({
            where: {
              project_id_entry_date: {
                project_id: projectId,
                entry_date: entryDate,
              },
            },
          });

          if (diary) {
            diary = await tx.siteDiary.update({
              where: { id: diary.id },
              data: {
                weather: data.weather,
                site_status: data.siteStatus,
                general_notes: data.generalNotes || null,
                is_non_work_day: data.isNonWorkDay ?? false,
              },
            });
            // Clean up existing headcounts & deliveries for replacement
            await tx.laborHeadcount.deleteMany({ where: { site_diary_id: diary.id } });
            await tx.materialDelivery.deleteMany({ where: { site_diary_id: diary.id } });
          } else {
            diary = await tx.siteDiary.create({
              data: {
                tenant_id: tenantId,
                project_id: projectId,
                entry_date: entryDate,
                weather: data.weather,
                site_status: data.siteStatus,
                general_notes: data.generalNotes || null,
                is_non_work_day: data.isNonWorkDay ?? false,
                recorded_by_id: sub,
              },
            });
          }

          // Insert labor headcounts
          if (data.laborHeadcounts && data.laborHeadcounts.length > 0) {
            await tx.laborHeadcount.createMany({
              data: data.laborHeadcounts.map((h) => ({
                tenant_id: tenantId,
                site_diary_id: diary!.id,
                trade_type: h.tradeType,
                headcount: h.headcount,
              })),
            });
          }

          // Insert material deliveries
          if (data.deliveries && data.deliveries.length > 0) {
            await tx.materialDelivery.createMany({
              data: data.deliveries.map((d) => ({
                tenant_id: tenantId,
                site_diary_id: diary!.id,
                material_name: d.materialName,
                quantity: d.quantity,
                unit: d.unit,
                supplier_name: d.supplierName || null,
                supplier_id: d.supplierId || null,
                purchase_order_id: d.purchaseOrderId || null,
                purchase_order_item_id: d.purchaseOrderItemId || null,
                delivery_note: d.deliveryNote || null,
              })),
            });
          }

          // Insert site photos
          if (data.photos && data.photos.length > 0) {
            await tx.sitePhoto.createMany({
              data: data.photos.map((p) => ({
                tenant_id: tenantId,
                site_diary_id: diary!.id,
                storage_key: p.storageKey,
                caption: p.caption || null,
                client_visible: p.clientVisible ?? false,
                taken_at: p.takenAt ? new Date(p.takenAt) : new Date(),
                gps_latitude: p.gpsLatitude !== undefined && p.gpsLatitude !== null ? p.gpsLatitude : null,
                gps_longitude: p.gpsLongitude !== undefined && p.gpsLongitude !== null ? p.gpsLongitude : null,
              })),
            });
          }

          // Record atomic audit log
          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'SITE_DIARY_RECORDED',
            entityType: 'SiteDiary',
            entityId: diary.id,
            changes: {
              entryDate: data.entryDate,
              weather: data.weather,
              siteStatus: data.siteStatus,
              headcountCount: data.laborHeadcounts?.length || 0,
              deliveriesCount: data.deliveries?.length || 0,
              photosCount: data.photos?.length || 0,
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'] || null,
          });

          // Team notification: diary filed (in-app inbox)
          const recorderName = (request.user as any).full_name || (request.user as any).email || 'Site team';
          await notifyTeam(tx, {
            tenantId,
            projectId,
            senderId: sub,
            senderName: recorderName,
            body: `Site diary filed for ${project.name} — ${data.entryDate}: ${data.weather}, ${data.siteStatus}.`,
          });

          const createdDiary = await tx.siteDiary.findUnique({
            where: { id: diary.id },
            include: {
              labor_headcounts: true,
              deliveries: true,
              photos: true,
            },
          });

          const responsePayload = {
            message: 'Daily site diary recorded successfully',
            data: createdDiary,
          };

          // Cache idempotency response if key provided
          if (idempotencyKey) {
            await tx.idempotencyKey.create({
              data: {
                tenant_id: tenantId,
                idempotency_key: idempotencyKey,
                response_status: 201,
                response_body: responsePayload as any,
              },
            });
          }

          return { isCached: false, status: 201, body: responsePayload };
        });

        if (result.isCached) {
          return reply
            .header('X-Cache-Lookup', 'HIT')
            .status(result.status)
            .send(result.body);
        }

        return reply
          .header('X-Cache-Lookup', 'MISS')
          .status(result.status)
          .send(result.body);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to record site diary');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to record daily site diary',
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 2. GET /api/v1/projects/:projectId/site-diaries - List Site Diaries
  // ---------------------------------------------------------------------------
  server.get(
    '/api/v1/projects/:projectId/site-diaries',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.SITE_DIARY_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId } = request.params as { projectId: string };

      // WORKER field role sees only their own diary entries (Stage 4).
      const ownOnly = role === 'WORKER';
      const diaries = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.siteDiary.findMany({
          where: { project_id: projectId, ...(ownOnly ? { recorded_by_id: sub } : {}) },
          include: {
            labor_headcounts: true,
            deliveries: true,
            photos: true,
          },
          orderBy: { entry_date: 'desc' },
        });
      });

      const clientSafe = request.user.role === 'CLIENT' || request.user.role === 'OWNER';
      return reply.status(200).send({
        data: diaries.map((d) => (clientSafe ? toClientSafeDiary(d) : d)),
        count: diaries.length,
      });
    },
  );

  // ---------------------------------------------------------------------------
  // 3. GET /api/v1/projects/:projectId/site-diaries/:diaryId - Site Diary Detail
  // ---------------------------------------------------------------------------
  server.get(
    '/api/v1/projects/:projectId/site-diaries/:diaryId',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.SITE_DIARY_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId, diaryId } = request.params as { projectId: string; diaryId: string };

      const diary = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.siteDiary.findFirst({
          where: {
            id: diaryId,
            project_id: projectId,
            // WORKER field role can only open their own entries (Stage 4).
            ...(role === 'WORKER' ? { recorded_by_id: sub } : {}),
          },
          include: {
            labor_headcounts: true,
            deliveries: true,
            photos: true,
          },
        });
      });

      if (!diary) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Site diary entry not found',
        });
      }

      const clientSafe = request.user.role === 'CLIENT' || request.user.role === 'OWNER';
      return reply.status(200).send({ data: clientSafe ? toClientSafeDiary(diary) : diary });
    },
  );

  // ---------------------------------------------------------------------------
  // 4. POST /api/v1/projects/:projectId/site-diaries/:diaryId/photos - Add Photo
  // ---------------------------------------------------------------------------
  server.post(
    '/api/v1/projects/:projectId/site-diaries/:diaryId/photos',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.SITE_DIARY_CREATE),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, diaryId } = request.params as { projectId: string; diaryId: string };

      const parseResult = SitePhotoInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid photo metadata',
          details: parseResult.error.errors,
        });
      }

      const data = parseResult.data;

      try {
        const photo = await withTenantTx(prisma, tenantId, async (tx) => {
          const diary = await tx.siteDiary.findFirst({
            where: { id: diaryId, project_id: projectId },
          });

          if (!diary) {
            throw { status: 404, message: 'Site diary not found' };
          }

          const createdPhoto = await tx.sitePhoto.create({
            data: {
              tenant_id: tenantId,
              site_diary_id: diaryId,
              storage_key: data.storageKey,
              caption: data.caption || null,
              client_visible: data.clientVisible ?? false,
              taken_at: data.takenAt ? new Date(data.takenAt) : new Date(),
              gps_latitude: data.gpsLatitude !== undefined && data.gpsLatitude !== null ? data.gpsLatitude : null,
              gps_longitude: data.gpsLongitude !== undefined && data.gpsLongitude !== null ? data.gpsLongitude : null,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'SITE_PHOTO_ATTACHED',
            entityType: 'SitePhoto',
            entityId: createdPhoto.id,
            changes: {
              storageKey: data.storageKey,
              gpsLatitude: data.gpsLatitude,
              gpsLongitude: data.gpsLongitude,
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'] || null,
          });

          return createdPhoto;
        });

        return reply.status(201).send({
          message: 'Site photo attached successfully',
          data: photo,
        });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to attach site photo');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to attach site photo',
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 5. POST /api/v1/projects/:projectId/progress - Record Physical Progress %
  // ---------------------------------------------------------------------------
  server.post(
    '/api/v1/projects/:projectId/progress',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.PROGRESS_RECORD),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };
      const idempotencyKey = (request.headers['idempotency-key'] as string | undefined)?.trim();

      const parseResult = CreateProgressRecordSchema.safeParse({
        ...(request.body as Record<string, unknown>),
        projectId,
      });

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid progress recording data',
          details: parseResult.error.errors,
        });
      }

      const data = parseResult.data;
      const recordDate = new Date(`${data.recordDate}T00:00:00.000Z`);

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          // Idempotency check (ADR-004)
          if (idempotencyKey) {
            const existingIdempotency = await tx.idempotencyKey.findUnique({
              where: {
                tenant_id_idempotency_key: {
                  tenant_id: tenantId,
                  idempotency_key: idempotencyKey,
                },
              },
            });

            if (existingIdempotency) {
              return {
                isCached: true,
                status: existingIdempotency.response_status,
                body: existingIdempotency.response_body,
              };
            }
          }

          const project = await tx.project.findFirst({
            where: { id: projectId },
          });

          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          // Create ProgressRecord
          const progressRecord = await tx.progressRecord.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              record_date: recordDate,
              overall_progress: data.overallProgress,
              notes: data.notes || null,
            },
          });

          // Insert BOQ line item progress items if provided
          if (data.items && data.items.length > 0) {
            await tx.progressItem.createMany({
              data: data.items.map((it) => ({
                tenant_id: tenantId,
                progress_record_id: progressRecord.id,
                boq_item_id: it.boqItemId,
                completed_quantity: it.completedQuantity,
                completion_pct: it.completionPct,
              })),
            });
          }

          // Record atomic audit log
          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'PROGRESS_RECORDED',
            entityType: 'ProgressRecord',
            entityId: progressRecord.id,
            changes: {
              overallProgress: data.overallProgress,
              itemsCount: data.items?.length || 0,
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'] || null,
          });

          const created = await tx.progressRecord.findUnique({
            where: { id: progressRecord.id },
            include: {
              items: {
                include: {
                  boq_item: {
                    select: { item_code: true, description: true, total_amount: true },
                  },
                },
              },
            },
          });

          const responsePayload = {
            message: 'Physical progress recorded successfully',
            data: created,
          };

          // Cache idempotency response if key provided
          if (idempotencyKey) {
            await tx.idempotencyKey.create({
              data: {
                tenant_id: tenantId,
                idempotency_key: idempotencyKey,
                response_status: 201,
                response_body: responsePayload as any,
              },
            });
          }

          return { isCached: false, status: 201, body: responsePayload };
        });

        if (result.isCached) {
          return reply
            .header('X-Cache-Lookup', 'HIT')
            .status(result.status)
            .send(result.body);
        }

        return reply
          .header('X-Cache-Lookup', 'MISS')
          .status(result.status)
          .send(result.body);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to record physical progress');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to record physical progress',
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 6. GET /api/v1/projects/:projectId/progress - Get Progress History & Timeline
  // ---------------------------------------------------------------------------
  server.get(
    '/api/v1/projects/:projectId/progress',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.PROGRESS_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      const records = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.progressRecord.findMany({
          where: { project_id: projectId },
          include: {
            items: {
              include: {
                boq_item: {
                  select: { id: true, item_code: true, description: true },
                },
              },
            },
          },
          orderBy: { record_date: 'desc' },
        });
      });

      const latestOverall = records[0] ? records[0].overall_progress.toString() : '0.0000';

      return reply.status(200).send({
        data: records,
        count: records.length,
        latestOverallProgress: latestOverall,
        latestOverallPercentage: (parseFloat(latestOverall) * 100).toFixed(2),
      });
    },
  );


  // ---------------------------------------------------------------------------
  // 6. PATCH /api/v1/projects/:projectId/site-diaries/:diaryId/photos/:photoId/visibility
  // Gate-4 S7: per-photo client visibility toggle (opt-in sharing)
  // ---------------------------------------------------------------------------
  server.patch(
    '/api/v1/projects/:projectId/site-diaries/:diaryId/photos/:photoId/visibility',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.SITE_DIARY_CREATE),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, diaryId, photoId } = request.params as {
        projectId: string;
        diaryId: string;
        photoId: string;
      };

      const parseResult = UpdateSitePhotoVisibilitySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid visibility payload',
          details: parseResult.error.errors,
        });
      }
      const { clientVisible } = parseResult.data;

      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const photo = await tx.sitePhoto.findFirst({
            where: { id: photoId, site_diary_id: diaryId },
            include: { site_diary: { select: { project_id: true } } },
          });
          if (!photo || photo.site_diary.project_id !== projectId) {
            throw { status: 404, message: 'Site photo not found' };
          }

          const record = await tx.sitePhoto.update({
            where: { id: photoId },
            data: { client_visible: clientVisible },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'SITE_PHOTO_VISIBILITY_UPDATED',
            entityType: 'SitePhoto',
            entityId: photoId,
            changes: { clientVisible },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'] || null,
          });

          return record;
        });

        return reply.status(200).send({ message: 'Photo visibility updated', data: updated });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to update photo visibility');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to update photo visibility',
        });
      }
    },
  );
};
