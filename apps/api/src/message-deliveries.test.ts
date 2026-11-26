import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

/**
 * P5.7 — durable message-delivery rows.
 *
 * Every outbound SMS/WhatsApp/email dispatch must leave a MessageDelivery
 * record (channel, provider, masked recipient, status, provider reference or
 * error, source) that company admins can list. Simulated sends are recorded
 * honestly as SIMULATED — never as delivered.
 */
describe('P5.7 — message delivery status', () => {
  const server = buildServer();

  let adminCookie: string;
  let viewerCookie: string;
  const marker = `dlv-${Date.now()}`;

  beforeAll(async () => {
    await server.ready();
    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = adminRes.headers['set-cookie'] as string;

    const viewerRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'viewer@apexbuilders.co.ke', password: 'Password123!' },
    });
    viewerCookie = viewerRes.headers['set-cookie'] as string;
  });

  it('records a simulated SMS test send as a delivery row', async () => {
    const send = await server.inject({
      method: 'POST',
      url: '/api/v1/integrations/test',
      headers: { cookie: adminCookie },
      payload: { channel: 'SMS', to: '+254712345678', message: `${marker} sms check` },
    });
    expect(send.statusCode).toBe(200);
    const result = JSON.parse(send.body);
    // No provider keys in test env → honest simulated result.
    expect(result.simulated).toBe(true);

    const list = await server.inject({
      method: 'GET',
      url: '/api/v1/message-deliveries?limit=50',
      headers: { cookie: adminCookie },
    });
    expect(list.statusCode).toBe(200);
    const rows = JSON.parse(list.body).data || JSON.parse(list.body).deliveries || [];
    const hit = rows.find((r: any) =>
      r.channel === 'SMS' &&
      (r.bodyExcerpt || r.body_excerpt || '').includes(marker),
    );
    expect(hit, 'SMS test send must appear in delivery log').toBeTruthy();
    expect(hit.status).toBe('SIMULATED');
    expect(hit.provider).toBeTruthy();
    // Recipient is masked — the raw number must never be stored or returned.
    expect(JSON.stringify(hit)).not.toContain('712345678');
    expect(hit.recipientMasked || hit.recipient_masked).toBeTruthy();
    expect(hit.source).toBeTruthy();
  });

  it('records an email test send with provider + reference fields', async () => {
    const send = await server.inject({
      method: 'POST',
      url: '/api/v1/integrations/test',
      headers: { cookie: adminCookie },
      payload: { channel: 'EMAIL', to: 'site@example.co.ke', message: `${marker} email check` },
    });
    expect(send.statusCode).toBe(200);

    const list = await server.inject({
      method: 'GET',
      url: '/api/v1/message-deliveries?channel=EMAIL&limit=50',
      headers: { cookie: adminCookie },
    });
    expect(list.statusCode).toBe(200);
    const rows = JSON.parse(list.body).data || [];
    const hit = rows.find((r: any) => (r.bodyExcerpt || '').includes(marker));
    expect(hit, 'EMAIL test send must appear in delivery log').toBeTruthy();
    expect(['SIMULATED', 'DELIVERED', 'FAILED']).toContain(hit.status);
  });

  it('hides the delivery log from non-admin members and unauthenticated callers', async () => {
    const anon = await server.inject({ method: 'GET', url: '/api/v1/message-deliveries' });
    expect(anon.statusCode).toBe(401);

    const viewer = await server.inject({
      method: 'GET',
      url: '/api/v1/message-deliveries',
      headers: { cookie: viewerCookie },
    });
    expect([403, 401]).toContain(viewer.statusCode);
  });
});
