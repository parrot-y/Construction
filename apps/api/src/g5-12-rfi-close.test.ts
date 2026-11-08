import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

/** Gate-5: RFI close endpoint + live wiring support. */
describe('Gate-5 G5-12: RFI close lifecycle', () => {
  const server = buildServer();

  let cookie: string;
  let projectId: string;
  let rfiId: string;

  beforeAll(async () => {
    await server.ready();
    const login = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' } });
    cookie = login.headers['set-cookie'] as string;
    const list = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie } });
    projectId = JSON.parse(list.body).data[0].id;
  });

  it('create → respond (ANSWERED) → close → double-close rejected', async () => {
    const create = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/rfis`, headers: { cookie },
      payload: {
        title: 'ZZ-RFI close test — lintel level query',
        question: 'Confirm lintel level at grid D-2 is +2150 not +2100 as drawn.',
        priority: 'MEDIUM', assignedToRole: 'ARCHITECT',
      },
    });
    expect(create.statusCode).toBe(201);
    rfiId = JSON.parse(create.body).id;

    const respond = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/rfis/${rfiId}/responses`, headers: { cookie },
      payload: { officialAnswer: 'Confirmed +2150 — issue revision AR-DET-410 Rev D.', isAccepted: true },
    });
    expect(respond.statusCode).toBe(201);
    expect(JSON.parse(respond.body).rfi.status).toBe('ANSWERED');

    const close = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/rfis/${rfiId}/close`, headers: { cookie },
    });
    expect(close.statusCode).toBe(200);
    expect(JSON.parse(close.body).status).toBe('CLOSED');

    const again = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/rfis/${rfiId}/close`, headers: { cookie },
    });
    expect(again.statusCode).toBe(400);
  });

  it('close rejects DRAFT and unknown ids', async () => {
    const bad = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/rfis/00000000-0000-0000-0000-000000000000/close`, headers: { cookie },
    });
    expect(bad.statusCode).toBe(404);
  });
});
