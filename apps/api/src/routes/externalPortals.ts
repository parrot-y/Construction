import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { CreatePortalLinkSchema, ClientVariationRespondSchema, ConsultantRfiReplySchema, SupplierDeliveryActionSchema } from '@construction/validation';
import { randomBytes, createHash } from 'node:crypto';
import { requirePermission } from '../plugins/rbac';
import { toDecimal } from '@construction/money';
import { randomUUID } from 'node:crypto';
import { verifyUpload } from '../lib/uploadSecurity';
import { getStorageDriver } from '../lib/storage';
import {
  applyCoBudgetRollup,
  claimCoTransition,
  normalizeCoStatus,
  recordCoEvent,
} from '../services/variationWorkflow';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a portal access link by token with Fail-Closed security.
 * Uses narrow SECURITY DEFINER lookup_portal_link_by_hash with SHA-256 without auth_context bypasses (2c, 2d).
 */
async function resolvePortalLink(token: string, expectedType?: string) {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return null;
  }

  const tokenHash = createHash('sha256').update(token.trim()).digest('hex');

  const rows = await prisma.$queryRaw<any[]>`
    SELECT * FROM lookup_portal_link_by_hash(${tokenHash}::text);
  `;

  if (rows.length === 0) {
    return null;
  }

  const link = rows[0];

  if (!link || !link.is_active) {
    return null;
  }

  // Check expiration
  if (new Date() > new Date(link.expires_at)) {
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
        requirePermission(Permissions.PORTAL_MANAGE),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
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

      const { portalType, stakeholderName, stakeholderRole, expiresInDays, subcontractorPackageId } = parseResult.data as any;
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

      try {
        const link = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });

          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          // SUBCONTRACTOR links must be scoped to exactly one work package —
          // without it the portal would see every package on the project.
          if (portalType === 'SUBCONTRACTOR' && !subcontractorPackageId) {
            throw { status: 400, message: 'subcontractorPackageId is required for SUBCONTRACTOR portal links' };
          }
          if (portalType === 'SUBCONTRACTOR' && subcontractorPackageId) {
            const pkg = await tx.subcontractorPackage.findFirst({
              where: { id: subcontractorPackageId, project_id: projectId },
              select: { id: true },
            });
            if (!pkg) throw { status: 404, message: 'Subcontractor package not found on this project' };
          }

          const created = await tx.portalAccessLink.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              portal_type: portalType,
              stakeholder_name: stakeholderName,
              stakeholder_role: stakeholderRole,
              token_hash: tokenHash,
              is_active: true,
              expires_at: expiresAt,
              subcontractor_package_id: portalType === 'SUBCONTRACTOR' ? subcontractorPackageId : null,
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

        // Show the raw token only once at creation (2d, H5)
        return reply.status(201).send({
          statusCode: 201,
          data: {
            id: link.id,
            portalType: link.portal_type,
            stakeholderName: link.stakeholder_name,
            stakeholderRole: link.stakeholder_role,
            token: rawToken,
            linkUrl: `/?portal=${link.portal_type.toLowerCase()}&token=${rawToken}`,
            expiresAt: link.expires_at.toISOString(),
            createdAt: link.created_at.toISOString(),
          },
        });
      } catch (err: any) {
        if (err?.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
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
        requirePermission(Permissions.PORTAL_MANAGE),
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
          token: null, // Tokens stored as SHA-256 hashes; never exposed in listings (2d, H5)
          linkUrl: null,
          isActive: l.is_active && new Date() < l.expires_at,
          expiresAt: l.expires_at.toISOString(),
          createdAt: l.created_at.toISOString(),
          lastUsedAt: l.last_used_at?.toISOString() ?? null,
          useCount: l.use_count,
        })),
      });
    },
  );

  // POST /api/v1/projects/:projectId/portals/links/:linkId/regenerate — new token, old revoked
  server.post(
    '/api/v1/projects/:projectId/portals/links/:linkId/regenerate',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.PORTAL_MANAGE),
      ],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, linkId } = request.params as { projectId: string; linkId: string };
      if (!UUID_REGEX.test(linkId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Portal link not found' });
      }
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      try {
        const link = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.portalAccessLink.findFirst({
            where: { id: linkId, project_id: projectId },
          });
          if (!existing) throw { status: 404, message: 'Portal link not found' };
          await tx.portalAccessLink.update({
            where: { id: linkId },
            data: { is_active: false },
          });
          const created = await tx.portalAccessLink.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              portal_type: existing.portal_type,
              stakeholder_name: existing.stakeholder_name,
              stakeholder_role: existing.stakeholder_role,
              token_hash: tokenHash,
              is_active: true,
              expires_at: existing.expires_at,
              subcontractor_package_id: existing.subcontractor_package_id,
            },
          });
          await recordAuditLog(tx, {
            tenantId, actorId: sub, action: 'PORTAL_LINK_REGENERATED',
            entityType: 'PORTAL_ACCESS_LINK', entityId: created.id, projectId,
            changes: { portalType: existing.portal_type, stakeholderName: existing.stakeholder_name, revokedLinkId: linkId },
          });
          return created;
        });
        return reply.status(201).send({
          statusCode: 201,
          data: {
            id: link.id,
            portalType: link.portal_type,
            stakeholderName: link.stakeholder_name,
            token: rawToken,
            linkUrl: `/?portal=${link.portal_type.toLowerCase()}&token=${rawToken}`,
            expiresAt: link.expires_at.toISOString(),
          },
        });
      } catch (err: any) {
        if (err.status === 404) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        throw err;
      }
    },
  );

  // DELETE /api/v1/projects/:projectId/portals/links/:linkId — revoke
  server.delete(
    '/api/v1/projects/:projectId/portals/links/:linkId',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.PORTAL_MANAGE),
      ],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, linkId } = request.params as { projectId: string; linkId: string };
      if (!UUID_REGEX.test(linkId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Portal link not found' });
      }
      const revoked = await withTenantTx(prisma, tenantId, async (tx) => {
        const existing = await tx.portalAccessLink.findFirst({
          where: { id: linkId, project_id: projectId },
        });
        if (!existing) return null;
        await tx.portalAccessLink.update({ where: { id: linkId }, data: { is_active: false } });
        await recordAuditLog(tx, {
          tenantId, actorId: sub, action: 'PORTAL_LINK_REVOKED',
          entityType: 'PORTAL_ACCESS_LINK', entityId: linkId, projectId,
          changes: { portalType: existing.portal_type, stakeholderName: existing.stakeholder_name },
        });
        return existing;
      });
      if (!revoked) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Portal link not found' });
      }
      return reply.status(200).send({ statusCode: 200, data: { id: linkId, isActive: false } });
    },
  );

  // ===========================================================================
  // 2. PUBLIC TOKEN VALIDATION
  // ===========================================================================

  server.get('/api/v1/portals/validate/:token', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
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
  server.get('/api/v1/portals/consultant/:token', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
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
          select: { id: true, name: true, code: true, status: true },
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
        linkExpiresAt: link.expires_at.toISOString(),
        project: project ?? null,
        rfis: (rfis || []).map((r: any) => ({
          id: r.id,
          rfiNumber: r.rfi_number,
          title: r.title,
          question: r.question,
          drawingReference: r.drawing_reference,
          specificationClause: r.specification_clause,
          issueType: r.issue_type,
          priority: r.priority,
          status: r.status,
          costImpact: r.cost_impact?.toString(),
          scheduleImpactDays: r.schedule_impact_days,
          dueDate: r.due_date,
          createdAt: r.created_at,
          responses: (r.responses || []).map((x: any) => ({
            id: x.id,
            officialAnswer: x.official_answer,
            isAccepted: x.is_accepted,
            responderName: x.external_responder_name,
            createdAt: x.created_at,
          })),
          attachments: (r.attachments || []).map((a: any) => ({
            id: a.id, filename: a.filename, fileSize: a.file_size, mimeType: a.mime_type, storageKey: a.storage_key,
          })),
        })),
        inspections: (inspections || []).map((i: any) => ({
          id: i.id,
          title: i.title,
          checklistType: i.checklist_type,
          inspectionType: i.inspection_type,
          assignedConsultant: i.assigned_consultant,
          location: i.location,
          status: i.status,
          scheduledDate: i.scheduled_date,
          inspectedAt: i.inspected_at,
          inspectorName: i.inspector_name,
          summaryNotes: i.summary_notes,
          items: (i.items || []).map((it: any) => ({
            id: it.id, orderIdx: it.order_idx, checkPoint: it.check_point,
            isMandatory: it.is_mandatory, result: it.result, deficiencyNotes: it.deficiency_notes,
          })),
        })),
        cubeTests: (cubeTests || []).map((c: any) => ({
          id: c.id,
          pourLocation: c.pour_location,
          pourDate: c.pour_date,
          concreteClass: c.concrete_class,
          targetStrengthMpa: c.target_strength_mpa?.toString(),
          slumpTestedMm: c.slump_tested_mm,
          supplierName: c.supplier_name,
          deliveryDocketNo: c.delivery_docket_no,
          breakResults: (c.break_results || []).map((b: any) => ({
            id: b.id, cubeNumber: b.cube_number, breakAgeDays: b.break_age_days,
            compressiveMpa: b.compressive_mpa?.toString(), isPass: b.is_pass, labName: b.lab_name,
          })),
        })),
        certificates: (certificates || []).map((c: any) => ({
          id: c.id, certificateType: c.certificate_type, certificateReference: c.certificate_reference,
          issueDate: c.issue_date, effectiveDate: c.effective_date,
          dlpDurationMonths: c.dlp_duration_months, dlpExpiryDate: c.dlp_expiry_date,
          retentionAmountReleased: c.retention_amount_released?.toString(),
          architectName: c.architect_name, qsName: c.qs_name,
        })),
      };
    });

    return reply.status(200).send({
      statusCode: 200,
      data: payload,
    });
  });

  // POST /api/v1/portals/consultant/:token/rfis/:rfiId/reply
  server.post('/api/v1/portals/consultant/:token/rfis/:rfiId/reply', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
    const { token, rfiId } = request.params as { token: string; rfiId: string };
    const link = await resolvePortalLink(token, 'CONSULTANT');

    if (!link) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Invalid or expired consultant access token',
      });
    }

    const parsed = ConsultantRfiReplySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid reply payload — officialAnswer must be 3-5000 characters',
        details: parsed.error.flatten(),
      });
    }
    const body = parsed.data;

    const response = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      const rfi = await tx.rFI.findFirst({
        where: { id: rfiId, project_id: link.project_id },
      });

      if (!rfi) {
        throw { status: 404, message: 'RFI not found on this project' };
      }
      if (rfi.status === 'ANSWERED' || rfi.status === 'CLOSED') {
        throw { status: 409, message: `RFI is already ${rfi.status.toLowerCase()} — replies are closed` };
      }

      const created = await tx.rFIResponse.create({
        data: {
          tenant_id: link.tenant_id,
          rfi_id: rfiId,
          responder_id: null,
          external_responder_name: body.consultantName || link.stakeholder_name,
          external_link_id: link.id,
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
    }).catch((err: any) => {
      if (err?.status) {
        return { __portalError: { status: err.status, message: err.message } };
      }
      throw err;
    });

    if ((response as any)?.__portalError) {
      const e = (response as any).__portalError;
      return reply.status(e.status).send({ statusCode: e.status, error: e.status === 404 ? 'Not Found' : 'Conflict', message: e.message });
    }

    return reply.status(200).send({
      statusCode: 200,
      data: response,
    });
  });

  // ===========================================================================
  // 4. SUBCONTRACTOR & SPECIALIST TRADE PORTAL
  // ===========================================================================

  // GET /api/v1/portals/subcontractor/:token
  server.get('/api/v1/portals/subcontractor/:token', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
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
      const project = await tx.project.findFirst({
        where: { id: link.project_id },
        select: { id: true, name: true, code: true },
      });

      // A SUBCONTRACTOR link is bound to exactly one work package at creation.
      // No package binding => no data (never fall back to "all packages").
      const pkg = link.subcontractor_package_id
        ? await tx.subcontractorPackage.findFirst({
            where: { id: link.subcontractor_package_id, project_id: link.project_id },
            include: { valuations: { orderBy: { valuation_date: 'desc' } } },
          })
        : null;

      // Snags are scoped to the package's trade category / firm name (exact,
      // case-insensitive — no substring matching across firms).
      const snagScope = pkg
        ? {
            is_private: false,
            OR: [
              { trade_category: { equals: pkg.trade_category, mode: 'insensitive' as const } },
              { assigned_trade_firm: { equals: pkg.firm_name, mode: 'insensitive' as const } },
            ],
          }
        : null;

      const snags = snagScope
        ? await tx.snagItem.findMany({
            where: { project_id: link.project_id, ...snagScope },
            include: { photos: true },
            orderBy: { snag_number: 'desc' },
          })
        : [];

      // Explicit DTO — no internal ids beyond what the portal needs.
      const packages = pkg
        ? [{
            id: pkg.id,
            tradeCategory: pkg.trade_category,
            firmName: pkg.firm_name,
            scopeDescription: pkg.scope_description,
            subcontractSum: pkg.subcontract_sum.toString(),
            retentionRatePct: pkg.retention_rate_pct.toString(),
            status: pkg.status,
            valuations: (pkg.valuations || []).map((v: any) => ({
              id: v.id,
              certificateNo: v.certificate_no,
              valuationDate: v.valuation_date,
              grossWorkCertifiedKes: v.gross_work_certified_kes.toString(),
              retentionDeductedKes: v.retention_deducted_kes.toString(),
              previousPaymentsDeductedKes: v.previous_payments_deducted_kes.toString(),
              withholdingTaxDeductedKes: v.withholding_tax_deducted_kes.toString(),
              netPayableKes: v.net_payable_kes.toString(),
              paymentStatus: v.payment_status,
              notes: v.notes,
            })),
          }]
        : [];

      return {
        stakeholder: {
          name: link.stakeholder_name,
          trade: link.stakeholder_role || pkg?.trade_category || 'Specialist Subcontractor',
        },
        linkExpiresAt: link.expires_at.toISOString(),
        project: project ?? null,
        snags: snags.map((sn: any) => ({
          id: sn.id,
          snagNumber: sn.snag_number,
          description: sn.description,
          locationBlock: sn.location_block,
          locationFloor: sn.location_floor,
          locationRoom: sn.location_room,
          tradeCategory: sn.trade_category,
          severity: sn.severity,
          status: sn.status,
          identifiedAt: sn.identified_at,
          rectifiedAt: sn.rectified_at,
          photos: (sn.photos || []).map((ph: any) => ({
            id: ph.id,
            photoType: ph.photo_type,
            caption: ph.caption,
            storageKey: ph.storage_key,
            capturedAt: ph.captured_at,
          })),
        })),
        packages,
      };
    });

    return reply.status(200).send({
      statusCode: 200,
      data: payload,
    });
  });

  // POST /api/v1/portals/subcontractor/:token/snags/:snagId/upload — rectification photo
  server.post(
    '/api/v1/portals/subcontractor/:token/snags/:snagId/upload',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const link = await resolvePortalLink(token, 'SUBCONTRACTOR');
      if (!link) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invalid or expired subcontractor access token' });
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
      // Key is namespaced to this link's tenant + project — same layout as
      // authenticated site uploads so the shared /uploads route can serve it.
      const storageKey = `${link.tenant_id}/${link.project_id}/${randomUUID()}${spec.ext}`;
      await getStorageDriver().put(storageKey, buffer);
      return reply.status(201).send({
        statusCode: 201,
        data: { storageKey, url: `/uploads/${storageKey}`, mimetype: spec.contentType, sizeBytes: buffer.length },
      });
    },
  );

  // POST /api/v1/portals/subcontractor/:token/snags/:snagId/rectify
  server.post('/api/v1/portals/subcontractor/:token/snags/:snagId/rectify', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
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
    // The key must have been issued by this link's tenant+project upload route —
    // reject arbitrary keys that would point at another tenant's files.
    const expectedPrefix = `${link.tenant_id}/${link.project_id}/`;
    if (!body.photoStorageKey.startsWith(expectedPrefix) || body.photoStorageKey.includes('..')) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'photoStorageKey was not issued for this project — upload via the portal upload endpoint first',
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


  // POST /api/v1/portals/subcontractor/:token/valuations — sub submits a progress valuation
  server.post('/api/v1/portals/subcontractor/:token/valuations', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
    const { token } = request.params as { token: string };
    const link = await resolvePortalLink(token, 'SUBCONTRACTOR');
    if (!link) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invalid or expired subcontractor access token' });
    }
    const body = request.body as { packageId?: string; grossWorkCertifiedKes?: string | number; notes?: string };
    // The link is bound to one package — a valuation can only target that package.
    if (!link.subcontractor_package_id) {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'This portal link is not bound to a work package' });
    }
    if (body?.packageId && body.packageId !== link.subcontractor_package_id) {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Valuations can only be submitted for the linked work package' });
    }
    let gross: ReturnType<typeof toDecimal>;
    try {
      gross = toDecimal(String(body?.grossWorkCertifiedKes ?? ''));
    } catch {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'grossWorkCertifiedKes must be a positive amount' });
    }
    if (gross.lte(0)) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'grossWorkCertifiedKes must be a positive amount' });
    }
    const WHT_RATE_PCT = toDecimal(process.env.PORTAL_WHT_RATE_PCT || '3.00');
    try {
      const valuation = await withTenantTx(prisma, link.tenant_id, async (tx) => {
        const pkg = await tx.subcontractorPackage.findFirst({
          where: { id: link.subcontractor_package_id, project_id: link.project_id },
        });
        if (!pkg) throw new Error('Work package not found on this project');

        // Certified-to-date = sum of gross on prior valuations; previous
        // payments = net payable already approved/paid on prior valuations.
        const prior = await tx.subcontractorValuation.findMany({
          where: { subcontractor_package_id: pkg.id },
          select: { gross_work_certified_kes: true, net_payable_kes: true, payment_status: true },
        });
        const certifiedToDate = prior.reduce((acc, v) => acc.plus(toDecimal(v.gross_work_certified_kes.toString())), toDecimal('0'));
        const prevPayments = prior
          .filter((v) => ['APPROVED_FOR_PAYMENT', 'PAID'].includes(v.payment_status))
          .reduce((acc, v) => acc.plus(toDecimal(v.net_payable_kes.toString())), toDecimal('0'));

        // Gross is cumulative work certified — cap at the package contract sum.
        const packageSum = toDecimal(pkg.subcontract_sum.toString());
        if (gross.gt(packageSum)) {
          throw new Error(`Gross work certified cannot exceed the package contract sum (${packageSum.toFixed(2)})`);
        }
        if (gross.lte(certifiedToDate)) {
          throw new Error(`Gross work certified must exceed certified-to-date (${certifiedToDate.toFixed(2)})`);
        }

        const count = prior.length;
        const retentionRate = toDecimal(pkg.retention_rate_pct.toString());
        const retention = gross.times(retentionRate.dividedBy(100));
        const wht = gross.minus(prevPayments).gt(0)
          ? gross.minus(prevPayments).times(WHT_RATE_PCT.dividedBy(100))
          : toDecimal('0');
        const netPayable = gross.minus(retention).minus(prevPayments).minus(wht);
        const created = await tx.subcontractorValuation.create({
          data: {
            tenant_id: link.tenant_id,
            project_id: link.project_id,
            subcontractor_package_id: pkg.id,
            certificate_no: `SC-VAL-${String(count + 1).padStart(3, '0')}`,
            valuation_date: new Date(),
            gross_work_certified_kes: gross.toFixed(2),
            retention_rate_pct: retentionRate.toFixed(2),
            retention_deducted_kes: retention.toFixed(2),
            previous_payments_deducted_kes: prevPayments.toFixed(2),
            withholding_tax_pct: WHT_RATE_PCT.toFixed(2),
            withholding_tax_deducted_kes: wht.toFixed(2),
            net_payable_kes: netPayable.toFixed(2),
            payment_status: 'SUBMITTED',
            notes: `[Portal submission by ${link.stakeholder_name}] ${body.notes || ''}`.trim(),
          },
        });
        await recordAuditLog(tx, {
          tenantId: link.tenant_id,
          projectId: link.project_id,
          actorId: link.id,
          action: 'SUBCONTRACTOR_VALUATION_SUBMITTED_VIA_PORTAL',
          entityType: 'SubcontractorValuation',
          entityId: created.id,
          changes: { via: 'external_portal', gross, submittedBy: link.stakeholder_name },
        });
        return created;
      });
      return reply.status(201).send({ statusCode: 201, data: valuation });
    } catch (err: any) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: err.message });
    }
  });

  // ===========================================================================
  // 5. MATERIAL SUPPLIER & BATCHING PLANT PORTAL
  // ===========================================================================

  // GET /api/v1/portals/supplier/:token
  server.get('/api/v1/portals/supplier/:token', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
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

      const deliveries = diaries
        .flatMap((d) =>
          d.deliveries.map((m) => ({
            id: m.id,
            materialName: m.material_name,
            quantity: m.quantity.toString(),
            unit: m.unit,
            supplierName: m.supplier_name,
            deliveryNote: m.delivery_note,
            deliveryStatus: m.delivery_status,
            confirmedAt: m.confirmed_at,
            confirmedByName: m.confirmed_by_name,
            supplierInvoiceRef: m.supplier_invoice_ref,
            disputeReason: m.dispute_reason,
            siteDate: d.entry_date,
          })),
        )
        .filter((m) =>
          !link.stakeholder_name ||
          !m.supplierName ||
          m.supplierName.toLowerCase() === link.stakeholder_name.toLowerCase(),
        );

      return {
        stakeholder: {
          name: link.stakeholder_name,
          vendorType: link.stakeholder_role || 'Material Supplier',
        },
        linkExpiresAt: link.expires_at.toISOString(),
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


  // POST /api/v1/portals/supplier/:token/deliveries/:deliveryId/confirm
  server.post('/api/v1/portals/supplier/:token/deliveries/:deliveryId/confirm', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
    const { token, deliveryId } = request.params as { token: string; deliveryId: string };
    const link = await resolvePortalLink(token, 'SUPPLIER');
    if (!link) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invalid or expired supplier access token' });
    }
    const parsed = SupplierDeliveryActionSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid action payload', details: parsed.error.flatten() });
    }
    const body = parsed.data;
    if (body.action === 'DISPUTE' && (!body.note || body.note.trim().length < 3)) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'A dispute note is required' });
    }
    const updated = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      const delivery = await tx.materialDelivery.findFirst({
        where: { id: deliveryId },
        include: { site_diary: { select: { project_id: true } } },
      });
      if (!delivery || delivery.site_diary.project_id !== link.project_id) {
        throw { status: 404, message: 'Delivery not found on this project' };
      }
      // CONFIRMED and DISPUTED are final states for the supplier — staff must
      // reset the delivery before the supplier can act again.
      if (delivery.delivery_status === 'CONFIRMED' || delivery.delivery_status === 'DISPUTED') {
        throw { status: 409, message: `Delivery is already ${delivery.delivery_status.toLowerCase()} — contact the site team to reopen it` };
      }
      return tx.materialDelivery.update({
        where: { id: deliveryId },
        data: {
          delivery_status: body.action === 'CONFIRM' ? 'CONFIRMED' : 'DISPUTED',
          confirmed_at: body.action === 'CONFIRM' ? new Date() : null,
          confirmed_by_name: link.stakeholder_name,
          supplier_invoice_ref: body.invoiceRef || delivery.supplier_invoice_ref,
          dispute_reason: body.action === 'DISPUTE' ? body.note!.trim() : delivery.dispute_reason,
        },
      });
    }).catch((err: any) => ({ __err: err }));
    const uerr = (updated as any).__err;
    if (uerr) {
      const st = uerr?.status ?? 400;
      return reply.status(st).send({ statusCode: st, error: st === 404 ? 'Not Found' : 'Conflict', message: uerr?.message || 'Action failed' });
    }
    return reply.status(200).send({ statusCode: 200, data: updated });
  });

  // ===========================================================================
  // 6. NCA & COUNTY REGULATORY COMPLIANCE PORTAL
  // ===========================================================================

  // GET /api/v1/portals/compliance/:token
  server.get('/api/v1/portals/compliance/:token', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
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
      const [project, cubeTests, inspections, certificates, remittedLevyCount, supervisorMemberCount] = await Promise.all([
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
        // Statutory levy clearance = at least one WHT certificate remitted to KRA.
        tx.statutoryTaxCertificate.count({
          where: {
            project_id: link.project_id,
            status: { in: ['REMITTED_TO_KRA', 'ACKNOWLEDGED'] },
          },
        }),
        // Accredited site supervisor = an assigned SITE_SUPERVISOR project member.
        tx.projectMember.count({
          where: { project_id: link.project_id, role: 'SITE_SUPERVISOR' },
        }),
      ]);

      // Calculate total cube break pass rate — null when no breaks recorded
      // so the portal shows "No tests yet" instead of a fabricated 100%.
      const allBreaks = cubeTests.flatMap((c) => c.break_results);
      const totalBreaks = allBreaks.length;
      const passedBreaks = allBreaks.filter((b) => b.is_pass === true).length;
      const passRate = totalBreaks > 0 ? `${((passedBreaks / totalBreaks) * 100).toFixed(1)}%` : null;

      return {
        regulatoryAuditor: {
          name: link.stakeholder_name,
          agency: link.stakeholder_role || 'National Construction Authority (NCA) / County Planning',
        },
        linkExpiresAt: link.expires_at.toISOString(),
        project: {
          id: project?.id,
          name: project?.name,
          code: project?.code,
          status: project?.status,
        },
        complianceSummary: {
          // No NCA registration record exists in the schema — report honestly.
          ncaSiteRegistration: null,
          // No statutory-levy or supervisor-certification records exist yet —
          // return null so the portal shows "Not tracked" instead of inventing compliance.
          statutoryLevyPaid: remittedLevyCount > 0,
          certifiedSiteSupervisorPresent: supervisorMemberCount > 0,
          concreteCubePassRate: passRate,
          totalBatchesSampled: cubeTests.length,
          prePourInspectionsConducted: inspections.length,
        },
        cubeTests: (cubeTests || []).map((c: any) => ({
          id: c.id,
          pourLocation: c.pour_location,
          pourDate: c.pour_date,
          concreteClass: c.concrete_class,
          targetStrengthMpa: c.target_strength_mpa?.toString(),
          supplierName: c.supplier_name,
          deliveryDocketNo: c.delivery_docket_no,
          breakResults: (c.break_results || []).map((b: any) => ({
            id: b.id, cubeNumber: b.cube_number, breakAgeDays: b.break_age_days,
            compressiveMpa: b.compressive_mpa?.toString(), isPass: b.is_pass, labName: b.lab_name,
          })),
        })),
        inspections: (inspections || []).map((i: any) => ({
          id: i.id,
          title: i.title,
          checklistType: i.checklist_type,
          inspectionType: i.inspection_type,
          location: i.location,
          status: i.status,
          scheduledDate: i.scheduled_date,
          inspectedAt: i.inspected_at,
          inspectorName: i.inspector_name,
          items: (i.items || []).map((it: any) => ({
            id: it.id, checkPoint: it.check_point, isMandatory: it.is_mandatory,
            result: it.result, deficiencyNotes: it.deficiency_notes,
          })),
        })),
        certificates: (certificates || []).map((c: any) => ({
          id: c.id, certificateType: c.certificate_type, certificateReference: c.certificate_reference,
          issueDate: c.issue_date, effectiveDate: c.effective_date,
          dlpExpiryDate: c.dlp_expiry_date,
          retentionAmountReleased: c.retention_amount_released?.toString(),
        })),
      };
    });

    return reply.status(200).send({
      statusCode: 200,
      data: payload,
    });
  });

  // ===========================================================================
  // 7. PROJECT CLIENT / DEVELOPER PORTAL — CHANGE ORDER APPROVAL (ADR-010)
  // ===========================================================================

  // GET /api/v1/portals/client/:token — client dashboard payload:
  // progress photos flagged client_visible, payment certificates, invoices.
  server.get('/api/v1/portals/client/:token', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
    const { token } = request.params as { token: string };
    const link = await resolvePortalLink(token, 'CLIENT');

    if (!link) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Invalid or expired client access token',
      });
    }

    const payload = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      const [project, diaries, certificates, invoices, progress] = await Promise.all([
        tx.project.findFirst({ where: { id: link.project_id } }),
        tx.siteDiary.findMany({
          where: { project_id: link.project_id },
          include: { photos: { where: { client_visible: true } } },
          orderBy: { entry_date: 'desc' },
          take: 30,
        }),
        tx.paymentCertificate.findMany({
          where: { project_id: link.project_id },
          orderBy: { period_end: 'desc' },
        }),
        tx.invoice.findMany({
          where: { project_id: link.project_id },
          orderBy: { issue_date: 'desc' },
        }),
        tx.progressRecord.findMany({
          where: { project_id: link.project_id },
          orderBy: { record_date: 'desc' },
          take: 10,
        }),
      ]);

      return {
        stakeholder: {
          name: link.stakeholder_name,
          role: link.stakeholder_role || 'Project Client / Developer',
        },
        linkExpiresAt: link.expires_at.toISOString(),
        project: project
          ? { id: project.id, name: project.name, code: project.code, status: project.status, contractSum: project.original_contract_sum?.toString() }
          : null,
        progressPhotos: diaries.flatMap((d) =>
          (d.photos || []).map((ph: any) => ({
            id: ph.id,
            storageKey: ph.storage_key,
            caption: ph.caption,
            takenAt: ph.taken_at,
            entryDate: d.entry_date,
          })),
        ),
        certificates: certificates.map((c: any) => ({
          id: c.id, certificateNo: c.certificate_no,
          periodStart: c.period_start, periodEnd: c.period_end,
          thisPeriodAmount: c.this_period_amount.toString(),
          cumulativeCertified: c.cumulative_certified.toString(),
          retentionHeld: c.retention_held.toString(),
          netPayable: c.net_payable.toString(),
          status: c.status, paidAt: c.paid_at,
        })),
        invoices: invoices.map((i: any) => ({
          id: i.id, invoiceNo: i.invoice_no, title: i.title,
          status: i.status, currency: i.currency,
          total: i.total.toString(), amountPaid: i.amount_paid.toString(),
          balanceDue: i.balance_due.toString(),
          issueDate: i.issue_date, dueDate: i.due_date,
        })),
        progressRecords: progress.map((pr: any) => ({
          id: pr.id, recordDate: pr.record_date,
          overallProgress: pr.overall_progress?.toString(), notes: pr.notes,
        })),
      };
    });

    return reply.status(200).send({ statusCode: 200, data: payload });
  });

  // GET /api/v1/portals/client/:token/change-orders
  server.get('/api/v1/portals/client/:token/change-orders', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
    const { token } = request.params as { token: string };
    const link = await resolvePortalLink(token, 'CLIENT');

    if (!link) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Invalid or expired client access token',
      });
    }

    const payload = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      const [project, changeOrders] = await Promise.all([
        tx.project.findFirst({ where: { id: link.project_id } }),
        tx.variationOrder.findMany({
          where: { project_id: link.project_id },
          include: {
            items: { orderBy: { id: 'asc' } },
            events: { orderBy: { created_at: 'asc' } },
          },
          orderBy: { variation_no: 'asc' },
        }),
      ]);

      return {
        stakeholder: {
          name: link.stakeholder_name,
          role: link.stakeholder_role || 'Project Client / Developer',
        },
        linkExpiresAt: link.expires_at.toISOString(),
        project: project
          ? { id: project.id, name: project.name, code: project.code, status: project.status }
          : null,
        changeOrders: changeOrders.map((co) => ({
          ...co,
          status: normalizeCoStatus(co.status),
        })),
      };
    });

    return reply.status(200).send({ statusCode: 200, data: payload });
  });

  // POST /api/v1/portals/client/:token/change-orders/:coId/respond
  server.post('/api/v1/portals/client/:token/change-orders/:coId/respond', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
    const { token, coId } = request.params as { token: string; coId: string };
    const link = await resolvePortalLink(token, 'CLIENT');

    if (!link) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Invalid or expired client access token',
      });
    }

    if (!UUID_REGEX.test(coId)) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Change order not found',
      });
    }

    const parsed = ClientVariationRespondSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid response payload',
        details: parsed.error.errors,
      });
    }
    const { action, signedName, comments } = parsed.data;

    try {
      const result = await withTenantTx(prisma, link.tenant_id, async (tx) => {
        const project = await tx.project.findFirst({ where: { id: link.project_id } });
        if (!project) {
          throw { status: 404, message: 'Project not found' };
        }

        const variation = await tx.variationOrder.findFirst({
          where: { id: coId, project_id: link.project_id },
        });
        if (!variation) {
          throw { status: 404, message: 'Change order not found on this project' };
        }

        const currentStatus = normalizeCoStatus(variation.status);
        if (currentStatus !== 'OWNER_REVIEW') {
          throw {
            status: 400,
            message: `This change order is not awaiting owner approval (status: ${currentStatus})`,
          };
        }

        const actorName = signedName || link.stakeholder_name;
        const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        let newBudget = project.current_approved_budget.toString();

        // Atomic claim on OWNER_REVIEW — prevents double decisions via
        // concurrent portal submissions or a parallel contractor review.
        const claimed = await claimCoTransition(
          tx,
          coId,
          variation.status,
          newStatus,
          newStatus === 'APPROVED' ? new Date() : null,
        );
        if (!claimed) {
          throw { status: 409, message: 'Change order was already decided — please refresh' };
        }

        if (newStatus === 'APPROVED') {
          newBudget = await applyCoBudgetRollup(tx, project, variation.net_amount);
        }

        const updated = await tx.variationOrder.findUniqueOrThrow({ where: { id: coId } });

        await recordCoEvent(
          tx,
          link.tenant_id,
          coId,
          'CLIENT_PORTAL',
          actorName,
          newStatus === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          comments || `Responded via client portal link`,
        );

        await recordAuditLog(tx, {
          tenantId: link.tenant_id,
          projectId: link.project_id,
          actorId: link.id,
          action: `CO_${action}_VIA_CLIENT_PORTAL`,
          entityType: 'VariationOrder',
          entityId: coId,
          changes: {
            stakeholder: link.stakeholder_name,
            signedName: actorName,
            previousStatus: currentStatus,
            newStatus,
            previousBudget: project.current_approved_budget.toString(),
            newBudget,
          },
          ipAddress: request.ip,
          userAgent: (request.headers['user-agent'] as string) || null,
        });

        return { ...updated, status: normalizeCoStatus(updated.status) };
      });

      return reply.status(200).send({
        statusCode: 200,
        message: `Change order ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`,
        data: result,
      });
    } catch (err: any) {
      if (err.status) {
        return reply.status(err.status).send({
          statusCode: err.status,
          error: err.status === 404 ? 'Not Found' : 'Bad Request',
          message: err.message,
        });
      }
      server.log.error(err, 'Failed to process client portal change-order response');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to process change-order response',
      });
    }
  });
};
