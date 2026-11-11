import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import {
  calculateBudgetConsumptionRatio,
  calculateDetailedVariance,
  toCurrencyString,
  toDecimal,
  Decimal,
} from '@construction/money';
import { requirePermission } from '../plugins/rbac';
import { notifyTeam } from '../lib/notify';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const clientPortalRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // ---------------------------------------------------------------------------
  // GET /api/v1/projects/:projectId/client-portal - Client / Developer Portal Data
  // ---------------------------------------------------------------------------
  server.get(
    '/api/v1/projects/:projectId/client-portal',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.PROJECT_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId, role } = request.user;
      const { projectId } = request.params as { projectId: string };

      // Role permission check: Site Supervisor cannot view client portal
      if (role === 'SITE_SUPERVISOR') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Site supervisors are not permitted to access the client portal',
        });
      }

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      try {
        const portalData = await withTenantTx(prisma, tenantId, async (tx) => {
          // Verify project exists and belongs to current tenant (enforced by RLS)
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });

          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          // 1. Original Agreed Budget: Active BOQ total or original contract sum
          const activeBoq = await tx.bOQ.findFirst({
            where: { project_id: projectId, status: { in: ['ACTIVE', 'APPROVED'] } },
            orderBy: { version: 'desc' },
          });

          let originalBudgetDec = toDecimal(
            project.original_contract_sum ? project.original_contract_sum.toString() : '0',
          );
          if (activeBoq && toDecimal(activeBoq.total_amount ? activeBoq.total_amount.toString() : '0').greaterThan(0)) {
            originalBudgetDec = toDecimal(activeBoq.total_amount.toString());
          }
          if (originalBudgetDec.isZero() && !toDecimal(project.current_approved_budget.toString()).isZero()) {
            originalBudgetDec = toDecimal(project.current_approved_budget.toString());
          }

          // 2. Approved Variations Total: Sum of net_amount of APPROVED variation orders
          const approvedVariations = await tx.variationOrder.findMany({
            where: { project_id: projectId, status: 'APPROVED' },
            select: { net_amount: true },
          });
          const approvedVariationsTotalDec = approvedVariations.reduce(
            (acc, v) => acc.plus(toDecimal(v.net_amount.toString())),
            new Decimal(0),
          );

          // 3. Current Approved Budget: Original budget + approved variations total
          const currentApprovedBudgetDec = originalBudgetDec.plus(approvedVariationsTotalDec);

          // 4. Total Spent To Date: Sum of APPROVED CostEntries
          const approvedCosts = await tx.costEntry.findMany({
            where: { project_id: projectId, status: 'APPROVED' },
            select: { amount: true },
          });
          const totalSpentDec = approvedCosts.reduce(
            (acc, c) => acc.plus(toDecimal(c.amount.toString())),
            new Decimal(0),
          );

          // 5. Remaining Balance: Current approved budget - total spent to date
          const remainingBalanceDec = currentApprovedBudgetDec.minus(totalSpentDec);

          // 6. Budget Used Percentage (formatted to 1 decimal place as a number)
          const budgetUsedPercentage = currentApprovedBudgetDec.isZero() || currentApprovedBudgetDec.isNegative()
            ? 0
            : parseFloat(totalSpentDec.dividedBy(currentApprovedBudgetDec).times(100).toFixed(1));

          // 7. Physical Progress & Variance Analytics
          const latestProgress = await tx.progressRecord.findFirst({
            where: { project_id: projectId },
            orderBy: [{ record_date: 'desc' }, { created_at: 'desc' }],
          });
          const physicalProgressRatio = latestProgress
            ? toDecimal(latestProgress.overall_progress.toString())
            : new Decimal(0);
          const physicalProgressPercentage = parseFloat(physicalProgressRatio.times(100).toFixed(1));

          const varianceDelta = parseFloat((budgetUsedPercentage - physicalProgressPercentage).toFixed(1));

          const costConsumptionRatio = calculateBudgetConsumptionRatio(totalSpentDec, currentApprovedBudgetDec);
          const detailedVariance = calculateDetailedVariance(costConsumptionRatio, physicalProgressRatio);

          // 8. Photo Evidence: Verified photos joined with site_diaries
          const siteDiaries = await tx.siteDiary.findMany({
            where: { project_id: projectId },
            include: {
              photos: {
                orderBy: { taken_at: 'desc' },
              },
            },
            orderBy: { entry_date: 'desc' },
          });

          const recordedByIds = Array.from(new Set(siteDiaries.map((d) => d.recorded_by_id)));
          const users = await tx.user.findMany({
            where: { id: { in: recordedByIds } },
            select: { id: true, full_name: true },
          });
          const userMap = new Map(users.map((u) => [u.id, u.full_name]));

          const photoEvidence: Array<{
            id: string;
            caption: string;
            photo_url: string;
            latitude: number | null;
            longitude: number | null;
            captured_at: string;
            weather: string;
            recorded_by_name: string;
          }> = [];

          // Gate-4 S7: only photos explicitly opted-in (client_visible) are shared;
          // diary notes/general_notes are NEVER exposed to the client portal.
          const dailyUpdates: Array<{
            entry_date: string;
            weather: string;
            site_status: string;
            is_non_work_day: boolean;
            visible_photo_count: number;
          }> = [];

          for (const diary of siteDiaries) {
            const recordedByName = userMap.get(diary.recorded_by_id) || 'Site Supervisor';
            const visiblePhotos = diary.photos.filter((p) => p.client_visible);
            dailyUpdates.push({
              entry_date: diary.entry_date.toISOString().slice(0, 10),
              weather: diary.weather ?? 'UNKNOWN',
              site_status: diary.site_status ?? 'UNKNOWN',
              is_non_work_day: diary.is_non_work_day,
              visible_photo_count: visiblePhotos.length,
            });
            for (const photo of visiblePhotos) {
              photoEvidence.push({
                id: photo.id,
                caption: photo.caption || 'Verified Site Evidence',
                photo_url: photo.storage_key.startsWith('http') || photo.storage_key.startsWith('/')
                  ? photo.storage_key
                  : `/uploads/${photo.storage_key}`,
                latitude: photo.gps_latitude !== null && photo.gps_latitude !== undefined
                  ? parseFloat(photo.gps_latitude.toString())
                  : null,
                longitude: photo.gps_longitude !== null && photo.gps_longitude !== undefined
                  ? parseFloat(photo.gps_longitude.toString())
                  : null,
                captured_at: photo.taken_at ? photo.taken_at.toISOString() : photo.created_at.toISOString(),
                weather: diary.weather,
                recorded_by_name: recordedByName,
              });
            }
          }

          // 9. Timeline: Chronological progress records joined with boq_items
          const progressRecords = await tx.progressRecord.findMany({
            where: { project_id: projectId },
            include: {
              items: {
                include: {
                  boq_item: {
                    include: {
                      section: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ record_date: 'asc' }, { created_at: 'asc' }],
          });

          const timeline: Array<{
            id: string;
            percentage: number;
            notes: string | null;
            recorded_at: string;
            item_description: string;
            section_code: string;
          }> = [];

          for (const rec of progressRecords) {
            const recDateIso = rec.record_date.toISOString();
            if (rec.items && rec.items.length > 0) {
              for (const item of rec.items) {
                const completionPctNum = parseFloat(
                  (parseFloat(item.completion_pct.toString()) * 100).toFixed(1),
                );
                timeline.push({
                  id: item.id,
                  percentage: completionPctNum,
                  notes: rec.notes || null,
                  recorded_at: recDateIso,
                  item_description: item.boq_item ? item.boq_item.description : 'Site progress milestone',
                  section_code: item.boq_item?.section?.title || item.boq_item?.item_code || 'GEN',
                });
              }
            } else {
              const overallPctNum = parseFloat(
                (parseFloat(rec.overall_progress.toString()) * 100).toFixed(1),
              );
              timeline.push({
                id: rec.id,
                percentage: overallPctNum,
                notes: rec.notes || null,
                recorded_at: recDateIso,
                item_description: rec.notes || 'General Site Progress Milestone',
                section_code: 'GENERAL',
              });
            }
          }

          // 10. Pending Variations: OWNER_REVIEW awaiting client decision (ADR-010)
          const pendingVariationsRaw = await tx.variationOrder.findMany({
            where: {
              project_id: projectId,
              status: 'OWNER_REVIEW',
            },
            include: {
              items: {
                include: {
                  boq_item: {
                    select: { id: true, item_code: true, description: true },
                  },
                },
                orderBy: { id: 'asc' },
              },
            },
            orderBy: { variation_no: 'asc' },
          });

          const pendingVariationsList = pendingVariationsRaw.map((v) => ({
            id: v.id,
            variation_no: v.variation_no,
            title: v.title,
            reason: v.reason,
            status: v.status,
            net_amount: toCurrencyString(v.net_amount ? v.net_amount.toString() : '0'),
            time_extension_days: v.time_extension_days,
            created_at: v.created_at.toISOString(),
            items: v.items.map((i) => ({
              id: i.id,
              description: i.description,
              unit: i.unit,
              quantity: i.quantity.toString(),
              unit_rate: i.unit_rate.toString(),
              total_amount: toCurrencyString(i.total_amount ? i.total_amount.toString() : '0'),
              boq_item: i.boq_item,
            })),
          }));

          const pending_variations = {
            count: pendingVariationsList.length,
            items: pendingVariationsList,
            list: pendingVariationsList,
          };

          // 10b. Certified / Paid Payment Certificates (ADR-008): client-visible
          // once the QS/PM has certified them — drafts and submissions stay internal.
          const paymentCertsRaw = await tx.paymentCertificate.findMany({
            where: {
              project_id: projectId,
              status: { in: ['CERTIFIED', 'PAID'] },
            },
            orderBy: { certificate_no: 'asc' },
          });
          const payment_certificates = paymentCertsRaw.map((c) => ({
            id: c.id,
            certificate_no: c.certificate_no,
            period_start: c.period_start.toISOString().split('T')[0],
            period_end: c.period_end.toISOString().split('T')[0],
            this_period_amount: toCurrencyString(c.this_period_amount.toString()),
            cumulative_certified: toCurrencyString(c.cumulative_certified.toString()),
            retention_held: toCurrencyString(c.retention_held.toString()),
            net_payable: toCurrencyString(c.net_payable.toString()),
            status: c.status,
            certified_at: c.certified_at ? c.certified_at.toISOString() : null,
            paid_at: c.paid_at ? c.paid_at.toISOString() : null,
          }));

          // 11. Retention terms — tenant-configured (Stage-2); falls back to
          // the standard Kenyan schedule only when the tenant has not set one.
          const tenantRow = await tx.tenant.findUnique({
            where: { id: tenantId },
            select: { retention_terms: true, payment_instructions: true },
          });
          const maxCapAmountDec = originalBudgetDec.times(0.05);
          const defaultRetentionTerms = {
            retention_pct: 5,
            interim_deduction_rate: '5%',
            max_cap_rate: '5%',
            max_cap_amount: toCurrencyString(maxCapAmountDec),
            release_schedule: [
              {
                milestone: 'Practical Completion',
                percentage: '50%',
                rate: '50%',
                description: '50% released at Practical Completion (Section Handover)',
              },
              {
                milestone: 'Defects Liability Period',
                percentage: '50%',
                rate: '50%',
                description: '50% released at end of Defects Liability Period (DLP)',
              },
            ],
          };
          // Canonical snake_case output regardless of the stored JSON shape —
          // PATCH /company/settings accepts free-form records, so tenants may
          // have camelCase keys (interimDeductionRatePct) or snake_case ones.
          const normalizeRetentionTerms = (raw: any): any => {
            const src = raw && typeof raw === 'object' ? raw : {};
            const pct = (v: any): string | undefined =>
              v === undefined || v === null ? undefined : (typeof v === 'number' ? `${v}%` : String(v));
            const scheduleRaw = src.release_schedule ?? src.releaseSchedule;
            const schedule = Array.isArray(scheduleRaw)
              ? scheduleRaw.map((s: any) => ({
                  milestone: s.milestone ?? s.milestone_name ?? null,
                  percentage: pct(s.percentage ?? s.rate ?? s.pct),
                  rate: pct(s.rate ?? s.percentage ?? s.pct),
                  description: s.description ?? null,
                }))
              : scheduleRaw;
            const interim = pct(src.interim_deduction_rate ?? src.interimDeductionRatePct) ?? defaultRetentionTerms.interim_deduction_rate;
            return {
              ...src,
              // Convenience numeric mirror for API consumers (e.g. "5%" -> 5).
              retention_pct: src.retention_pct ?? src.retentionPct ?? (interim ? parseFloat(String(interim)) : undefined),
              interim_deduction_rate: interim,
              max_cap_rate: pct(src.max_cap_rate ?? src.maxCapRatePct) ?? defaultRetentionTerms.max_cap_rate,
              max_cap_amount: src.max_cap_amount ?? src.maxCapAmount ?? defaultRetentionTerms.max_cap_amount,
              release_schedule: schedule ?? defaultRetentionTerms.release_schedule,
            };
          };
          const retention_terms = tenantRow?.retention_terms
            ? normalizeRetentionTerms(tenantRow.retention_terms)
            : defaultRetentionTerms;

          // Client-visible invoices with balances and payment history —
          // mirrors what the token portal shows (Stage-2 contract).
          const invoicesRaw = await tx.invoice.findMany({
            where: { project_id: projectId },
            orderBy: { created_at: 'desc' },
            include: { payments: { orderBy: { paid_at: 'desc' } } },
          });
          const invoices = invoicesRaw.map((inv: any) => ({
            id: inv.id,
            invoice_id: inv.id,
            invoice_no: inv.invoice_no,
            title: inv.title,
            status: inv.status,
            currency: inv.currency,
            subtotal: toCurrencyString(inv.subtotal?.toString()),
            tax_amount: toCurrencyString(inv.tax_amount?.toString()),
            total: toCurrencyString(inv.total?.toString()),
            amount_paid: toCurrencyString(inv.amount_paid?.toString()),
            paid: toCurrencyString(inv.amount_paid?.toString()),
            balance_due: toCurrencyString(inv.balance_due?.toString()),
            balance: toCurrencyString(inv.balance_due?.toString()),
            issue_date: inv.issue_date ? inv.issue_date.toISOString().split('T')[0] : null,
            due_date: inv.due_date ? inv.due_date.toISOString().split('T')[0] : null,
            payments: (inv.payments ?? []).map((pay: any) => ({
              id: pay.id,
              amount: toCurrencyString(pay.amount?.toString()),
              method: pay.method,
              reference: pay.reference,
              paid_at: pay.paid_at ? pay.paid_at.toISOString() : null,
            })),
          }));

          return {
            project: {
              id: project.id,
              name: project.name,
              code: project.code,
              location: project.location || null,
              nca_registration_no: project.nca_project_no || null,
              start_date: project.start_date ? project.start_date.toISOString().split('T')[0] : null,
              expected_completion_date: project.target_end_date ? project.target_end_date.toISOString().split('T')[0] : null,
            },
            financials: {
              original_agreed_budget: toCurrencyString(originalBudgetDec),
              approved_variations_total: toCurrencyString(approvedVariationsTotalDec),
              current_approved_budget: toCurrencyString(currentApprovedBudgetDec),
              total_spent_to_date: toCurrencyString(totalSpentDec),
              remaining_balance: toCurrencyString(remainingBalanceDec),
              budget_used_percentage: budgetUsedPercentage,
            },
            progress: {
              physical_progress_percentage: physicalProgressPercentage,
              variance_delta: varianceDelta,
              health_status: detailedVariance.status,
              health_notice: detailedVariance.message,
            },
            photo_evidence: photoEvidence,
            daily_updates: dailyUpdates,
            timeline,
            pending_variations,
            payment_certificates,
            invoices,
            // Top-level budget mirrors (auditor contract reads them directly,
            // not nested under financials).
            original_agreed_budget: toCurrencyString(originalBudgetDec),
            approved_variations_total: toCurrencyString(approvedVariationsTotalDec),
            current_approved_budget: toCurrencyString(currentApprovedBudgetDec),
            total_spent_to_date: toCurrencyString(totalSpentDec),
            retention_terms,
            payment_instructions: tenantRow?.payment_instructions ?? null,
          };
        });

        return reply.status(200).send({
          data: portalData,
          ...portalData,
        });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to fetch client portal data');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to fetch client portal data',
        });
      }
    },
  );


  // ---------------------------------------------------------------------------
  // Client-initiated project requests ("Request a project" portal flow)
  // ---------------------------------------------------------------------------
  const PROJECT_TYPES = [
    // Auditor contract sends enum-style types; keep both vocabularies.
    'RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'INSTITUTIONAL', 'OTHER_WORKS',
    'New house / bungalow', 'Maisonette or villa', 'Apartments / flats',
    'Commercial building', 'Renovation / remodeling', 'Kitchen or bathroom remodel',
    'Interior design & finishes', 'Fencing & gates', 'Borehole / water works',
    'Solar / electrical installation', 'CCTV & security', 'Landscaping & gardening',
    'Roads, drainage or civil works', 'Land clearing & surveying', 'Other',
  ];
  const BUDGET_RANGES = ['Below KES 1M', 'KES 1M - 5M', 'KES 5M - 20M', 'KES 20M - 50M', 'Above KES 50M', 'Not sure yet'];
  const START_TFRAMES = ['As soon as possible', 'Within 3 months', 'In 3 - 6 months', 'In 6 - 12 months', 'Just planning for now'];

  server.post(
    '/api/v1/client/project-requests',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user as any;
      if (role !== 'CLIENT') {
        return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Only client accounts can submit project requests' });
      }
      const body = (request.body || {}) as Record<string, unknown>;
      const projectType = String(body.projectType || '').trim();
      // Accept both field vocabularies: locationText/siteLocation and
      // description/workDescription (auditor contract uses the latter).
      const locationText = String(body.locationText || body.siteLocation || '').trim();
      const description = String(body.description || body.workDescription || '').trim();
      if (!PROJECT_TYPES.includes(projectType)) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid project type' });
      }
      if (!locationText || locationText.length > 255) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Site location is required (max 255 chars)' });
      }
      if (!description || description.length > 5000) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Work description is required (max 5000 chars)' });
      }
      const budgetRange = BUDGET_RANGES.includes(String(body.budgetRange)) ? String(body.budgetRange) : null;
      const startTimeframe = START_TFRAMES.includes(String(body.startTimeframe)) ? String(body.startTimeframe) : null;
      const contactPhone = body.contactPhone ? String(body.contactPhone).slice(0, 30) : null;
      try {
        const created = await withTenantTx(prisma, tenantId, async (tx) => {
          const row = await tx.clientProjectRequest.create({
            data: {
              tenant_id: tenantId,
              user_id: sub,
              project_type: projectType,
              location_text: locationText,
              budget_range: budgetRange,
              start_timeframe: startTimeframe,
              description,
              contact_phone: contactPhone,
            },
          });
          // Stage-2: client project requests must reach the contractor inbox.
          const requesterName = (request.user as any).fullName || (request.user as any).email || 'A client';
          await notifyTeam(tx, {
            tenantId,
            senderId: sub,
            senderName: `${requesterName} (client)`,
            audience: 'ALL_MEMBERS',
            body: `New project request from ${requesterName}: ${projectType} at ${locationText}. ${description.slice(0, 200)}${description.length > 200 ? '…' : ''}`,
          });
          return row;
        });
        return reply.status(201).send({ data: created });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to submit request' });
      }
    },
  );

  server.get(
    '/api/v1/client/project-requests',
    { preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user as any;
      try {
        const rows = await withTenantTx(prisma, tenantId, async (tx) =>
          tx.clientProjectRequest.findMany({
            where: role === 'CLIENT' ? { user_id: sub } : {},
            orderBy: { created_at: 'desc' },
            take: 50,
          }),
        );
        return reply.status(200).send({
          data: rows.map((r) => ({
            ...r,
            created_at: r.created_at.toISOString(),
            updated_at: r.updated_at.toISOString(),
          })),
        });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list project requests' });
      }
    },
  );
};

