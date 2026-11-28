import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { buildServer } from './index';
import { prisma } from '@construction/db';
import { dispatchTenantPush, pushConfig } from './lib/webPush';

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));
import webpush from 'web-push';

/**
 * P6 — web push: browser subscriptions + post-commit dispatch on inbox
 * events. SSE covers connected tabs; push covers closed/backgrounded apps.
 */
describe('P6 — web push subscriptions', () => {
  const server = buildServer();

  let adminCookie: string;
  let supervisorCookie: string;
  let tenantId: string;
  let adminUserId: string;
  const ENDPOINT = 'https://push.example.com/send/abc123def456';
  const subPayload = {
    endpoint: ENDPOINT,
    keys: { p256dh: 'BNcRd…key', auth: 'authsecret' },
  };

  beforeAll(async () => {
    await server.ready();
    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = adminRes.headers['set-cookie'] as string;
    const adminBody = JSON.parse(adminRes.body);
    tenantId = adminBody.user.tenant.id;
    adminUserId = adminBody.user.id;

    const supRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'supervisor@apexbuilders.co.ke', password: 'Password123!' },
    });
    supervisorCookie = supRes.headers['set-cookie'] as string;
  });

  afterAll(async () => {
    await server.close();
  });

  it('exposes the VAPID public key (or null when push is not configured)', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/push/vapid-key',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveProperty('publicKey');
    // publicKey is a string when VAPID_* env is set, null otherwise — both valid.
    expect(body.data.publicKey === null || typeof body.data.publicKey === 'string').toBe(true);
  });

  it('creates, lists and deletes a subscription; endpoint is write-only', async () => {
    const create = await server.inject({
      method: 'POST',
      url: '/api/v1/push-subscriptions',
      headers: { cookie: adminCookie },
      payload: subPayload,
    });
    expect(create.statusCode).toBe(201);
    const { id } = JSON.parse(create.body).data;
    expect(id).toBeTruthy();

    // Re-subscribing the same endpoint upserts, not duplicates.
    const again = await server.inject({
      method: 'POST',
      url: '/api/v1/push-subscriptions',
      headers: { cookie: adminCookie },
      payload: subPayload,
    });
    expect([200, 201]).toContain(again.statusCode);

    const list = await server.inject({
      method: 'GET',
      url: '/api/v1/push-subscriptions',
      headers: { cookie: adminCookie },
    });
    expect(list.statusCode).toBe(200);
    const rows = JSON.parse(list.body).data;
    const mine = rows.find((r: any) => r.id === id);
    expect(mine).toBeTruthy();
    // The push endpoint is a capability URL — never returned to clients.
    expect(JSON.stringify(rows)).not.toContain(ENDPOINT);

    const del = await server.inject({
      method: 'DELETE',
      url: `/api/v1/push-subscriptions/${id}`,
      headers: { cookie: adminCookie },
    });
    expect(del.statusCode).toBe(204);

    const again2 = await server.inject({
      method: 'DELETE',
      url: `/api/v1/push-subscriptions/${id}`,
      headers: { cookie: adminCookie },
    });
    expect(again2.statusCode).toBe(404);
  });

  it('rejects malformed subscriptions and isolates other users\' subs', async () => {
    const bad = await server.inject({
      method: 'POST',
      url: '/api/v1/push-subscriptions',
      headers: { cookie: adminCookie },
      payload: { endpoint: 'not-a-url', keys: { p256dh: 'x', auth: 'y' } },
    });
    expect([400, 422]).toContain(bad.statusCode);

    const create = await server.inject({
      method: 'POST',
      url: '/api/v1/push-subscriptions',
      headers: { cookie: adminCookie },
      payload: { ...subPayload, endpoint: 'https://push.example.com/send/isolated9' },
    });
    const { id } = JSON.parse(create.body).data;

    // Supervisor cannot see or delete the admin's subscription.
    const supList = await server.inject({
      method: 'GET',
      url: '/api/v1/push-subscriptions',
      headers: { cookie: supervisorCookie },
    });
    const supRows = JSON.parse(supList.body).data;
    expect(supRows.find((r: any) => r.id === id)).toBeUndefined();

    const supDel = await server.inject({
      method: 'DELETE',
      url: `/api/v1/push-subscriptions/${id}`,
      headers: { cookie: supervisorCookie },
    });
    expect(supDel.statusCode).toBe(404);
  });

  it('dispatchTenantPush sends to tenant subs except the actor and prunes dead endpoints', async () => {
    process.env.VAPID_PUBLIC_KEY = 'BTestPublicKey';
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';

    const mk = async (userId: string, endpoint: string) => {
      await prisma.pushSubscription.upsert({
        where: { tenant_id_user_id_endpoint: { tenant_id: tenantId, user_id: userId, endpoint } },
        create: { tenant_id: tenantId, user_id: userId, endpoint, p256dh: 'p', auth: 'a' },
        update: { last_seen_at: new Date() },
      });
    };
    const supUserId = JSON.parse(
      (await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'supervisor@apexbuilders.co.ke', password: 'Password123!' } })).body,
    ).user.id;

    const epAdmin = 'https://push.example.com/send/admin-live';
    const epSup = 'https://push.example.com/send/sup-live';
    const epDead = 'https://push.example.com/send/dead-410';
    await mk(adminUserId, epAdmin);
    await mk(supUserId, epSup);
    await mk(supUserId, epDead);

    const sendMock = vi.mocked(webpush.sendNotification);
    sendMock.mockReset();
    sendMock.mockImplementation(async (sub: any) => {
      if (sub.endpoint === epDead) {
        const err: any = new Error('Gone');
        err.statusCode = 410;
        throw err;
      }
      return {} as any;
    });

    await dispatchTenantPush({
      tenantId,
      excludeUserId: adminUserId,
      title: 'New message',
      body: 'Mwangi sent you a message',
      url: '/app/inbox',
      tag: 'inbox-test',
    });

    // Admin is the actor — only the supervisor's live endpoint gets a push.
    const sentEndpoints = sendMock.mock.calls.map((c) => (c[0] as any).endpoint);
    expect(sentEndpoints).toContain(epSup);
    expect(sentEndpoints).not.toContain(epAdmin);
    expect(sentEndpoints).not.toContain(epDead);

    // The 410 endpoint was pruned.
    const dead = await prisma.pushSubscription.findFirst({ where: { endpoint: epDead } });
    expect(dead).toBeNull();

    // Disabled config is a clean no-op (no throw, no sends).
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    expect(pushConfig().enabled).toBe(false);
    sendMock.mockClear();
    await dispatchTenantPush({ tenantId, title: 'x', body: 'y' });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
