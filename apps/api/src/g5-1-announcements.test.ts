import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

/**
 * Gate-5 G5-1: Announcements — audience targeting, read receipts,
 * expiry, RBAC.
 */
describe('Gate-5 G5-1: Announcements', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let supervisorCookie: string;
  let tenantAId: string;
  let allAnnId: string;
  let clientAnnId: string;
  let draftAnnId: string;

  async function list(cookie: string) {
    const res = await server.inject({ method: 'GET', url: '/api/v1/announcements', headers: { cookie } });
    return { status: res.statusCode, body: JSON.parse(res.body) };
  }

  beforeAll(async () => {
    await server.ready();

    const login = async (email: string) => {
      const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return { cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
    };
    const admin = await login('admin@apexbuilders.co.ke');
    adminCookie = admin.cookie;
    tenantAId = admin.body.user.tenant.id;
    qsCookie = (await login('qs@apexbuilders.co.ke')).cookie;
    supervisorCookie = (await login('supervisor@apexbuilders.co.ke')).cookie;
  });

  it('creates announcements for ALL, CLIENTS and DRAFT audiences', async () => {
    const all = await server.inject({
      method: 'POST', url: '/api/v1/announcements', headers: { cookie: adminCookie },
      payload: { title: 'Site induction Monday 7am', body: 'All staff report to site office for toolbox talk.', priority: 'HIGH', audience: 'ALL' },
    });
    expect(all.statusCode).toBe(201);
    allAnnId = JSON.parse(all.body).data.id;
    expect(JSON.parse(all.body).data.status).toBe('PUBLISHED');

    const clients = await server.inject({
      method: 'POST', url: '/api/v1/announcements', headers: { cookie: adminCookie },
      payload: { title: 'Progress update for clients', body: 'Superstructure works proceeding on schedule.', audience: 'CLIENTS' },
    });
    expect(clients.statusCode).toBe(201);
    clientAnnId = JSON.parse(clients.body).data.id;

    const draft = await server.inject({
      method: 'POST', url: '/api/v1/announcements', headers: { cookie: qsCookie },
      payload: { title: 'Draft safety notice', body: 'Under review.', status: 'DRAFT' },
    });
    expect(draft.statusCode).toBe(201);
    draftAnnId = JSON.parse(draft.body).data.id;
  });

  it('audience filtering: internal roles see ALL, CLIENTS hidden; drafts hidden from list', async () => {
    const adminList = await list(adminCookie);
    const titles = adminList.body.data.map((a: any) => a.title);
    expect(titles).toContain('Site induction Monday 7am');
    expect(titles).not.toContain('Draft safety notice'); // DRAFT not listed

    const supList = await list(supervisorCookie);
    const supTitles = supList.body.data.map((a: any) => a.title);
    expect(supTitles).toContain('Site induction Monday 7am');
    expect(supTitles).not.toContain('Progress update for clients'); // CLIENTS audience hidden from field staff
  });

  it('read receipts: mark read is idempotent and visible to manager', async () => {
    const read1 = await server.inject({
      method: 'POST', url: `/api/v1/announcements/${allAnnId}/read`, headers: { cookie: qsCookie },
    });
    expect(read1.statusCode).toBe(200);
    expect(JSON.parse(read1.body).data.alreadyRead).toBe(false);

    const read2 = await server.inject({
      method: 'POST', url: `/api/v1/announcements/${allAnnId}/read`, headers: { cookie: qsCookie },
    });
    expect(JSON.parse(read2.body).data.alreadyRead).toBe(true);

    const readers = await server.inject({
      method: 'GET', url: `/api/v1/announcements/${allAnnId}/readers`, headers: { cookie: adminCookie },
    });
    expect(readers.statusCode).toBe(200);
    const readerList = JSON.parse(readers.body).data;
    expect(readerList.length).toBe(1);
    expect(readerList[0].user?.email).toBe('qs@apexbuilders.co.ke');

    // read flag surfaces in list payload
    const qsList = await list(qsCookie);
    const ann = qsList.body.data.find((a: any) => a.id === allAnnId);
    expect(ann.read_by_me).toBe(true);
    expect(ann.read_count).toBe(1);
  });

  it('expires_at hides announcement from list', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    await server.inject({
      method: 'POST', url: '/api/v1/announcements', headers: { cookie: adminCookie },
      payload: { title: 'Expired notice', body: 'Already past.', expiresAt: past },
    });
    const res = await list(adminCookie);
    expect(res.body.data.map((a: any) => a.title)).not.toContain('Expired notice');
  });

  it('RBAC: supervisor cannot create; can read own-visible list', async () => {
    const create = await server.inject({
      method: 'POST', url: '/api/v1/announcements', headers: { cookie: supervisorCookie },
      payload: { title: 'Nope', body: 'Should fail' },
    });
    expect(create.statusCode).toBe(403);

    const readers = await server.inject({
      method: 'GET', url: `/api/v1/announcements/${allAnnId}/readers`, headers: { cookie: supervisorCookie },
    });
    expect(readers.statusCode).toBe(403);
  });

  it('PATCH: publish draft, archive, archived is terminal', async () => {
    const pub = await server.inject({
      method: 'PATCH', url: `/api/v1/announcements/${draftAnnId}`, headers: { cookie: adminCookie },
      payload: { status: 'PUBLISHED' },
    });
    expect(pub.statusCode).toBe(200);
    expect(JSON.parse(pub.body).data.published_at).toBeTruthy();

    const arch = await server.inject({
      method: 'PATCH', url: `/api/v1/announcements/${draftAnnId}`, headers: { cookie: adminCookie },
      payload: { status: 'ARCHIVED' },
    });
    expect(arch.statusCode).toBe(200);

    const after = await server.inject({
      method: 'PATCH', url: `/api/v1/announcements/${draftAnnId}`, headers: { cookie: adminCookie },
      payload: { title: 'Too late' },
    });
    expect(after.statusCode).toBe(400);
  });
});
