import { prisma, withTenantTx } from '@construction/db';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

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
            projects,
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
            projects,
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
            projects,
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
          projects,
        };
      });

      return reply.status(200).send({ data: dashboardData });
    },
  );
};
