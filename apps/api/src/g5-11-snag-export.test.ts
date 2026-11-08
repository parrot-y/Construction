import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { enrollAllTenantUsers } from './test-members';

/** Gate-5: punch-list CSV export (observed Punch list > CSV button). */
describe('Gate-5 G5-11: Snag register CSV export', () => {
  const server = buildServer();

  let adminCookie: string;
  let projectId: string;

  beforeAll(async () => {
    await server.ready();
    const login = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' } });
    adminCookie = login.headers['set-cookie'] as string;
    const list = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie: adminCookie } });
    projectId = JSON.parse(list.body).data[0].id;
      await enrollAllTenantUsers(projectId);
  });

  it('exports CSV with header + snag rows', async () => {
    // ensure at least one snag exists
    await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/snags`, headers: { cookie: adminCookie },
      payload: {
        locationBlock: 'Block A', locationFloor: '2nd Floor', locationRoom: 'Flat 3 - Bath',
        tradeCategory: 'Tiling', description: 'ZZ-EXPORT hollow tile at floor/wall joint',
        severity: 'FUNCTIONAL', identifiedByName: 'QS',
      },
    });

    const res = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}/snags/export?format=csv`, headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const csv = res.body;
    expect(csv).toContain('Ref,Location,Trade');
    expect(csv).toContain('SNAG-');
    expect(csv).toContain('ZZ-EXPORT');
    expect(csv).toContain('Tiling');
  });

  it('exports PDF register with %PDF payload', async () => {
    const res = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}/snags/export?format=pdf`, headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.rawPayload.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('rejects unsupported format + bad project id', async () => {
    const bad = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}/snags/export?format=xlsx`, headers: { cookie: adminCookie },
    });
    expect(bad.statusCode).toBe(400);
    const badId = await server.inject({
      method: 'GET', url: '/api/v1/projects/not-a-uuid/snags/export?format=csv', headers: { cookie: adminCookie },
    });
    expect(badId.statusCode).toBe(404);
  });
});
