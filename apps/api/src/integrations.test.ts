import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

/** Integration provider layer: status endpoint, test dispatch, honest SIMULATED. */
describe('Integrations: provider status & dispatch', () => {
  const server = buildServer();
  let adminCookie: string;

  beforeAll(async () => {
    await server.ready();
    const login = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' } });
    adminCookie = login.headers['set-cookie'] as string;
  });

  it('GET /integrations/status returns providers without secrets', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/integrations/status', headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.integrations)).toBe(true);
    const providers = body.integrations.map((i: any) => i.provider);
    expect(providers.some((p: string) => p.includes('WhatsApp'))).toBe(true);
    expect(providers.some((p: string) => p.includes("Africa's Talking"))).toBe(true);
    expect(providers.some((p: string) => p.includes('Resend'))).toBe(true);
    // no secrets leak
    expect(res.body).not.toContain('AT_API_KEY=');
    for (const i of body.integrations) {
      expect(i).not.toHaveProperty('apiKey');
      expect(i).not.toHaveProperty('token');
    }
  });

  it('POST /integrations/test simulates when unconfigured', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/integrations/test', headers: { cookie: adminCookie },
      payload: { channel: 'SMS', to: '+254712345678' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // In CI no AT creds → simulated:true; if creds ever exist → ok:true simulated:false
    expect(body.ok).toBe(true);
    expect(typeof body.simulated).toBe('boolean');
  });

  it('rejects invalid channel', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/integrations/test', headers: { cookie: adminCookie },
      payload: { channel: 'PIGEON', to: 'x' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('requires auth', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/integrations/status' });
    expect(res.statusCode).toBe(401);
  });
});
