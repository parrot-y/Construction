import { describe, expect, it } from 'vitest';
import { buildServer } from './index';

describe('Fastify Authentication & Session Suite (Milestone M1)', () => {
  const server = buildServer();

  it('rejects login with invalid email or malformed payload', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'not-an-email',
        password: 'short',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Bad Request');
  });

  it('rejects login with non-existent user credentials', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'ghost@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.message).toBe('Invalid email or password');
  });

  it('rejects login with incorrect password', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexbuilders.co.ke',
        password: 'WrongPassword999!',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.message).toBe('Invalid email or password');
  });

  it('successfully logs in with valid company admin credentials and sets auth cookie', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    expect(body.user.email).toBe('admin@apexbuilders.co.ke');
    expect(body.user.fullName).toBe('Mwangi Karanja');
    expect(body.user.role).toBe('COMPANY_ADMIN');
    expect(body.user.tenant.name).toBe('Apex Builders Kenya Ltd');
    expect(body.user.tenant.slug).toBe('apex-builders');
    expect(body.permissions).toContain('project.create');
    expect(body.permissions).toContain('cost.approve');
    expect(body.token).toBeDefined();

    // Verify Set-Cookie header contains access_token
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(String(setCookie)).toContain('access_token=');
    expect(String(setCookie)).toContain('HttpOnly');
  });

  it('rejects unauthenticated access to GET /api/v1/auth/me', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });

    expect(res.statusCode).toBe(401);
  });

  it('allows authenticated access to GET /api/v1/auth/me with Bearer token', async () => {
    // 1. Log in to get token
    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'qs@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const { token } = JSON.parse(loginRes.payload);

    // 2. Fetch /me using Bearer token
    const meRes = await server.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(meRes.statusCode).toBe(200);
    const meBody = JSON.parse(meRes.payload);
    expect(meBody.user.email).toBe('qs@apexbuilders.co.ke');
    expect(meBody.user.role).toBe('PM_QS');
    expect(meBody.permissions).toContain('boq.import');
    expect(meBody.permissions).toContain('cost.approve');
    expect(meBody.permissions).not.toContain('company.manage');
  });

  it('allows authenticated access to GET /api/v1/auth/me via HTTP cookie', async () => {
    // 1. Log in to get cookie
    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'supervisor@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const cookies = loginRes.cookies;
    const accessToken = cookies.find((c) => c.name === 'access_token')?.value;
    expect(accessToken).toBeDefined();

    // 2. Fetch /me using cookie
    const meRes = await server.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      cookies: {
        access_token: accessToken!,
      },
    });

    expect(meRes.statusCode).toBe(200);
    const meBody = JSON.parse(meRes.payload);
    expect(meBody.user.email).toBe('supervisor@apexbuilders.co.ke');
    expect(meBody.user.role).toBe('SITE_SUPERVISOR');
    expect(meBody.permissions).toContain('site.diary_create');
    expect(meBody.permissions).not.toContain('cost.approve');
  });

  it('clears access_token cookie on POST /api/v1/auth/logout', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);

    const setCookie = res.headers['set-cookie'];
    expect(String(setCookie)).toContain('access_token=;');
  });
});
