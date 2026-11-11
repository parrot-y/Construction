import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { getTaxSettings, whtRateFor } from '../lib/tax';
import { Permissions } from '@construction/permissions';
import { CreatePortalLinkSchema, ClientVariationRespondSchema, ConsultantRfiReplySchema, SupplierDeliveryActionSchema, CreateComplianceVisitSchema } from '@construction/validation';
import { randomBytes, createHash } from 'node:crypto';
import { requirePermission } from '../plugins/rbac';
import { toDecimal } from '@construction/money';
import { randomUUID } from 'node:crypto';
import { contentTypeForKey, verifyUpload } from '../lib/uploadSecurity';
import { notifyTeam } from '../lib/notify';
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

      const { portalType, stakeholderName, stakeholderRole, expiresInDays, subcontractorPackageId, supplierId, scope, scopes } = parseResult.data as any;
      // `scopes` array (auditor contract) collapses to the single stored
      // scope: one section -> that section; ALL or multiple -> ALL.
      const effectiveScope = Array.isArray(scopes) && scopes.length
        ? (scopes.length === 1 ? scopes[0] : 'ALL')
        : (scope || 'ALL');
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

          // SUPPLIER links must be bound to a Supplier record — free-text
          // name matching let every supplier see every delivery (Stage-3).
          // supplierId is canonical; when absent the stakeholderName resolves
          // (or onboards) the supplier record (auditor stage-3 contract).
          let resolvedSupplierId: string | null = supplierId ?? null;
          if (portalType === 'SUPPLIER') {
            if (supplierId) {
              const supplier = await tx.supplier.findFirst({
                where: { id: supplierId, is_active: true },
                select: { id: true },
              });
              if (!supplier) throw { status: 404, message: 'Supplier not found' };
            } else {
              const name = (stakeholderName || '').trim();
              if (!name) throw { status: 400, message: 'supplierId or stakeholderName is required for SUPPLIER portal links' };
              let supplier = await tx.supplier.findFirst({
                where: { name: { equals: name, mode: 'insensitive' }, is_active: true },
                select: { id: true },
              });
              if (!supplier) {
                supplier = await tx.supplier.create({
                  data: { tenant_id: tenantId, name, contact_person: stakeholderName },
                  select: { id: true },
                });
              }
              resolvedSupplierId = supplier.id;
            }
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
              supplier_id: portalType === 'SUPPLIER' ? resolvedSupplierId : null,
              scope: portalType === 'CONSULTANT' ? effectiveScope : null,
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
            isActive: true,
            useCount: 0,
            lastUsedAt: null,
            expiresAt: link.expires_at.toISOString(),
            subcontractorPackageId: link.subcontractor_package_id ?? null,
            supplierId: link.supplier_id ?? null,
            scope: link.scope ?? null,
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
          scope: l.scope ?? null,
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
            stakeholderRole: link.stakeholder_role,
            token: rawToken,
            linkUrl: `/?portal=${link.portal_type.toLowerCase()}&token=${rawToken}`,
            isActive: true,
            useCount: 0,
            lastUsedAt: null,
            expiresAt: link.expires_at.toISOString(),
            createdAt: link.created_at?.toISOString?.() ?? null,
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

    // Consultant link scopes (Stage 4): a scoped link only ever receives the
    // sections it was issued for — unscoped sections are not fetched at all.
    const scope = (link.scope || 'ALL').toUpperCase();
    const wantRfis = scope === 'ALL' || scope === 'RFI';
    const wantInspections = scope === 'ALL' || scope === 'INSPECTIONS';
    const wantCertificates = scope === 'ALL' || scope === 'CERTIFICATES';
    const wantDrawings = scope === 'ALL';

    const payload = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      const [project, rfis, inspections, cubeTests, certificates, drawingDocs] = await Promise.all([
        tx.project.findFirst({
          where: { id: link.project_id },
          select: { id: true, name: true, code: true, status: true },
        }),
        wantRfis
          ? tx.rFI.findMany({
              where: { project_id: link.project_id },
              include: {
                responses: { orderBy: { created_at: 'asc' } },
                attachments: true,
              },
              orderBy: { rfi_number: 'desc' },
            })
          : Promise.resolve([]),
        wantInspections
          ? tx.inspectionChecklist.findMany({
              where: { project_id: link.project_id },
              include: {
                items: { orderBy: { order_idx: 'asc' } },
              },
              orderBy: { scheduled_date: 'desc' },
            })
          : Promise.resolve([]),
        wantInspections
          ? tx.concreteCubeTest.findMany({
              where: { project_id: link.project_id },
              include: {
                break_results: { orderBy: { break_age_days: 'asc' } },
              },
              orderBy: { pour_date: 'desc' },
            })
          : Promise.resolve([]),
        wantCertificates
          ? tx.defectsLiabilityCertificate.findMany({
              where: { project_id: link.project_id },
              orderBy: { issue_date: 'desc' },
            })
          : Promise.resolve([]),
        wantDrawings
          ? tx.projectDocument.findMany({
              where: {
                project_id: link.project_id,
                OR: [
                  { drawing_reference: { not: null } },
                  { category: { contains: 'DRAWING' } },
                ],
              },
              include: { acknowledgements: true },
              orderBy: { created_at: 'desc' },
            })
          : Promise.resolve([]),
      ]);

      const now = new Date();
      const isOpenRfi = (s: string) => !['ANSWERED', 'CLOSED', 'VOID'].includes(s);

      const out: Record<string, any> = {
        stakeholder: {
          name: link.stakeholder_name,
          role: link.stakeholder_role || 'Consultant',
        },
        scope,
        linkExpiresAt: link.expires_at.toISOString(),
        project: project ?? null,
      };

      if (wantRfis) {
        out.rfis = (rfis || []).map((r: any) => ({
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
          isOverdue: isOpenRfi(r.status) && !!r.due_date && new Date(r.due_date) < now,
        }));
      }

      if (wantInspections) {
        out.inspections = (inspections || []).map((i: any) => ({
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
        }));

        out.cubeTests = (cubeTests || []).map((c: any) => ({
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
        }));
      }

      if (wantCertificates) {
        out.certificates = (certificates || []).map((c: any) => ({
          id: c.id, certificateType: c.certificate_type, certificateReference: c.certificate_reference,
          issueDate: c.issue_date, effectiveDate: c.effective_date,
          dlpDurationMonths: c.dlp_duration_months, dlpExpiryDate: c.dlp_expiry_date,
          retentionAmountReleased: c.retention_amount_released?.toString(),
          architectName: c.architect_name, qsName: c.qs_name,
        }));
      }

      if (wantDrawings) {
        out.drawings = (drawingDocs || []).map((d: any) => {
          const acks = d.acknowledgements || [];
          const mine = acks.find((a: any) => a.portal_link_id === link.id);
          return {
            id: d.id,
            documentId: d.id,
            drawingNumber: d.drawing_reference,
            drawingReference: d.drawing_reference,
            title: d.title,
            revision: d.revision_code,
            revisionCode: d.revision_code,
            issuedDate: (d.issued_date || d.created_at),
            status: d.status,
            // A drawing is overdue for this consultant when a newer revision
            // superseded it or it was never issued for construction.
            isOverdue: d.status === 'SUPERSEDED' || d.status === 'FOR_REVIEW',
            acknowledged: !!mine,
            acknowledgedAt: mine?.acknowledged_at ?? null,
            acknowledgedBy: acks.map((a: any) => ({
              stakeholderName: a.stakeholder_name,
              acknowledgedAt: a.acknowledged_at,
            })),
          };
        });
      }

      return out;
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

    // Scoped links may only act on sections they were issued for.
    const replyScope = (link.scope || 'ALL').toUpperCase();
    if (!['ALL', 'RFI'].includes(replyScope)) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: `This consultant link is scoped to ${replyScope} and cannot reply to RFIs`,
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

      // Reply attachments: only keys issued by THIS link's upload endpoint
      // (tenant+project namespaced) are accepted — arbitrary keys rejected.
      // Accept both attachmentStorageKeys (bare keys) and attachments
      // ({storageKey, caption}) — captions become the staff-visible filename.
      const captionByKey = new Map<string, string>();
      for (const a of (body as any).attachments || []) {
        if (a?.storageKey) captionByKey.set(a.storageKey, a.caption || '');
      }
      const attachmentKeys = [...new Set([
        ...(body.attachmentStorageKeys || []),
        ...[...(captionByKey.keys())],
      ])];
      const expectedPrefix = `${link.tenant_id}/${link.project_id}/`;
      for (const key of attachmentKeys) {
        if (!key.startsWith(expectedPrefix) || key.includes('..')) {
          throw { status: 400, message: 'attachmentStorageKeys must be uploaded via the consultant portal uploads endpoint first' };
        }
      }
      for (const key of attachmentKeys) {
        const stored = await getStorageDriver().get(key).catch(() => null);
        await tx.rFIAttachment.create({
          data: {
            tenant_id: link.tenant_id,
            rfi_id: rfiId,
            storage_key: key,
            filename: captionByKey.get(key) || key.split('/').pop() || 'attachment',
            file_size: stored?.length ?? 0,
            mime_type: contentTypeForKey(key),
          },
        });
      }

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

      await notifyTeam(tx, {
        tenantId: link.tenant_id,
        projectId: link.project_id,
        senderId: link.id,
        senderName: `${body.consultantName || link.stakeholder_name} (portal)`,
        body: `Consultant replied to an RFI via portal — the RFI is now ANSWERED and ready for the project team.`,
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

  // POST /api/v1/portals/consultant/:token/uploads — verified file upload.
  // Same content/magic-byte checks as authenticated site uploads; the key is
  // namespaced to this link's tenant+project so reply attachments and the
  // drawings register can reference it safely.
  server.post(
    '/api/v1/portals/consultant/:token/uploads',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
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
      const storageKey = `${link.tenant_id}/${link.project_id}/${randomUUID()}${spec.ext}`;
      await getStorageDriver().put(storageKey, buffer);
      await withTenantTx(prisma, link.tenant_id, (tx) =>
        recordAuditLog(tx, {
          tenantId: link.tenant_id,
          actorId: link.id,
          action: 'CONSULTANT_PORTAL_UPLOAD',
          entityType: 'PortalAccessLink',
          entityId: link.id,
          projectId: link.project_id,
          changes: { storageKey, filename: file.filename, mimetype: spec.contentType, sizeBytes: buffer.length },
        }),
      );
      return reply.status(201).send({
        statusCode: 201,
        data: { storageKey, url: `/uploads/${storageKey}`, mimetype: spec.contentType, sizeBytes: buffer.length },
      });
    },
  );

  // POST /api/v1/portals/consultant/:token/drawings/:documentId/acknowledge
  // Per-link drawing acknowledgement — the contractor sees who acknowledged
  // which revision on the project drawings register.
  server.post(
    '/api/v1/portals/consultant/:token/drawings/:documentId/acknowledge',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { token, documentId } = request.params as { token: string; documentId: string };
      const link = await resolvePortalLink(token, 'CONSULTANT');
      if (!link) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Invalid or expired consultant access token',
        });
      }
      // Drawings are only visible to ALL-scoped consultant links.
      if ((link.scope || 'ALL').toUpperCase() !== 'ALL') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'This consultant link is not scoped for drawings',
        });
      }
      const ack = await withTenantTx(prisma, link.tenant_id, async (tx) => {
        const doc = await tx.projectDocument.findFirst({
          where: { id: documentId, project_id: link.project_id },
          select: { id: true },
        });
        if (!doc) throw { status: 404, message: 'Drawing not found on this project' };
        return tx.drawingAcknowledgement.upsert({
          where: {
            document_id_portal_link_id: { document_id: documentId, portal_link_id: link.id },
          },
          update: {},
          create: {
            tenant_id: link.tenant_id,
            project_id: link.project_id,
            document_id: documentId,
            portal_link_id: link.id,
            stakeholder_name: link.stakeholder_name,
          },
        });
      }).catch((err: any) => {
        if (err?.status) return { __portalError: { status: err.status, message: err.message } };
        throw err;
      });
      if ((ack as any)?.__portalError) {
        const e = (ack as any).__portalError;
        return reply.status(e.status).send({ statusCode: e.status, error: 'Not Found', message: e.message });
      }
      return reply.status(200).send({ statusCode: 200, data: ack });
    },
  );

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
      const VALUATION_STATUS_LABELS: Record<string, string> = {
        SUBMITTED: 'Submitted — awaiting review',
        UNDER_REVIEW: 'Under review',
        QS_VERIFIED: 'Under review',
        APPROVED_FOR_PAYMENT: 'Approved for payment',
        PAID: 'Paid',
        REJECTED: 'Rejected',
      };
      const normStatus = (s: string) => (s === 'QS_VERIFIED' ? 'UNDER_REVIEW' : s);
      const dec = (v: any) => toDecimal(String(v ?? '0'));

      const packages = pkg
        ? [(() => {
            const vals = pkg.valuations || [];
            return {
              id: pkg.id,
              tradeCategory: pkg.trade_category,
              firmName: pkg.firm_name,
              scopeDescription: pkg.scope_description,
              subcontractSum: pkg.subcontract_sum.toString(),
              retentionRatePct: pkg.retention_rate_pct.toString(),
              status: pkg.status,
              valuations: vals.map((v: any) => ({
                id: v.id,
                certificateNo: v.certificate_no,
                valuationDate: v.valuation_date,
                grossWorkCertifiedKes: v.gross_work_certified_kes.toString(),
                retentionRatePct: v.retention_rate_pct.toString(),
                retentionDeductedKes: v.retention_deducted_kes.toString(),
                previousPaymentsDeductedKes: v.previous_payments_deducted_kes.toString(),
                withholdingTaxPct: v.withholding_tax_pct?.toString() ?? null,
                withholdingTaxDeductedKes: v.withholding_tax_deducted_kes.toString(),
                netPayableKes: v.net_payable_kes.toString(),
                // Plain breakdown aliases (portal UX contract).
                grossWorkCertified: v.gross_work_certified_kes.toString(),
                retention: v.retention_deducted_kes.toString(),
                withholdingTax: v.withholding_tax_deducted_kes.toString(),
                netPayable: v.net_payable_kes.toString(),
                paymentStatus: normStatus(v.payment_status),
                statusLabel: VALUATION_STATUS_LABELS[normStatus(v.payment_status)] || 'Submitted',
                paymentReference: v.payment_reference,
                paidAt: v.paid_at ? v.paid_at.toISOString() : null,
                rejectionReason: v.rejection_reason,
                replacesValuationId: v.replaces_valuation_id,
                notes: v.notes,
              })),
            };
          })()]
        : [];

      // Package summary + retention release status (Stage-3).
      let packageSummary = null;
      let retentionRelease = null;
      if (pkg) {
        const vals = pkg.valuations || [];
        const live = vals.filter((v: any) => v.payment_status !== 'REJECTED');
        const certifiedToDate = live.reduce((acc: any, v: any) => {
          return acc.plus(dec(v.gross_work_certified_kes));
        }, toDecimal('0'));
        const paidToDate = vals
          .filter((v: any) => v.payment_status === 'PAID')
          .reduce((acc: any, v: any) => acc.plus(dec(v.net_payable_kes)), toDecimal('0'));
        const retentionHeld = vals
          .filter((v: any) => ['APPROVED_FOR_PAYMENT', 'PAID'].includes(v.payment_status))
          .reduce((acc: any, v: any) => acc.plus(dec(v.retention_deducted_kes)), toDecimal('0'));
        const releases = await tx.subcontractorRetentionRelease.findMany({
          where: { subcontractor_package_id: pkg.id },
          select: { release_amount: true, status: true },
        });
        const releasedAmt = releases
          .filter((r: any) => r.status === 'PAID')
          .reduce((acc: any, r: any) => acc.plus(dec(r.release_amount)), toDecimal('0'));
        const pendingAmt = releases
          .filter((r: any) => ['PENDING_QS_REVIEW', 'APPROVED_BY_DIRECTOR', 'PENDING_DISBURSEMENT'].includes(r.status))
          .reduce((acc: any, r: any) => acc.plus(dec(r.release_amount)), toDecimal('0'));
        const contractSum = dec(pkg.subcontract_sum);
        packageSummary = {
          contractSum: contractSum.toFixed(2),
          certifiedToDate: certifiedToDate.toFixed(2),
          paidToDate: paidToDate.toFixed(2),
          remaining: contractSum.minus(certifiedToDate).toFixed(2),
          retentionHeld: retentionHeld.toFixed(2),
        };
        retentionRelease = {
          held: retentionHeld.toFixed(2),
          released: releasedAmt.toFixed(2),
          pending: pendingAmt.toFixed(2),
          status: retentionHeld.lte(0)
            ? 'NONE'
            : releasedAmt.gte(retentionHeld) && pendingAmt.lte(0)
              ? 'RELEASED'
              : releasedAmt.gt(0) || pendingAmt.gt(0)
                ? 'PENDING'
                : 'HELD',
        };
      }

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
        // Flat claim list — same DTOs as packages[].valuations, for portal UIs
        // and integrations that don't want to walk the package tree.
        valuations: packages.flatMap((p: any) => p.valuations || []),
        packageSummary,
        retentionRelease,
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

    const body = request.body as { photoStorageKey?: string; notes?: string; gpsLat?: number; gpsLng?: number };
    // Photo proof is optional but, when supplied, the key must have been issued
    // by this link's tenant+project upload route — reject arbitrary keys that
    // would point at another tenant's files.
    if (body.photoStorageKey) {
      const expectedPrefix = `${link.tenant_id}/${link.project_id}/`;
      if (!body.photoStorageKey.startsWith(expectedPrefix) || body.photoStorageKey.includes('..')) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'photoStorageKey was not issued for this project — upload via the portal upload endpoint first',
        });
      }
    }

    let updated: any;
    try {
    updated = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      const snag = await tx.snagItem.findFirst({
        where: { id: snagId, project_id: link.project_id },
      });

      if (!snag) {
        throw { status: 404, message: 'Snag item not found on this project' };
      }

      // Trade scoping: a subcontractor may only rectify snags in their own
      // trade — resolve the bound package's trade, not the link's free text.
      if (link.subcontractor_package_id) {
        const pkg = await tx.subcontractorPackage.findUnique({
          where: { id: link.subcontractor_package_id },
          select: { trade_category: true },
        });
        const mine = (pkg?.trade_category ?? link.stakeholder_role ?? '').toLowerCase();
        const theirs = (snag.trade_category ?? '').toLowerCase();
        if (mine && theirs && mine !== theirs) {
          throw { status: 404, message: 'Snag item not found on this project' };
        }
      }

      if (body.photoStorageKey) {
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
      }

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

      await notifyTeam(tx, {
        tenantId: link.tenant_id,
        projectId: link.project_id,
        senderId: link.id,
        senderName: `${link.stakeholder_name} (portal)`,
        body: `Snag item rectified via portal by ${link.stakeholder_name} — photo proof uploaded, awaiting inspection.`,
      });

      return updatedSnag;
    });
    } catch (err: any) {
      // Map thrown {status} errors (404 wrong project/trade) instead of 500s.
      if (err?.status) {
        return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
      }
      throw err;
    }

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
    const body = request.body as { packageId?: string; grossWorkCertifiedKes?: string | number; notes?: string; replacesValuationId?: string };
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
    try {
      const valuation = await withTenantTx(prisma, link.tenant_id, async (tx) => {
        const pkg = await tx.subcontractorPackage.findFirst({
          where: { id: link.subcontractor_package_id, project_id: link.project_id },
        });
        if (!pkg) throw new Error('Work package not found on this project');

        // Each valuation is a claim for work certified in that period; the
        // certified-to-date floor is the SUM of live (non-rejected) claims —
        // rejected claims never count toward the cap (Stage-3, auditor
        // contract: "total claims may not exceed the package sum").
        const prior = await tx.subcontractorValuation.findMany({
          where: { subcontractor_package_id: pkg.id },
          select: { id: true, gross_work_certified_kes: true, net_payable_kes: true, payment_status: true },
        });
        const livePrior = prior.filter((v) => v.payment_status !== 'REJECTED');
        const certifiedToDate = livePrior.reduce((acc, v) => {
          return acc.plus(toDecimal(v.gross_work_certified_kes.toString()));
        }, toDecimal('0'));
        const prevPayments = prior
          .filter((v) => ['APPROVED_FOR_PAYMENT', 'PAID'].includes(v.payment_status))
          .reduce((acc, v) => acc.plus(toDecimal(v.net_payable_kes.toString())), toDecimal('0'));

        // Cap: certified-to-date + this claim may not exceed the package sum.
        const packageSum = toDecimal(pkg.subcontract_sum.toString());
        if (certifiedToDate.plus(gross).gt(packageSum)) {
          throw new Error(`Total claims cannot exceed the package contract sum (${packageSum.toFixed(2)})`);
        }

        // Resubmission: replacesValuationId must point at a REJECTED claim on
        // the same package — it links the corrected claim, nothing more.
        let replacesId: string | null = null;
        if (body.replacesValuationId) {
          if (!UUID_REGEX.test(body.replacesValuationId)) {
            throw new Error('replacesValuationId must be a valid valuation id');
          }
          const replaced = await tx.subcontractorValuation.findFirst({
            where: { id: body.replacesValuationId, subcontractor_package_id: pkg.id },
            select: { id: true, payment_status: true },
          });
          if (!replaced || replaced.payment_status !== 'REJECTED') {
            throw new Error('replacesValuationId must reference a rejected valuation on this package');
          }
          replacesId = replaced.id;
        }

        // WHT from the tenant's central tax settings — no env/hard-coded rate.
        const taxSettings = await getTaxSettings(tx, link.tenant_id);
        const WHT_RATE_PCT = whtRateFor(taxSettings, 'SUBCONTRACTOR');

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
            submitted_at: new Date(),
            replaces_valuation_id: replacesId,
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
        await notifyTeam(tx, {
          tenantId: link.tenant_id,
          projectId: link.project_id,
          senderId: link.id,
          senderName: `${link.stakeholder_name} (portal)`,
          body: `Subcontractor valuation ${created.certificate_no} submitted via portal by ${link.stakeholder_name} — gross ${gross.toFixed(2)} KES. Awaiting review.`,
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

    // Stage-3: a SUPPLIER link without a bound Supplier record sees nothing.
    if (!link.supplier_id) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'This portal link is not bound to a supplier record',
      });
    }

    const q = request.query as { page?: string; pageSize?: string };
    const page = Math.max(1, parseInt(q.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize || '25', 10) || 25));

    const payload = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      const [project, supplier, deliveryTotal, deliveries, purchaseOrders] = await Promise.all([
        tx.project.findFirst({
          where: { id: link.project_id },
          select: { id: true, name: true, code: true },
        }),
        tx.supplier.findFirst({ where: { id: link.supplier_id! }, select: { id: true, name: true } }),
        // Deliveries are scoped by supplier_id RECORD — never free-text names.
        tx.materialDelivery.count({
          where: {
            supplier_id: link.supplier_id,
            site_diary: { project_id: link.project_id },
          },
        }),
        tx.materialDelivery.findMany({
          where: {
            supplier_id: link.supplier_id,
            site_diary: { project_id: link.project_id },
          },
          include: {
            site_diary: { select: { entry_date: true } },
            purchase_order: { select: { id: true, po_number: true, status: true } },
            purchase_order_item: { select: { id: true, description: true } },
          },
          orderBy: { site_diary: { entry_date: 'desc' } },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tx.purchaseOrder.findMany({
          where: { project_id: link.project_id, supplier_id: link.supplier_id },
          include: {
            items: true,
            invoices: { orderBy: { created_at: 'desc' } },
            supplier: { select: { id: true, name: true } },
          },
          orderBy: { created_at: 'desc' },
        }),
      ]);

      const DELIVERY_STATUS_LABELS: Record<string, string> = {
        RECORDED: 'Awaiting your confirmation',
        CONFIRMED: 'Confirmed by you',
        DISPUTED: 'Disputed',
      };
      const PO_STATUS_LABELS: Record<string, string> = {
        DRAFT: 'Draft',
        ISSUED: 'Issued — awaiting your acceptance',
        ACCEPTED: 'Accepted',
        PART_DELIVERED: 'Part delivered',
        DELIVERED: 'Delivered',
        CLOSED: 'Closed',
        CANCELLED: 'Cancelled',
      };

      return {
        stakeholder: {
          name: link.stakeholder_name,
          vendorType: link.stakeholder_role || 'Material Supplier',
          supplierId: link.supplier_id,
          supplierName: supplier?.name ?? null,
        },
        linkExpiresAt: link.expires_at.toISOString(),
        project: {
          id: project?.id,
          name: project?.name,
          code: project?.code,
        },
        page,
        pageSize,
        total: deliveryTotal,
        pagination: { page, pageSize, total: deliveryTotal, totalPages: Math.max(1, Math.ceil(deliveryTotal / pageSize)) },
        deliveries: deliveries.map((m) => ({
          id: m.id,
          materialName: m.material_name,
          quantity: m.quantity.toString(),
          unit: m.unit,
          supplierName: m.supplier_name,
          deliveryNote: m.delivery_note,
          deliveryStatus: m.delivery_status,
          statusLabel: DELIVERY_STATUS_LABELS[m.delivery_status] || m.delivery_status,
          confirmedAt: m.confirmed_at,
          confirmedByName: m.confirmed_by_name,
          supplierInvoiceRef: m.supplier_invoice_ref,
          disputeReason: m.dispute_reason,
          purchaseOrderId: m.purchase_order_id,
          purchaseOrderItemId: m.purchase_order_item_id,
          purchaseOrder: m.purchase_order ? { id: m.purchase_order.id, poNumber: m.purchase_order.po_number, status: m.purchase_order.status } : null,
          siteDate: m.site_diary.entry_date,
        })),
        purchaseOrders: purchaseOrders.map((po) => ({
          id: po.id,
          poNumber: po.po_number,
          status: po.status,
          statusLabel: PO_STATUS_LABELS[po.status] || po.status,
          orderDate: po.order_date,
          expectedDeliveryDate: po.expected_delivery_date,
          totalAmount: po.total_amount_kes.toString(),
          items: po.items.map((i) => ({
            id: i.id,
            description: i.description,
            unit: i.unit,
            quantity: i.quantity.toString(),
            rate: i.rate.toString(),
          })),
          invoices: po.invoices.map((iv) => ({
            id: iv.id,
            reference: iv.reference,
            amount: iv.amount.toString(),
            status: iv.status,
            note: iv.note,
            createdAt: iv.created_at,
          })),
        })),
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
    // Stage-3: confirm/dispute only on deliveries owned by the linked supplier.
    if (!link.supplier_id) {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'This portal link is not bound to a supplier record' });
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
      if (!delivery || delivery.site_diary.project_id !== link.project_id || delivery.supplier_id !== link.supplier_id) {
        throw { status: 404, message: 'Delivery not found' };
      }
      // CONFIRMED and DISPUTED are final states for the supplier — staff must
      // reset the delivery before the supplier can act again.
      if (delivery.delivery_status === 'CONFIRMED' || delivery.delivery_status === 'DISPUTED') {
        throw { status: 409, message: `Delivery is already ${delivery.delivery_status.toLowerCase()} — contact the site team to reopen it` };
      }
      const action = body.action === 'CONFIRM' ? 'CONFIRMED' : 'DISPUTED';
      const updatedDelivery = await tx.materialDelivery.update({
        where: { id: deliveryId },
        data: {
          delivery_status: action,
          confirmed_at: body.action === 'CONFIRM' ? new Date() : null,
          confirmed_by_name: link.stakeholder_name,
          supplier_invoice_ref: body.invoiceRef || delivery.supplier_invoice_ref,
          dispute_reason: body.action === 'DISPUTE' ? body.note!.trim() : delivery.dispute_reason,
        },
      });
      await notifyTeam(tx, {
        tenantId: link.tenant_id,
        projectId: link.project_id,
        senderId: link.id,
        senderName: `${link.stakeholder_name} (portal)`,
        body: body.action === 'CONFIRM'
          ? `Supplier ${link.stakeholder_name} confirmed a delivery via portal${body.invoiceRef ? ` — invoice ref ${body.invoiceRef}` : ''}.`
          : `Supplier ${link.stakeholder_name} disputed a delivery via portal: ${body.note!.trim()}`,
      });
      return updatedDelivery;
    }).catch((err: any) => ({ __err: err }));
    const uerr = (updated as any).__err;
    if (uerr) {
      const st = uerr?.status ?? 400;
      return reply.status(st).send({ statusCode: st, error: st === 404 ? 'Not Found' : 'Conflict', message: uerr?.message || 'Action failed' });
    }
    return reply.status(200).send({ statusCode: 200, data: updated });
  });

  // POST /api/v1/portals/supplier/:token/purchase-orders/:poId/accept — supplier
  // accepts an ISSUED PO with an expected delivery date.
  server.post('/api/v1/portals/supplier/:token/purchase-orders/:poId/accept', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
    const { token, poId } = request.params as { token: string; poId: string };
    const link = await resolvePortalLink(token, 'SUPPLIER');
    if (!link) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invalid or expired supplier access token' });
    }
    if (!link.supplier_id) {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'This portal link is not bound to a supplier record' });
    }
    const body = request.body as { expectedDeliveryDate?: string };
    // Ownership first: a PO belonging to another supplier must 404 before any
    // payload validation runs (auditor stage-3 contract).
    const owned = await withTenantTx(prisma, link.tenant_id, (tx) =>
      tx.purchaseOrder.findFirst({
        where: { id: poId, project_id: link.project_id, supplier_id: link.supplier_id },
        select: { id: true },
      }),
    );
    if (!owned) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Purchase order not found' });
    }
    if (!body?.expectedDeliveryDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.expectedDeliveryDate)) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'expectedDeliveryDate (YYYY-MM-DD) is required' });
    }
    try {
      const po = await withTenantTx(prisma, link.tenant_id, async (tx) => {
        const existing = await tx.purchaseOrder.findFirst({
          where: { id: poId, project_id: link.project_id, supplier_id: link.supplier_id },
          include: { items: true, supplier: true },
        });
        if (!existing) throw { status: 404, message: 'Purchase order not found' };
        // DRAFT|ISSUED may be accepted — a DRAFT acceptance implies issue:
        // the procurement commitment + pending cost entry post exactly as the
        // staff /issue route does, so the ledger stays honest.
        if (!['DRAFT', 'ISSUED'].includes(existing.status)) {
          throw { status: 409, message: `Only issued purchase orders can be accepted (current: ${existing.status})` };
        }
        let commitmentId: string | null = (existing as any).commitment_id ?? null;
        if (existing.status === 'DRAFT') {
          const latest = await tx.commitment.findFirst({
            where: { project_id: link.project_id },
            orderBy: { commitment_no: 'desc' },
            select: { commitment_no: true },
          });
          const commitment = await tx.commitment.create({
            data: {
              tenant_id: link.tenant_id,
              project_id: link.project_id,
              commitment_no: (latest?.commitment_no ?? 0) + 1,
              vendor_name: existing.supplier.name,
              vendor_type: 'SUPPLIER',
              contract_value: existing.total_amount_kes.toString(),
              status: 'ACTIVE',
            },
          });
          commitmentId = commitment.id;
          await tx.costEntry.create({
            data: {
              tenant_id: link.tenant_id,
              project_id: link.project_id,
              commitment_id: commitment.id,
              cost_category: 'MATERIAL',
              amount: existing.total_amount_kes.toString(),
              vendor_name: existing.supplier.name,
              description: `PO ${existing.po_number} accepted via supplier portal — ${existing.items.length} line(s), committed spend`,
              invoice_ref: existing.po_number,
              status: 'PENDING',
              // created_by_id is a users FK — the portal link id is not a user;
              // attribute the ledger row to the staff member who raised the PO.
              created_by_id: (existing as any).created_by_id ?? null,
            },
          });
        }
        const updated = await tx.purchaseOrder.update({
          where: { id: existing.id },
          data: {
            status: 'ACCEPTED',
            expected_delivery_date: new Date(`${body.expectedDeliveryDate}T00:00:00Z`),
            ...(existing.status === 'DRAFT' ? { issued_at: new Date(), commitment_id: commitmentId } : {}),
          },
        });
        await recordAuditLog(tx, {
          tenantId: link.tenant_id,
          projectId: link.project_id,
          actorId: link.id,
          action: 'PURCHASE_ORDER_ACCEPTED_VIA_PORTAL',
          entityType: 'PurchaseOrder',
          entityId: existing.id,
          changes: { acceptedBy: link.stakeholder_name, expectedDeliveryDate: body.expectedDeliveryDate },
        });
        await notifyTeam(tx, {
          tenantId: link.tenant_id,
          projectId: link.project_id,
          senderId: link.id,
          senderName: `${link.stakeholder_name} (portal)`,
          body: `Supplier ${link.stakeholder_name} accepted PO ${existing.po_number} — expected delivery ${body.expectedDeliveryDate}.`,
        });
        return updated;
      });
      return reply.status(200).send({ statusCode: 200, data: po });
    } catch (err: any) {
      const st = err?.status ?? 400;
      return reply.status(st).send({ statusCode: st, error: st === 404 ? 'Not Found' : 'Conflict', message: err?.message || 'Accept failed' });
    }
  });

  // POST /api/v1/portals/supplier/:token/purchase-orders/:poId/invoices — supplier
  // submits an invoice (reference + amount) against their own PO.
  server.post('/api/v1/portals/supplier/:token/purchase-orders/:poId/invoices', {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
    const { token, poId } = request.params as { token: string; poId: string };
    const link = await resolvePortalLink(token, 'SUPPLIER');
    if (!link) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invalid or expired supplier access token' });
    }
    if (!link.supplier_id) {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'This portal link is not bound to a supplier record' });
    }
    const body = request.body as {
      reference?: string; invoiceRef?: string; amount?: number | string;
      purchaseOrderItemId?: string; note?: string; taxAmount?: number | string;
      submittedAt?: string; replacesInvoiceRef?: string;
    };
    // `invoiceRef` is the auditor-contract alias for `reference`.
    const invoiceRef = (body?.reference ?? body?.invoiceRef ?? '').toString().trim();
    if (invoiceRef.length < 2) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invoice reference is required' });
    }
    let amount: ReturnType<typeof toDecimal>;
    try {
      amount = toDecimal(String(body.amount ?? ''));
    } catch {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'amount must be a positive number' });
    }
    if (amount.lte(0)) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'amount must be a positive number' });
    }
    try {
      const result = await withTenantTx(prisma, link.tenant_id, async (tx) => {
        const po = await tx.purchaseOrder.findFirst({
          where: { id: poId, project_id: link.project_id, supplier_id: link.supplier_id },
          include: { invoices: true },
        });
        if (!po) throw { status: 404, message: 'Purchase order not found' };
        if (!['ISSUED', 'ACCEPTED', 'PART_DELIVERED', 'DELIVERED'].includes(po.status)) {
          throw { status: 409, message: `Invoices can only be submitted on issued POs (current: ${po.status})` };
        }

        // Optional line allocation — must be a line on THIS purchase order.
        let itemId: string | null = null;
        if (body.purchaseOrderItemId) {
          if (!UUID_REGEX.test(body.purchaseOrderItemId)) {
            throw { status: 400, message: 'purchaseOrderItemId must be a valid line id' };
          }
          const item = await tx.purchaseOrderItem.findFirst({
            where: { id: body.purchaseOrderItemId, purchase_order_id: po.id },
            select: { id: true },
          });
          if (!item) throw { status: 400, message: 'purchaseOrderItemId is not a line on this purchase order' };
          itemId = item.id;
        }

        // Over-invoice detection: invoiced-to-date (non-rejected) + this
        // invoice vs the PO total. Over-limit claims are flagged REVIEW_REQUIRED
        // and notified to the PM — cost posting stays blocked until reviewed.
        const invoicedToDate = po.invoices
          .filter((i) => i.status !== 'REJECTED')
          .reduce((acc, i) => acc.plus(toDecimal(i.amount.toString())), toDecimal('0'));
        const poTotal = toDecimal(po.total_amount_kes.toString());
        const overInvoiced = invoicedToDate.plus(amount).gt(poTotal);

        // replacesInvoiceRef: the corrected invoice supersedes the rejected
        // one — mark the original REJECTED so match maths ignore it.
        if (body.replacesInvoiceRef) {
          await tx.purchaseOrderInvoice.updateMany({
            where: { purchase_order_id: po.id, reference: String(body.replacesInvoiceRef).trim(), status: { not: 'REJECTED' } },
            data: { status: 'REJECTED', note: `Superseded by ${invoiceRef}` },
          });
        }

        const invoice = await tx.purchaseOrderInvoice.create({
          data: {
            tenant_id: link.tenant_id,
            purchase_order_id: po.id,
            purchase_order_item_id: itemId,
            reference: invoiceRef,
            amount: amount.toFixed(2),
            status: overInvoiced ? 'REVIEW_REQUIRED' : 'SUBMITTED',
            note: body.note || null,
            submitted_by_name: link.stakeholder_name,
          },
        });

        await recordAuditLog(tx, {
          tenantId: link.tenant_id,
          projectId: link.project_id,
          actorId: link.id,
          action: 'SUPPLIER_PO_INVOICE_SUBMITTED',
          entityType: 'PurchaseOrderInvoice',
          entityId: invoice.id,
          changes: { poId: po.id, poNumber: po.po_number, reference: invoice.reference, amount: invoice.amount.toString(), overInvoiced },
        });

        const bodyText = overInvoiced
          ? `OVER-INVOICE flag: supplier ${link.stakeholder_name} submitted invoice ${invoice.reference} for ${amount.toFixed(2)} KES on PO ${po.po_number} — cumulative invoicing exceeds the PO total. PM review required before any cost posting.`
          : `Supplier ${link.stakeholder_name} submitted invoice ${invoice.reference} for ${amount.toFixed(2)} KES on PO ${po.po_number}.`;
        await notifyTeam(tx, {
          tenantId: link.tenant_id,
          projectId: link.project_id,
          senderId: link.id,
          senderName: `${link.stakeholder_name} (portal)`,
          body: bodyText,
        });

        return { invoice, overInvoiced };
      });
      return reply.status(201).send({ statusCode: 201, data: result.invoice, overInvoiced: result.overInvoiced });
    } catch (err: any) {
      const st = err?.status ?? 400;
      return reply.status(st).send({ statusCode: st, error: st === 404 ? 'Not Found' : 'Conflict', message: err?.message || 'Submit failed' });
    }
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
      const [project, cubeTests, inspections, certificates, permits, visits] = await Promise.all([
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
        tx.projectPermit.findMany({
          where: { project_id: link.project_id },
          orderBy: { created_at: 'desc' },
        }),
        tx.complianceVisit.findMany({
          where: { project_id: link.project_id },
          include: { actions: { orderBy: { created_at: 'asc' } } },
          orderBy: { visit_date: 'desc' },
        }),
      ]);

      // Calculate total cube break pass rate — null when no breaks recorded
      // so the portal shows "No tests yet" instead of a fabricated 100%.
      const allBreaks = cubeTests.flatMap((c) => c.break_results);
      const totalBreaks = allBreaks.length;
      const passedBreaks = allBreaks.filter((b) => b.is_pass === true).length;
      const passRate = totalBreaks > 0 ? `${((passedBreaks / totalBreaks) * 100).toFixed(1)}%` : null;

      // Permit status is DERIVED from the real expiry date at read time —
      // never stored, so it cannot drift from the register record.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const in30 = new Date(today.getTime() + 30 * 86400e3);
      const permitStatus = (p: any): string => {
        if (!p.expiry_date) return 'VALID';
        const exp = new Date(p.expiry_date);
        exp.setHours(0, 0, 0, 0);
        if (exp < today) return 'EXPIRED';
        if (exp <= in30) return 'EXPIRING_SOON';
        return 'VALID';
      };
      const statusLabel = (s: string) =>
        s === 'VALID' ? 'Valid' : s === 'EXPIRING_SOON' ? 'Expiring within 30 days' : 'Expired';

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
        // passRate stays null until real cube-test breaks exist — surfaced at
        // top level too so clients never have to guess (Stage-4 contract).
        data: { passRate },
        complianceSummary: {
          // Only record-backed figures: cube-test pass rate, inspection count.
          // NCA registration / levy clearance / supervisor certification are
          // NOT derived here — they live in the permits register and visit
          // records below (Stage 4: no invented indicators).
          concreteCubePassRate: passRate,
          totalBatchesSampled: cubeTests.length,
          prePourInspectionsConducted: inspections.length,
        },
        permits: (permits || []).map((p: any) => {
          const s = permitStatus(p);
          return {
            id: p.id,
            permitType: p.permit_type,
            permitNumber: p.permit_number,
            issuer: p.issuer,
            issuedDate: p.issued_date,
            expiryDate: p.expiry_date,
            notes: p.notes,
            status: s,
            statusLabel: statusLabel(s),
          };
        }),
        visits: (visits || []).map((v: any) => ({
          id: v.id,
          visitDate: v.visit_date,
          outcome: v.outcome,
          notes: v.notes,
          recordedByName: v.recorded_by_name,
          createdAt: v.created_at,
          actions: (v.actions || []).map((a: any) => ({
            id: a.id,
            description: a.description,
            dueDate: a.due_date,
            status: a.status,
          })),
        })),
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

  // POST /api/v1/portals/compliance/:token/visits — inspector records a site
  // visit with outcome, notes and required actions. The visit is bound to
  // this portal link + project, audit-logged, and notifies the contractor.
  server.post('/api/v1/portals/compliance/:token/visits', {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
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

    const parsed = CreateComplianceVisitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid compliance visit payload',
        details: parsed.error.flatten(),
      });
    }
    const body = parsed.data;

    const visit = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      const project = await tx.project.findFirst({ where: { id: link.project_id }, select: { id: true, name: true } });
      if (!project) throw { status: 404, message: 'Project not found' };

      const created = await tx.complianceVisit.create({
        data: {
          tenant_id: link.tenant_id,
          project_id: link.project_id,
          portal_link_id: link.id,
          visit_date: new Date(`${body.visitDate}T00:00:00.000Z`),
          outcome: body.outcome,
          notes: body.notes || null,
          recorded_by_name: link.stakeholder_name,
          actions: body.actions.length
            ? {
                create: body.actions.map((a) => ({
                  tenant_id: link.tenant_id,
                  description: a.description,
                  due_date: a.dueDate ? new Date(`${a.dueDate}T00:00:00.000Z`) : null,
                })),
              }
            : undefined,
        },
        include: { actions: true },
      });

      await recordAuditLog(tx, {
        tenantId: link.tenant_id,
        actorId: link.id,
        action: 'COMPLIANCE_VISIT_RECORDED',
        entityType: 'ComplianceVisit',
        entityId: created.id,
        projectId: link.project_id,
        changes: {
          inspector: link.stakeholder_name,
          outcome: body.outcome,
          actionCount: body.actions.length,
        },
      });

      await notifyTeam(tx, {
        tenantId: link.tenant_id,
        projectId: link.project_id,
        senderId: link.id,
        senderName: `${link.stakeholder_name} (compliance portal)`,
        body: `Compliance inspection visit recorded for ${project.name} — outcome: ${body.outcome}${body.actions.length ? ` with ${body.actions.length} required action(s)` : ''}.`,
      });

      return created;
    }).catch((err: any) => {
      if (err?.status) return { __portalError: { status: err.status, message: err.message } };
      throw err;
    }) as any;

    if (visit?.__portalError) {
      const e = visit.__portalError;
      return reply.status(e.status).send({ statusCode: e.status, error: 'Not Found', message: e.message });
    }

    return reply.status(201).send({
      statusCode: 201,
      data: {
        id: visit.id,
        visitDate: visit.visit_date,
        outcome: visit.outcome,
        notes: visit.notes,
        recordedByName: visit.recorded_by_name,
        actions: visit.actions.map((a: any) => ({
          id: a.id, description: a.description, dueDate: a.due_date, status: a.status,
        })),
      },
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
        // The client portal IS the owner-side decision channel: the owner may
        // approve or reject a change order at either pending stage — directly
        // from PM_REVIEW (their instruction, their call) or after staff
        // escalation to OWNER_REVIEW.
        if (currentStatus !== 'OWNER_REVIEW' && currentStatus !== 'PM_REVIEW') {
          throw {
            status: 400,
            message: `This change order is not awaiting owner approval (status: ${currentStatus})`,
          };
        }

        const actorName = signedName || link.stakeholder_name;
        const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        let newBudget = project.current_approved_budget.toString();

        // Atomic claim on the pending status — prevents double decisions via
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

        await notifyTeam(tx, {
          tenantId: link.tenant_id,
          projectId: link.project_id,
          senderId: link.id,
          senderName: `${actorName} (client portal)`,
          body: `Client ${actorName} ${newStatus === 'APPROVED' ? 'approved' : 'rejected'} change order CO-${String(variation.variation_no).padStart(4, '0')} via portal${newStatus === 'APPROVED' ? ' — contract budget updated' : ''}.`,
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
