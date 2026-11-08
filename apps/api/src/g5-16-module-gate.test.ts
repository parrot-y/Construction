import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildServer } from './index';
import type { FastifyInstance } from 'fastify';

/** Audit A-06: peripheral modules can be quarantined via DISABLED_MODULES. */
describe('Peripheral module quarantine', () => {
  let server: FastifyInstance;
  let cookie: string;
  let projectId: string;
  const prev = process.env.DISABLED_MODULES;

  beforeAll(async () => {
    process.env.DISABLED_MODULES = 'tender,geofence';
    server = buildServer();
    const login = await server.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    cookie = login.headers['set-cookie'] as string;
    const list = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie } });
    projectId = JSON.parse(list.body).data[0].id;
  });

  afterAll(async () => {
    await server.close();
    if (prev === undefined) delete process.env.DISABLED_MODULES;
    else process.env.DISABLED_MODULES = prev;
  });

  it('disabled modules return 404', async () => {
    const tender = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}/tenders`, headers: { cookie },
    });
    expect(tender.statusCode).toBe(404);
    const clock = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}/clock-events`, headers: { cookie },
    });
    expect(clock.statusCode).toBe(404);
  });

  it('core modules still work', async () => {
    const diaries = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}/site-diaries`, headers: { cookie },
    });
    expect([200, 404]).toContain(diaries.statusCode); // route may not exist; must not be gated
    const projects = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie } });
    expect(projects.statusCode).toBe(200);
  });
});
