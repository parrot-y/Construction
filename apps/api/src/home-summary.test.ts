import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

// P4.1 — GET /api/v1/home/summary aggregate endpoint.
// Verifies shape, field-level permission gating (money vs site data) and
// project existence/membership handling, replacing the old per-project
// fan-outs the Home dashboard used to make.
describe('Home summary aggregate', () => {
  const server = buildServer();

  let adminCookie: string;
  let clientCookie: string;
  let projectId: string;

  const login = async (email: string) => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'Password123!' },
    });
    expect(res.statusCode).toBe(200);
    return res.headers['set-cookie'] as string;
  };

  beforeAll(async () => {
    await server.ready();
    adminCookie = await login('admin@apexbuilders.co.ke');
    clientCookie = await login('client@apexbuilders.co.ke');

    const projectsRes = await server.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { cookie: adminCookie },
    });
    expect(projectsRes.statusCode).toBe(200);
    const body = JSON.parse(projectsRes.body);
    const list = body.data || body.projects || body;
    projectId = (Array.isArray(list) ? list[0] : list.data?.[0])?.id;
    expect(projectId).toBeTruthy();
  });

  it('returns the aggregate shape for an admin without projectId', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/home/summary',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(Array.isArray(data.moneyPerProject)).toBe(true);
    expect(Array.isArray(data.milestones)).toBe(true);
    expect(data.siteHealth).toBeNull();
    expect(data.latestPhotos).toBeNull();
    for (const row of data.moneyPerProject) {
      expect(row).toHaveProperty('projectId');
      expect(row).toHaveProperty('certified');
      expect(row).toHaveProperty('invoiced');
      expect(row).toHaveProperty('paid');
      expect(row).toHaveProperty('retention');
    }
  });

  it('returns site health and photos when projectId is provided', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/home/summary?projectId=${projectId}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(data.siteHealth).not.toBeNull();
    expect(data.siteHealth).toHaveProperty('openSnags');
    expect(data.siteHealth).toHaveProperty('snagsBySeverity');
    expect(data.siteHealth).toHaveProperty('recentIncidents30d');
    expect(data.siteHealth).toHaveProperty('diaryDays14');
    expect(data.siteHealth).toHaveProperty('missedDiaryDays');
    expect(Array.isArray(data.latestPhotos)).toBe(true);
  });

  it('withholds money data from roles without cost+invoice view', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/home/summary',
      headers: { cookie: clientCookie },
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    // CLIENT holds SITE_DIARY_VIEW but not COST_VIEW/INVOICE_VIEW.
    expect(data.moneyPerProject).toBeNull();
    expect(Array.isArray(data.milestones)).toBe(true);
  });

  it('returns client-safe photos only for CLIENT/OWNER roles', async () => {
    // The client is only a member of some projects — pick one they can see.
    const clientProjects = await server.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { cookie: clientCookie },
    });
    const cpBody = JSON.parse(clientProjects.body);
    const cpList = cpBody.data || cpBody.projects || cpBody;
    const clientProjectId = (Array.isArray(cpList) ? cpList[0] : cpList.data?.[0])?.id || projectId;
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/home/summary?projectId=${clientProjectId}`,
      headers: { cookie: clientCookie },
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    for (const photo of data.latestPhotos || []) {
      expect(photo.client_visible).toBe(true);
    }
  });

  it('404s on an unknown projectId', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/home/summary?projectId=00000000-0000-0000-0000-000000000000',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects unauthenticated callers', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/home/summary' });
    expect(res.statusCode).toBe(401);
  });
});
