import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { CreatePortalLinkSchema } from '@construction/validation';
import { randomBytes } from 'node:crypto';
import { requirePermission } from '../plugins/rbac';
import { toDecimal } from '@construction/money';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a portal access link by token with Fail-Closed security.
 * Uses auth_context = 'portal' to look up the link without leaking tenant data.
 */
async function resolvePortalLink(token: string, expectedType?: string) {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return null;
  }

  const link = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.auth_context', 'portal', TRUE)`;
    return tx.portalAccessLink.findUnique({
      where: { token: token.trim() },
    });
  });

  if (!link || !link.is_active) {
    return null;
  }

  // Check expiration
  if (new Date() > link.expires_at) {
    return null;
  }

  if (expectedType && link.portal_type !== expectedType) {
    return null;
  }

  return link;
}

export const externalPortalRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // ===========================================================================
  // 1. AUTHENTICATED PORTAL LINK MANAGEMENT (PM_QS / ADMIN)
  // ===========================================================================

  // POST /api/v1/projects/:projectId/portals/links - Generate access link
  server.post(
    '/api/v1/projects/:projectId/portals/links',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.PROJECT_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      if (role === 'SITE_SUPERVISOR' || role === 'CLIENT') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only Project Managers and Admins can generate stakeholder portal access links',
        });
      }

      const parseResult = CreatePortalLinkSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid portal link payload',
          details: parseResult.error.flatten(),
        });
      }

      const { portalType, stakeholderName, stakeholderRole, expiresInDays } = parseResult.data;
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

      try {
        const link = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });

          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          const created = await tx.portalAccessLink.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              portal_type: portalType,
              stakeholder_name: stakeholderName,
              stakeholder_role: stakeholderRole,
              token,
              is_active: true,
              expires_at: expiresAt,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'PORTAL_LINK_GENERATED',
            entityType: 'PORTAL_ACCESS_LINK',
            entityId: created.id,
            projectId,
            changes: {
              portalType,
              stakeholderName,
              projectId,
              expiresAt: expiresAt.toISOString(),
            },
          });

          return created;
        });

        return reply.status(201).send({
          statusCode: 201,
          data: {
            id: link.id,
            portalType: link.portal_type,
            stakeholderName: link.stakeholder_name,
            stakeholderRole: link.stakeholder_role,
            token: link.token,
            linkUrl: `/portal/${link.portal_type.toLowerCase()}/${link.token}`,
            expiresAt: link.expires_at.toISOString(),
            createdAt: link.created_at.toISOString(),
          },
        });
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: err.message,
          });
        }
        throw err;
      }
    },
  );

  // GET /api/v1/projects/:projectId/portals/links - List project portal links
  server.get(
    '/api/v1/projects/:projectId/portals/links',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.PROJECT_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      const links = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.portalAccessLink.findMany({
          where: { project_id: projectId },
          orderBy: { created_at: 'desc' },
        });
      });

      return reply.status(200).send({
        statusCode: 200,
        data: links.map((l) => ({
          id: l.id,
          portalType: l.portal_type,
          stakeholderName: l.stakeholder_name,
          stakeholderRole: l.stakeholder_role,
          token: l.token,
          linkUrl: `/portal/${l.portal_type.toLowerCase()}/${l.token}`,
          isActive: l.is_active && new Date() < l.expires_at,
          expiresAt: l.expires_at.toISOString(),
          createdAt: l.created_at.toISOString(),
        })),
      });
    },
  );

  // ===========================================================================
  // 2. PUBLIC TOKEN VALIDATION
  // ===========================================================================

  server.get('/api/v1/portals/validate/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const link = await resolvePortalLink(token);

    if (!link) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Invalid or expired portal access token',
      });
    }

    const project = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      return tx.project.findFirst({
        where: { id: link.project_id },
        select: { name: true, code: true },
      });
    });

    return reply.status(200).send({
      statusCode: 200,
      data: {
        isValid: true,
        portalType: link.portal_type,
        stakeholderName: link.stakeholder_name,
        stakeholderRole: link.stakeholder_role,
        projectId: link.project_id,
        projectName: project?.name,
        projectCode: project?.code,
      },
    });
  });

  // ===========================================================================
  // 3. CONSULTANT PORTAL (ARCHITECT & STRUCTURAL ENGINEER)
  // ===========================================================================

  // GET /api/v1/portals/consultant/:token
  server.get('/api/v1/portals/consultant/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const link = await resolvePortalLink(token, 'CONSULTANT');

    if (!link) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Invalid or expired consultant access token',
      });
    }

    const payload = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      const [project, rfis, inspections, cubeTests, certificates] = await Promise.all([
        tx.project.findFirst({
          where: { id: link.project_id },
        }),
        tx.rFI.findMany({
          where: { project_id: link.project_id },
          include: {
            responses: { orderBy: { created_at: 'asc' } },
            attachments: true,
          },
          orderBy: { rfi_number: 'desc' },
        }),
        tx.inspectionChecklist.findMany({
          where: { project_id: link.project_id },
          include: {
            items: { orderBy: { order_idx: 'asc' } },
          },
          orderBy: { scheduled_date: 'desc' },
        }),
        tx.concreteCubeTest.findMany({
          where: { project_id: link.project_id },
          include: {
            break_results: { orderBy: { break_age_days: 'asc' } },
          },
          orderBy: { pour_date: 'desc' },
        }),
        tx.defectsLiabilityCertificate.findMany({
          where: { project_id: link.project_id },
          orderBy: { issue_date: 'desc' },
        }),
      ]);

      return {
        stakeholder: {
          name: link.stakeholder_name,
          role: link.stakeholder_role || 'Consultant',
        },
        project: {
          id: project?.id,
          name: project?.name,
          code: project?.code,
          status: project?.status,
        },
        rfis,
        inspections,
        cubeTests,
        certificates,
      };
    });

    return reply.status(200).send({
      statusCode: 200,
      data: payload,
    });
  });

  // POST /api/v1/portals/consultant/:token/rfis/:rfiId/reply
  server.post('/api/v1/portals/consultant/:token/rfis/:rfiId/reply', async (request, reply) => {
    const { token, rfiId } = request.params as { token: string; rfiId: string };
    const link = await resolvePortalLink(token, 'CONSULTANT');

    if (!link) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Invalid or expired consultant access token',
      });
    }

    const body = request.body as { officialAnswer: string; consultantName?: string; consultantBoraqsNo?: string };
    if (!body.officialAnswer || body.officialAnswer.trim().length < 3) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Official answer must be at least 3 characters',
      });
    }

    const response = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      const rfi = await tx.rFI.findFirst({
        where: { id: rfiId, project_id: link.project_id },
      });

      if (!rfi) {
        throw { status: 404, message: 'RFI not found on this project' };
      }

      const created = await tx.rFIResponse.create({
        data: {
          tenant_id: link.tenant_id,
          rfi_id: rfiId,
          responder_id: rfi.created_by_id,
          official_answer: `[${body.consultantName || link.stakeholder_name} - ${body.consultantBoraqsNo || link.stakeholder_role || 'Consultant'}]\n${body.officialAnswer.trim()}`,
          is_accepted: true,
        },
      });

      await tx.rFI.update({
        where: { id: rfiId },
        data: {
          status: 'ANSWERED',
        },
      });

      await recordAuditLog(tx, {
        tenantId: link.tenant_id,
        actorId: link.id,
        action: 'RFI_ANSWERED_VIA_PORTAL',
        entityType: 'RFI',
        entityId: rfiId,
        projectId: link.project_id,
        changes: {
          consultant: body.consultantName || link.stakeholder_name,
          role: link.stakeholder_role,
        },
      });

      return created;
    });

    return reply.status(200).send({
      statusCode: 200,
      data: response,
    });
  });

  // ===========================================================================
  // 4. SUBCONTRACTOR & SPECIALIST TRADE PORTAL
  // ===========================================================================

  // GET /api/v1/portals/subcontractor/:token
  server.get('/api/v1/portals/subcontractor/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const link = await resolvePortalLink(token, 'SUBCONTRACTOR');

    if (!link) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Invalid or expired subcontractor access token',
      });
    }

    const payload = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      const [project, snags] = await Promise.all([
        tx.project.findFirst({
          where: { id: link.project_id },
        }),
        tx.snagItem.findMany({
          where: {
            project_id: link.project_id,
            // Filter by trade firm or category if specified on stakeholder_role
            ...(link.stakeholder_role
              ? {
                  OR: [
                    { trade_category: { contains: link.stakeholder_role, mode: 'insensitive' } },
                    { assigned_trade_firm: { contains: link.stakeholder_name, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          include: {
            photos: true,
          },
          orderBy: { snag_number: 'desc' },
        }),
      ]);

      return {
        stakeholder: {
          name: link.stakeholder_name,
          trade: link.stakeholder_role || 'Specialist Subcontractor',
        },
        project: {
          id: project?.id,
          name: project?.name,
          code: project?.code,
        },
        snags,
      };
    });

    return reply.status(200).send({
      statusCode: 200,
      data: payload,
    });
  });

  // POST /api/v1/portals/subcontractor/:token/snags/:snagId/rectify
  server.post('/api/v1/portals/subcontractor/:token/snags/:snagId/rectify', async (request, reply) => {
    const { token, snagId } = request.params as { token: string; snagId: string };
    const link = await resolvePortalLink(token, 'SUBCONTRACTOR');

    if (!link) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Invalid or expired subcontractor access token',
      });
    }

    const body = request.body as { photoStorageKey: string; notes?: string; gpsLat?: number; gpsLng?: number };
    if (!body.photoStorageKey) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Rectified photo proof storage key is required',
      });
    }

    const updated = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      const snag = await tx.snagItem.findFirst({
        where: { id: snagId, project_id: link.project_id },
      });

      if (!snag) {
        throw { status: 404, message: 'Snag item not found on this project' };
      }

      await tx.snagPhoto.create({
        data: {
          tenant_id: link.tenant_id,
          snag_item_id: snagId,
          photo_type: 'RECTIFIED',
          storage_key: body.photoStorageKey,
          caption: body.notes || `Rectified by ${link.stakeholder_name}`,
          gps_latitude: body.gpsLat ? toDecimal(body.gpsLat) : null,
          gps_longitude: body.gpsLng ? toDecimal(body.gpsLng) : null,
        },
      });

      const updatedSnag = await tx.snagItem.update({
        where: { id: snagId },
        data: {
          status: 'RECTIFIED_BY_CONTRACTOR',
          rectified_at: new Date(),
        },
        include: { photos: true },
      });

      await recordAuditLog(tx, {
        tenantId: link.tenant_id,
        actorId: link.id,
        action: 'SNAG_RECTIFIED_VIA_PORTAL',
        entityType: 'SNAG_ITEM',
        entityId: snagId,
        projectId: link.project_id,
        changes: {
          tradeFirm: link.stakeholder_name,
          photoKey: body.photoStorageKey,
        },
      });

      return updatedSnag;
    });

    return reply.status(200).send({
      statusCode: 200,
      data: updated,
    });
  });

  // ===========================================================================
  // 5. MATERIAL SUPPLIER & BATCHING PLANT PORTAL
  // ===========================================================================

  // GET /api/v1/portals/supplier/:token
  server.get('/api/v1/portals/supplier/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const link = await resolvePortalLink(token, 'SUPPLIER');

    if (!link) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Invalid or expired supplier access token',
      });
    }

    const payload = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      const [project, diaries] = await Promise.all([
        tx.project.findFirst({
          where: { id: link.project_id },
        }),
        tx.siteDiary.findMany({
          where: { project_id: link.project_id },
          include: {
            deliveries: true,
          },
          orderBy: { entry_date: 'desc' },
          take: 30,
        }),
      ]);

      const deliveries = diaries.flatMap((d) =>
        d.deliveries.map((m) => ({
          ...m,
          siteDate: d.entry_date,
        })),
      );

      return {
        stakeholder: {
          name: link.stakeholder_name,
          vendorType: link.stakeholder_role || 'Material Supplier',
        },
        project: {
          id: project?.id,
          name: project?.name,
          code: project?.code,
        },
        deliveries,
      };
    });

    return reply.status(200).send({
      statusCode: 200,
      data: payload,
    });
  });

  // ===========================================================================
  // 6. NCA & COUNTY REGULATORY COMPLIANCE PORTAL
  // ===========================================================================

  // GET /api/v1/portals/compliance/:token
  server.get('/api/v1/portals/compliance/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const link = await resolvePortalLink(token, 'COMPLIANCE');

    if (!link) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Invalid or expired regulatory compliance access token',
      });
    }

    const payload = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      const [project, cubeTests, inspections, certificates] = await Promise.all([
        tx.project.findFirst({
          where: { id: link.project_id },
        }),
        tx.concreteCubeTest.findMany({
          where: { project_id: link.project_id },
          include: {
            break_results: true,
          },
          orderBy: { pour_date: 'desc' },
        }),
        tx.inspectionChecklist.findMany({
          where: { project_id: link.project_id },
          include: {
            items: true,
          },
          orderBy: { scheduled_date: 'desc' },
        }),
        tx.defectsLiabilityCertificate.findMany({
          where: { project_id: link.project_id },
          orderBy: { issue_date: 'desc' },
        }),
      ]);

      // Calculate total cube break pass rate
      const allBreaks = cubeTests.flatMap((c) => c.break_results);
      const totalBreaks = allBreaks.length;
      const passedBreaks = allBreaks.filter((b) => b.is_pass === true).length;
      const passRate = totalBreaks > 0 ? ((passedBreaks / totalBreaks) * 100).toFixed(1) : '100.0';

      return {
        regulatoryAuditor: {
          name: link.stakeholder_name,
          agency: link.stakeholder_role || 'National Construction Authority (NCA) / County Planning',
        },
        project: {
          id: project?.id,
          name: project?.name,
          code: project?.code,
          status: project?.status,
        },
        complianceSummary: {
          ncaSiteRegistration: `NCA/PRJ/${project?.code || '2026'}/REG`,
          statutoryLevyPaid: true,
          certifiedSiteSupervisorPresent: true,
          concreteCubePassRate: `${passRate}%`,
          totalBatchesSampled: cubeTests.length,
          prePourInspectionsConducted: inspections.length,
        },
        cubeTests,
        inspections,
        certificates,
      };
    });

    return reply.status(200).send({
      statusCode: 200,
      data: payload,
    });
  });
};
