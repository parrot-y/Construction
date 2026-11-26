import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

describe('P5.6 — entity comments and @mentions', () => {
  const server = buildServer();

  let adminCookie: string;
  let supervisorCookie: string;
  let projectId: string;
  let rfiId: string;
  let supervisorUserId: string;

  beforeAll(async () => {
    await server.ready();

    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = adminRes.headers['set-cookie'] as string;

    const supRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'supervisor@apexbuilders.co.ke', password: 'Password123!' },
    });
    supervisorCookie = supRes.headers['set-cookie'] as string;
    supervisorUserId = JSON.parse(supRes.body).user.id;

    const projRes = await server.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { cookie: adminCookie },
    });
    projectId = JSON.parse(projRes.body).data[0].id;

    const rfiRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/rfis`,
      headers: { cookie: adminCookie },
      payload: {
        title: `Comments test RFI ${Date.now()}`,
        question: 'Confirm the revised reinforcement detail for level 2.',
        assignedToRole: 'Structural Eng',
        priority: 'MEDIUM',
      },
    });
    expect(rfiRes.statusCode).toBeLessThan(300);
    rfiId = JSON.parse(rfiRes.body).id || JSON.parse(rfiRes.body).data?.id;
  });

  it('posts a comment and resolves an @mention to a direct inbox message', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/comments?entityType=RFI&entityId=${rfiId}`,
      headers: { cookie: adminCookie },
      payload: { body: '@supervisor please confirm the bar spacing before Friday pour.' },
    });
    expect(res.statusCode).toBe(201);
    const comment = JSON.parse(res.body).data;
    expect(comment.entityType).toBe('RFI');
    expect(comment.authorName).toBeTruthy();
    expect(comment.mentions).toContain(supervisorUserId);
    expect(comment.notifiedCount).toBe(1);

    // The mentioned user receives a direct inbox message (recipient-scoped).
    const inbox = await server.inject({
      method: 'GET',
      url: '/api/v1/inbox',
      headers: { cookie: supervisorCookie },
    });
    expect(inbox.statusCode).toBe(200);
    const msgs = JSON.parse(inbox.body).data;
    const mention = msgs.find((m: any) => m.recipient_id === supervisorUserId && m.body.includes('mentioned you'));
    expect(mention, 'mention did not reach the supervisor inbox').toBeTruthy();
    expect(mention.body).toContain('RFI');
  });

  it('lists comments oldest-first for the entity', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/comments?entityType=RFI&entityId=${rfiId}`,
      headers: { cookie: supervisorCookie },
    });
    expect(res.statusCode).toBe(200);
    const comments = JSON.parse(res.body).data;
    expect(comments.length).toBeGreaterThanOrEqual(1);
    expect(comments[0].body).toContain('@supervisor');
    // A non-author member can read the thread.
    expect(comments[0].authorName).toBeTruthy();
  });

  it('unknown mention tokens notify nobody', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/comments?entityType=RFI&entityId=${rfiId}`,
      headers: { cookie: adminCookie },
      payload: { body: '@ghostperson999 is this resolved?' },
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).data.notifiedCount).toBe(0);
    expect(JSON.parse(res.body).data.mentions).toEqual([]);
  });

  it('rejects bad entity types, missing entities and unauthenticated reads', async () => {
    const badType = await server.inject({
      method: 'GET',
      url: `/api/v1/comments?entityType=USERS&entityId=${rfiId}`,
      headers: { cookie: adminCookie },
    });
    expect(badType.statusCode).toBe(400);

    const missing = await server.inject({
      method: 'GET',
      url: `/api/v1/comments?entityType=RFI&entityId=00000000-0000-0000-0000-000000000000`,
      headers: { cookie: adminCookie },
    });
    expect(missing.statusCode).toBe(404);

    const anon = await server.inject({
      method: 'GET',
      url: `/api/v1/comments?entityType=RFI&entityId=${rfiId}`,
    });
    expect(anon.statusCode).toBe(401);
  });
});
