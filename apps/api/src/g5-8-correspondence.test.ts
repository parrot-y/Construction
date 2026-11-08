import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { enrollAllTenantUsers } from './test-members';

/**
 * Gate-5 G5-8: Correspondence log — LETTER/SUBMITTAL/TRANSMITTAL/NOTICE,
 * direction, parties, refs, status lifecycle.
 */
describe('Gate-5 G5-8: Correspondence log', () => {
  const server = buildServer();

  let adminCookie: string;
  let supervisorCookie: string;
  let projectId: string;
  let corrId: string;

  beforeAll(async () => {
    await server.ready();
    const login = async (email: string) => {
      const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return { cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
    };
    adminCookie = (await login('admin@apexbuilders.co.ke')).cookie;
    supervisorCookie = (await login('supervisor@apexbuilders.co.ke')).cookie;
    const res = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie: adminCookie } });
    projectId = JSON.parse(res.body).data[0].id;
      await enrollAllTenantUsers(projectId);
  });

  it('creates notice + letter with sequential COR refs', async () => {
    const n = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/correspondence`, headers: { cookie: supervisorCookie },
      payload: {
        type: 'NOTICE', direction: 'OUTGOING',
        subject: '7-day notice of intent to suspend — delayed stone delivery',
        fromName: 'Apex Builders Ltd', toName: 'Murang\'a Stone Supplies',
        reference: 'VO/2026/014', letterDate: '2026-11-08',
      },
    });
    expect(n.statusCode).toBe(201);
    corrId = JSON.parse(n.body).data.id;
    expect(JSON.parse(n.body).data.ref).toBe('COR-001');

    const l = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/correspondence`, headers: { cookie: adminCookie },
      payload: {
        type: 'LETTER', direction: 'INCOMING',
        subject: 'Architect response to RFI-12 — slab edge detail',
        fromName: 'Studio Mawe Architects', toName: 'Apex Builders Ltd',
        reference: 'SMA/RFI-12/REV-A',
      },
    });
    expect(l.statusCode).toBe(201);
    expect(JSON.parse(l.body).data.ref).toBe('COR-002');
  });

  it('filters by type/direction/status + search', async () => {
    const byType = await server.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/correspondence?type=NOTICE`, headers: { cookie: adminCookie } });
    expect(JSON.parse(byType.body).data.every((c: any) => c.type === 'NOTICE')).toBe(true);

    const incoming = await server.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/correspondence?direction=INCOMING`, headers: { cookie: adminCookie } });
    expect(JSON.parse(incoming.body).data.length).toBeGreaterThanOrEqual(1);

    const search = await server.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/correspondence?q=slab`, headers: { cookie: adminCookie } });
    expect(JSON.parse(search.body).data.some((c: any) => c.id !== corrId)).toBe(true);
  });

  it('status lifecycle DRAFT→SENT→RESPONDED→FILED', async () => {
    for (const status of ['SENT', 'RESPONDED', 'FILED']) {
      const res = await server.inject({
        method: 'PATCH', url: `/api/v1/projects/${projectId}/correspondence/${corrId}`, headers: { cookie: supervisorCookie },
        payload: { status },
      });
      expect(res.statusCode).toBe(200);
    }
    const list = await server.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/correspondence?status=FILED`, headers: { cookie: adminCookie } });
    expect(JSON.parse(list.body).data.some((c: any) => c.id === corrId)).toBe(true);
  });

  it('RBAC: client can read but not create', async () => {
    const login = async (email: string) => {
      const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return res.headers['set-cookie'] as string;
    };
    const clientCookie = await login('client@apexbuilders.co.ke');
    const read = await server.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/correspondence`, headers: { cookie: clientCookie } });
    expect(read.statusCode).toBe(200);
    const write = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/correspondence`, headers: { cookie: clientCookie },
      payload: { type: 'LETTER', subject: 'Nope nope nope', fromName: 'X', toName: 'Y' },
    });
    expect(write.statusCode).toBe(403);
  });
});
