import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

/**
 * Project list visibility must match what the caller can actually access.
 * requireProjectMembership 403s every project-scoped route for non-members,
 * so GET /api/v1/projects must not list projects the caller isn't a member
 * of — otherwise the console picker defaults to an inaccessible project and
 * every write fails with 403 (observed in the E2E offline-diary journey).
 * Tenant-wide roles (COMPANY_ADMIN/ADMIN/EXECUTIVE) still see everything.
 */
describe('Project list visibility follows membership', () => {
  const server = buildServer();

  let adminCookie: string;
  let supervisorCookie: string;
  let tenantId: string;
  let memberProjectId: string;
  let foreignProjectId: string;

  const login = async (email: string) => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'Password123!' },
    });
    return { cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
  };

  const listIds = async (cookie: string) => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    return (JSON.parse(res.body).data as { id: string }[]).map((p) => p.id);
  };

  beforeAll(async () => {
    await server.ready();
    const admin = await login('admin@apexbuilders.co.ke');
    adminCookie = admin.cookie;
    tenantId = admin.body.user.tenant.id;
    supervisorCookie = (await login('supervisor@apexbuilders.co.ke')).cookie;

    const stamp = Date.now().toString().slice(-6);
    // Admin creates two projects — creator auto-becomes the only member.
    for (const [key, name] of [
      ['member', `Visibility Member ${stamp}`],
      ['foreign', `Visibility Foreign ${stamp}`],
    ] as const) {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { cookie: adminCookie },
        payload: { name, code: `VIS-${key.toUpperCase()}-${stamp}` },
      });
      expect(res.statusCode).toBe(201);
      const id = JSON.parse(res.body).data.id as string;
      if (key === 'member') memberProjectId = id;
      else foreignProjectId = id;
    }

    // Give the supervisor membership on exactly one of them.
    const { prisma, withTenantTx } = await import('@construction/db');
    const supervisor = await prisma.user.findFirst({ where: { email: 'supervisor@apexbuilders.co.ke' } });
    await withTenantTx(prisma, tenantId, async (tx) => {
      await tx.projectMember.create({
        data: {
          tenant_id: tenantId,
          project_id: memberProjectId,
          user_id: supervisor!.id,
          role: 'SITE_SUPERVISOR',
        },
      });
    });
  });

  it('restricted role sees member projects but not foreign tenant projects', async () => {
    const ids = await listIds(supervisorCookie);
    expect(ids).toContain(memberProjectId);
    expect(ids).not.toContain(foreignProjectId);
  });

  it('tenant-wide admin still sees every project', async () => {
    const ids = await listIds(adminCookie);
    expect(ids).toContain(memberProjectId);
    expect(ids).toContain(foreignProjectId);
  });
});
