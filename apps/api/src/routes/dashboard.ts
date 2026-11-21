import { prisma, withTenantTx } from '@construction/db';
import { Permissions, hasPermission, Role } from '@construction/permissions';
import {
  calculateBudgetConsumptionRatio,
  calculateDetailedVariance,
  toDecimal,
  Decimal,
} from '@construction/money';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { TENANT_WIDE_ROLES } from '../plugins/routeAuthorization';

export const dashboardRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/dashboard - Role-tailored summary metrics
  server.get(
    '/api/v1/dashboard',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, role } = request.user;

      const dashboardData = await withTenantTx(prisma, tenantId, async (tx) => {
        // Base projects list
        const projects = await tx.project.findMany({
          orderBy: { created_at: 'desc' },
          include: {
            members: { include: { user: { select: { id: true, full_name: true } } } },
          },
        });

        // Compute variance status for active projects per Milestone M7
        const projectsWithVariance = await Promise.all(
          projects.map(async (p) => {
            if (p.status !== 'ACTIVE') {
              return {
                ...p,
                varianceStatus: 'ON_TRACK' as const,
                varianceSeverity: 'info' as const,
                varianceMessage: 'Expenditure is aligned with recorded physical progress.',
              };
            }

            // Current approved budget
            let approvedBudgetDec = toDecimal(p.current_approved_budget.toString());
            if (approvedBudgetDec.isZero()) {
              const activeBoq = await tx.bOQ.findFirst({
                where: { project_id: p.id, status: { in: ['ACTIVE', 'APPROVED'] } },
                orderBy: { version: 'desc' },
              });
              if (activeBoq) {
                approvedBudgetDec = toDecimal(activeBoq.total_amount ? activeBoq.total_amount.toString() : '0');
              }
            }

            // Approved costs
            const approvedCosts = await tx.costEntry.findMany({
              where: { project_id: p.id, status: 'APPROVED' },
              select: { amount: true },
            });
            const approvedCostDec = approvedCosts.reduce(
              (acc, c) => acc.plus(toDecimal(c.amount.toString())),
              new Decimal(0),
            );

            // Latest physical progress record
            const latestProgress = await tx.progressRecord.findFirst({
              where: { project_id: p.id },
              orderBy: [{ record_date: 'desc' }, { created_at: 'desc' }],
            });

            const consumptionRatio = calculateBudgetConsumptionRatio(approvedCostDec, approvedBudgetDec);
            const physicalProgress = latestProgress
              ? toDecimal(latestProgress.overall_progress.toString())
              : new Decimal(0);

            const detailed = calculateDetailedVariance(consumptionRatio, physicalProgress);

            return {
              ...p,
              varianceStatus: detailed.status,
              varianceSeverity: detailed.severity,
              varianceMessage: detailed.message,
              varianceDetail: {
                status: detailed.status,
                statusLabel: detailed.statusLabel,
                severity: detailed.severity,
                message: detailed.message,
                costConsumptionPercentage: detailed.costConsumptionPercentage,
                physicalProgressPercentage: detailed.physicalProgressPercentage,
                differencePercentage: detailed.differencePercentage,
              },
            };
          }),
        );

        const activeProjectsCount = projects.filter((p) => p.status === 'ACTIVE').length;
        const totalContractSum = projects.reduce(
          (acc, p) => acc + Number(p.original_contract_sum),
          0,
        );
        const totalApprovedBudget = projects.reduce(
          (acc, p) => acc + Number(p.current_approved_budget),
          0,
        );

        if (role === 'ADMIN' || role === 'COMPANY_ADMIN') {
          const [teamMembersCount, pendingApprovalsCount, pendingInvitesCount, recentAudits] =
            await Promise.all([
              tx.membership.count({ where: { tenant_id: tenantId } }),
              tx.costEntry.count({ where: { tenant_id: tenantId, status: 'PENDING' } }),
              tx.invitation.count({ where: { tenant_id: tenantId, status: 'PENDING' } }),
              tx.auditLog.findMany({
                where: { tenant_id: tenantId },
                orderBy: { created_at: 'desc' },
                take: 5,
              }),
            ]);

          return {
            role: 'COMPANY_ADMIN',
            metrics: {
              activeProjectsCount,
              totalProjectsCount: projects.length,
              totalContractSum,
              totalApprovedBudget,
              teamMembersCount,
              pendingApprovalsCount,
              pendingInvitesCount,
            },
            projects: projectsWithVariance,
            recentAudits,
          };
        }

        if (role === 'PM_QS') {
          const [pendingCostReviews, variationsCount, boqCount] = await Promise.all([
            tx.costEntry.count({ where: { tenant_id: tenantId, status: 'PENDING' } }),
            tx.variationOrder.count({ where: { tenant_id: tenantId } }),
            tx.bOQ.count({ where: { tenant_id: tenantId, status: 'ACTIVE' } }),
          ]);

          return {
            role: 'PM_QS',
            metrics: {
              activeProjectsCount,
              totalApprovedBudget,
              pendingCostReviews,
              variationsCount,
              activeBOQCount: boqCount,
            },
            projects: projectsWithVariance,
          };
        }

        if (role === 'SITE_SUPERVISOR') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const todayDiaries = await tx.siteDiary.findMany({
            where: {
              tenant_id: tenantId,
              entry_date: { gte: today },
            },
            include: {
              labor_headcounts: true,
              photos: true,
            },
          });

          const totalHeadcountToday = todayDiaries.reduce((acc, d) => {
            return acc + d.labor_headcounts.reduce((subAcc, l) => subAcc + l.headcount, 0);
          }, 0);

          return {
            role: 'SITE_SUPERVISOR',
            metrics: {
              assignedProjectsCount: projects.length,
              todayDiariesCount: todayDiaries.length,
              totalHeadcountToday,
              totalPhotosToday: todayDiaries.reduce((acc, d) => acc + d.photos.length, 0),
            },
            projects: projectsWithVariance,
          };
        }

        // CLIENT / DEVELOPER
        const approvedCostEntries = await tx.costEntry.findMany({
          where: { tenant_id: tenantId, status: 'APPROVED' },
        });

        const totalCertifiedCost = approvedCostEntries.reduce(
          (acc, c) => acc + Number(c.amount),
          0,
        );

        const pendingVariations = await tx.variationOrder.count({
          where: { tenant_id: tenantId, status: 'SUBMITTED' },
        });

        return {
          role: 'CLIENT',
          metrics: {
            activeProjectsCount,
            totalContractSum,
            totalCertifiedCost,
            pendingClientApprovalsCount: pendingVariations,
            overallPhysicalProgressPct: 0.12, // Baseline progress indicator
          },
          projects: projectsWithVariance,
        };
      });

      return reply.status(200).send({ data: dashboardData });
    },
  );

  // GET /api/v1/home/summary — one aggregate call for the Home dashboard.
  // Replaces the per-project fan-outs (payment-certificates × N, tasks × N)
  // and the duplicated site-diaries/snags/incidents fetches. Pass ?projectId=
  // to also get site health and latest photos for the selected project.
  server.get(
    '/api/v1/home/summary',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const userRole = role as Role | undefined;
      const { projectId } = request.query as { projectId?: string };

      // Field-level scoping mirrors the endpoints this aggregate replaces:
      // money needs COST_VIEW + INVOICE_VIEW (certificates + invoices),
      // schedule/site data needs SITE_DIARY_VIEW, and non-tenant-wide roles
      // only see projects they are members of.
      const canMoney =
        !!userRole &&
        hasPermission(userRole, Permissions.COST_VIEW) &&
        hasPermission(userRole, Permissions.INVOICE_VIEW);
      const canSite = !!userRole && hasPermission(userRole, Permissions.SITE_DIARY_VIEW);
      const tenantWide = !!userRole && TENANT_WIDE_ROLES.has(userRole);
      const clientSafe = userRole === 'CLIENT' || userRole === 'OWNER';

      const summary = await withTenantTx(prisma, tenantId, async (tx) => {
        const memberProjectIds = tenantWide
          ? null
          : (
              await tx.projectMember.findMany({
                where: { user_id: sub },
                select: { project_id: true },
              })
            ).map((m) => m.project_id);
        const visibleProjectIds = memberProjectIds;

        if (projectId) {
          const project = await tx.project.findFirst({
            where: { id: projectId },
            select: { id: true },
          });
          if (!project) {
            return { __status: 404 as const };
          }
          if (visibleProjectIds && !visibleProjectIds.includes(projectId)) {
            return { __status: 403 as const };
          }
        }

        const scopedProjectFilter = visibleProjectIds ? { in: visibleProjectIds } : undefined;
        const wantProjectScope = !!projectId && canSite;

        const [projects, invoices, certs, tasks, projectSnags, projectIncidents, projectPhotos] =
          await Promise.all([
            tx.project.findMany({
              where: scopedProjectFilter ? { id: scopedProjectFilter } : {},
              select: { id: true, name: true },
            }),
            canMoney
              ? tx.invoice.findMany({
                  where: {
                    status: { notIn: ['DRAFT', 'VOID', 'CANCELLED'] },
                    ...(scopedProjectFilter ? { project_id: scopedProjectFilter } : {}),
                  },
                  select: { project_id: true, total: true, amount_paid: true, status: true },
                })
              : Promise.resolve([]),
            canMoney
              ? tx.paymentCertificate.findMany({
                  where: {
                    status: { notIn: ['DRAFT', 'VOID'] },
                    ...(scopedProjectFilter ? { project_id: scopedProjectFilter } : {}),
                  },
                  select: { project_id: true, this_period_amount: true, retention_held: true },
                })
              : Promise.resolve([]),
            canSite
              ? tx.projectScheduleTask.findMany({
                  where: {
                    status: { notIn: ['COMPLETED', 'DONE'] },
                    ...(scopedProjectFilter ? { project_id: scopedProjectFilter } : {}),
                  },
                  orderBy: { planned_start_date: 'asc' },
                  take: 8,
                  select: {
                    id: true, project_id: true, task_name: true, planned_start_date: true,
                    planned_end_date: true, status: true, progress_percentage: true,
                  },
                })
              : Promise.resolve([]),
            wantProjectScope
              ? tx.snagItem.findMany({
                  where: { project_id: projectId, status: { notIn: ['VERIFIED_CLOSED', 'REJECTED'] } },
                  select: { severity: true },
                })
              : Promise.resolve([]),
            wantProjectScope
              ? tx.safetyIncident.count({
                  where: { project_id: projectId, incident_date: { gte: new Date(Date.now() - 30 * 864e5) } },
                })
              : Promise.resolve(0),
            wantProjectScope
              ? tx.sitePhoto.findMany({
                  where: {
                    site_diary: { project_id: projectId },
                    ...(clientSafe ? { client_visible: true } : {}),
                  },
                  orderBy: { taken_at: 'desc' },
                  take: 6,
                  select: {
                    id: true, storage_key: true, caption: true, client_visible: true,
                    taken_at: true, site_diary: { select: { entry_date: true } },
                  },
                })
              : Promise.resolve([]),
          ]);

        const projectName = new Map(projects.map((p) => [p.id, p.name]));
        const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

        const moneyPerProject = canMoney
          ? projects.map((p) => {
              const inv = invoices.filter((i) => i.project_id === p.id);
              const cs = certs.filter((c) => c.project_id === p.id);
              return {
                projectId: p.id,
                certified: cs.reduce((s, c) => s + num(c.this_period_amount), 0),
                invoiced: inv.reduce((s, i) => s + num(i.total), 0),
                paid: inv.reduce((s, i) => s + (num(i.amount_paid) || (i.status === 'PAID' ? num(i.total) : 0)), 0),
                retention: cs.reduce((s, c) => Math.max(s, num(c.retention_held)), 0),
              };
            })
          : null;

        const milestones = canSite
          ? tasks.map((t) => ({
              ...t,
              progress_percentage: num(t.progress_percentage),
              projectName: projectName.get(t.project_id) || '',
            }))
          : null;

        let siteHealth = null;
        let latestPhotos = null;
        if (wantProjectScope) {
          const bySeverity: Record<string, number> = {};
          for (const s of projectSnags) bySeverity[s.severity] = (bySeverity[s.severity] || 0) + 1;
          const diaryCount = await tx.siteDiary.count({
            where: {
              project_id: projectId,
              entry_date: { gte: new Date(Date.now() - 14 * 864e5) },
            },
          });
          siteHealth = {
            openSnags: projectSnags.length,
            snagsBySeverity: bySeverity,
            recentIncidents30d: projectIncidents,
            diaryDays14: diaryCount,
            missedDiaryDays: Math.max(0, 10 - diaryCount),
          };
          latestPhotos = projectPhotos.map((p) => ({
            id: p.id,
            storage_key: p.storage_key,
            caption: p.caption,
            client_visible: p.client_visible,
            entry_date: p.site_diary.entry_date,
          }));
        }

        return { moneyPerProject, milestones, siteHealth, latestPhotos };
      });

      if (summary && '__status' in summary) {
        if (summary.__status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
        }
        return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'You are not a member of this project' });
      }

      return reply.status(200).send({ data: summary });
    },
  );
};
