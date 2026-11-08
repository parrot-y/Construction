import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

/**
 * Drawing markup annotations — pins on drawing sheets with resolve workflow.
 */
describe('Drawing annotations (markup)', () => {
  const server = buildServer();
  let adminCookie: string;
  let projectId: string;
  let docId: string;
  let annId: string;

  beforeAll(async () => {
    await server.ready();
    const login = async (email: string) => {
      const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return res.headers['set-cookie'] as string;
    };
    adminCookie = await login('admin@apexbuilders.co.ke');
    const projects = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie: adminCookie } });
    projectId = JSON.parse(projects.body).data[0].id;
  });

  it('registers a drawing document', async () => {
    const res = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/documents`, headers: { cookie: adminCookie },
      payload: { title: 'Ground floor layout Rev A', category: 'ARCHITECTURAL_DRAWING', drawingReference: 'A-101', revisionCode: 'Rev A', storageKey: 'drawings/test.png', uploadedByName: 'Test' },
    });
    expect(res.statusCode).toBe(201);
    docId = JSON.parse(res.body).id;
  });

  it('adds, lists and resolves an annotation', async () => {
    const bad = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/documents/${docId}/annotations`, headers: { cookie: adminCookie },
      payload: { xPct: 150, yPct: 10, note: 'out of bounds' },
    });
    expect(bad.statusCode).toBe(400);

    const res = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/documents/${docId}/annotations`, headers: { cookie: adminCookie },
      payload: { xPct: 42.5, yPct: 67.25, note: 'Door swing clashes with column C4' },
    });
    expect(res.statusCode).toBe(201);
    annId = JSON.parse(res.body).id;

    const list = await server.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/documents/${docId}/annotations`, headers: { cookie: adminCookie } });
    const anns = JSON.parse(list.body).data;
    expect(anns).toHaveLength(1);
    expect(Number(anns[0].x_pct)).toBeCloseTo(42.5);
    expect(anns[0].resolved).toBe(false);

    const patch = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}/documents/${docId}/annotations/${annId}`, headers: { cookie: adminCookie },
      payload: { resolved: true },
    });
    expect(patch.statusCode).toBe(200);
    expect(JSON.parse(patch.body).resolved).toBe(true);
  });
});
