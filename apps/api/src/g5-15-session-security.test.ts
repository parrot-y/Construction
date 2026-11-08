import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildServer } from './index';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@construction/db';

/**
 * Audit S-01/S-02: short-lived access + refresh rotation, per-request
 * is_active/membership enforcement, login rate limiting.
 */
describe('Session security', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = buildServer();
  });
  afterAll(async () => {
    await server.close();
  });

  const login = () =>
    server.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });

  it('login issues short-lived access + refresh cookies', async () => {
    const res = await login();
    expect(res.statusCode).toBe(200);
    const cookies = res.cookies;
    const access = cookies.find((c) => c.name === 'access_token');
    const refresh = cookies.find((c) => c.name === 'refresh_token');
    expect(access).toBeTruthy();
    expect(refresh).toBeTruthy();
    expect(refresh?.path).toBe('/api/v1/auth');
    // access token expires in ~15m, refresh ~7d — decode payload exp
    const payload = JSON.parse(Buffer.from(access!.value.split('.')[1]!, 'base64url').toString());
    const refreshPayload = JSON.parse(Buffer.from(refresh!.value.split('.')[1]!, 'base64url').toString());
    expect(payload.typ).toBe('access');
    expect(refreshPayload.typ).toBe('refresh');
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(16 * 60);
  });

  it('refresh rotates the pair and authenticated calls keep working', async () => {
    const res = await login();
    const refresh = res.cookies.find((c) => c.name === 'refresh_token');
    const access = res.cookies.find((c) => c.name === 'access_token');
    expect(access).toBeTruthy();

    const me = await server.inject({
      method: 'GET', url: '/api/v1/auth/me',
      headers: { cookie: `access_token=${access!.value}` },
    });
    expect(me.statusCode).toBe(200);

    const refreshed = await server.inject({
      method: 'POST', url: '/api/v1/auth/refresh',
      headers: { cookie: `refresh_token=${refresh!.value}` },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.cookies.find((c) => c.name === 'access_token')).toBeTruthy();
    expect(refreshed.cookies.find((c) => c.name === 'refresh_token')).toBeTruthy();
  });

  it('detects refresh-token reuse and revokes the family', async () => {
    const res = await login();
    const refresh = res.cookies.find((c) => c.name === 'refresh_token');
    const first = await server.inject({
      method: 'POST', url: '/api/v1/auth/refresh',
      headers: { cookie: `refresh_token=${refresh!.value}` },
    });
    expect(first.statusCode).toBe(200);

    // Replaying the consumed refresh token must fail and revoke the family.
    const replay = await server.inject({
      method: 'POST', url: '/api/v1/auth/refresh',
      headers: { cookie: `refresh_token=${refresh!.value}` },
    });
    expect(replay.statusCode).toBe(401);

    // The rotated refresh token issued by `first` is also dead now.
    const rotated = first.cookies.find((c) => c.name === 'refresh_token');
    const reuseRotated = await server.inject({
      method: 'POST', url: '/api/v1/auth/refresh',
      headers: { cookie: `refresh_token=${rotated!.value}` },
    });
    expect(reuseRotated.statusCode).toBe(401);
  });

  it('rejects refresh tokens used as access tokens', async () => {
    const res = await login();
    const refresh = res.cookies.find((c) => c.name === 'refresh_token');
    const me = await server.inject({
      method: 'GET', url: '/api/v1/auth/me',
      headers: { cookie: `access_token=${refresh!.value}` },
    });
    expect(me.statusCode).toBe(401);
  });

  it('revokes access immediately when the user is deactivated', async () => {
    const res = await login();
    const access = res.cookies.find((c) => c.name === 'access_token');
    const userId = JSON.parse(res.body).user.id;

    await prisma.user.update({ where: { id: userId }, data: { is_active: false } });
    try {
      const me = await server.inject({
        method: 'GET', url: '/api/v1/auth/me',
        headers: { cookie: `access_token=${access!.value}` },
      });
      expect(me.statusCode).toBe(401);
    } finally {
      await prisma.user.update({ where: { id: userId }, data: { is_active: true } });
    }
  });
});
