import { prisma, withTenantTx } from '@construction/db';

/**
 * Test helper: enroll every user of the project's tenant as a project member.
 * Required because project-scoped routes now enforce membership — suites that
 * create ad-hoc projects must enroll the roles they exercise.
 *
 * The owning tenant is resolved by probing each tenant (the tenants table is
 * not RLS-scoped, project rows are).
 */
export async function enrollAllTenantUsers(projectId: string): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  for (const t of tenants) {
    const enrolled = await withTenantTx(prisma, t.id, async (tx) => {
      const project = await tx.project.findUnique({ where: { id: projectId }, select: { id: true } });
      if (!project) return false;
      const users = await tx.user.findMany({
        where: { memberships: { some: { tenant_id: t.id } } },
        select: { id: true, memberships: { where: { tenant_id: t.id }, select: { role: true } } },
      });
      for (const u of users) {
        const role = u.memberships[0]?.role || 'MEMBER';
        await tx.projectMember.upsert({
          where: { project_id_user_id: { project_id: projectId, user_id: u.id } },
          update: {},
          create: { tenant_id: t.id, project_id: projectId, user_id: u.id, role },
        });
      }
      return true;
    });
    if (enrolled) return;
  }
}

/** Same enrollment but inside an existing tenant transaction (project may be uncommitted). */
export async function enrollAllTenantUsersTx(tx: any, tenantId: string, projectId: string): Promise<void> {
  const users = await tx.user.findMany({
    where: { memberships: { some: { tenant_id: tenantId } } },
    select: { id: true, memberships: { where: { tenant_id: tenantId }, select: { role: true } } },
  });
  for (const u of users) {
    const role = u.memberships[0]?.role || 'MEMBER';
    await tx.projectMember.upsert({
      where: { project_id_user_id: { project_id: projectId, user_id: u.id } },
      update: {},
      create: { tenant_id: tenantId, project_id: projectId, user_id: u.id, role },
    });
  }
}
