import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

/**
 * Client portal "Request a project" flow + profile self-service.
 */
describe('Client project requests & profile', () => {
  const server = buildServer();
  let clientCookie: string;
  let adminCookie: string;

  const PROJECT_TYPES = 'New house / bungalow';

  beforeAll(async () => {
    await server.ready();
    const login = async (email: string) => {
      const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return res.headers['set-cookie'] as string;
    };
    clientCookie = await login('client@apexbuilders.co.ke');
    adminCookie = await login('admin@apexbuilders.co.ke');
  });

  it('client submits a project request and sees it in their list', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/client/project-requests', headers: { cookie: clientCookie },
      payload: {
        projectType: PROJECT_TYPES,
        locationText: 'Kilimani, Nairobi',
        budgetRange: 'KES 5M - 20M',
        startTimeframe: 'Within 3 months',
        description: '4-bedroom maisonette, modern finishes, borehole needed.',
        contactPhone: '+254700000001',
      },
    });
    expect(res.statusCode).toBe(201);
    const created = JSON.parse(res.body).data;
    expect(created.status).toBe('NEW');
    expect(created.project_type).toBe(PROJECT_TYPES);

    const list = await server.inject({ method: 'GET', url: '/api/v1/client/project-requests', headers: { cookie: clientCookie } });
    expect(list.statusCode).toBe(200);
    const rows = JSON.parse(list.body).data;
    expect(rows.some((r: any) => r.id === created.id)).toBe(true);
  });

  it('rejects invalid project type and missing fields', async () => {
    const bad = await server.inject({
      method: 'POST', url: '/api/v1/client/project-requests', headers: { cookie: clientCookie },
      payload: { projectType: 'Castle', locationText: 'X', description: 'Y' },
    });
    expect(bad.statusCode).toBe(400);

    const empty = await server.inject({
      method: 'POST', url: '/api/v1/client/project-requests', headers: { cookie: clientCookie },
      payload: { projectType: PROJECT_TYPES, locationText: '', description: 'Y' },
    });
    expect(empty.statusCode).toBe(400);
  });

  it('non-client roles cannot submit project requests', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/client/project-requests', headers: { cookie: adminCookie },
      payload: { projectType: PROJECT_TYPES, locationText: 'Nakuru', description: 'Test' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin sees tenant-wide request list', async () => {
    const list = await server.inject({ method: 'GET', url: '/api/v1/client/project-requests', headers: { cookie: adminCookie } });
    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.body).data.length).toBeGreaterThan(0);
  });

  it('PATCH /auth/me updates profile fields', async () => {
    const res = await server.inject({
      method: 'PATCH', url: '/api/v1/auth/me', headers: { cookie: clientCookie },
      payload: { fullName: 'Brenda Njeri', phoneNumber: '+254711222333', country: 'Kenya' },
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body).data;
    expect(data.fullName).toBe('Brenda Njeri');
    expect(data.country).toBe('Kenya');

    const me = await server.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: clientCookie } });
    expect(JSON.parse(me.body).user.phoneNumber).toBe('+254711222333');
  });
});
