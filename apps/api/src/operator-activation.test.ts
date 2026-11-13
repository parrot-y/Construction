import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

/**
 * Auditor fix A — platform-operator activation for the first company admin.
 *
 * Production self-serve signup creates an unverified COMPANY_ADMIN and email
 * delivery is simulated, so no user above the first admin exists. The
 * operator-only endpoint (x-operator-key, OPERATOR_KEY env) activates or
 * resets that admin; every call is audit-logged.
 */
describe('Platform-operator admin activation', () => {
  const server = buildServer();
  const RUN = Date.now().toString().slice(-6);
  const OPERATOR_KEY = `op-test-${RUN}`;
  let companySlug = '';
  let adminEmail = '';
  const password = 'Operator#Pass123';

  beforeAll(async () => {
    process.env.OPERATOR_KEY = OPERATOR_KEY;
    await server.ready();
  });
  afterAll(() => {
    delete process.env.OPERATOR_KEY;
  });

  const register = async () => {
    adminEmail = `ops-admin-${RUN}@operator-e2e.test`;
    companySlug = `ops-co-${RUN}`;
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register-company',
      payload: {
        companyName: `Operator Test Co ${RUN}`,
        adminFullName: 'Ops Admin',
        email: adminEmail,
        password,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload).data;
    return body.tenant.slug;
  };

  const login = (email: string, pw: string) =>
    server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: pw } });

  it('unverified signup cannot log in; operator activates; login then succeeds', async () => {
    const slug = await register();
    companySlug = slug;

    // Production-mode reality: no verification token is returned (NODE_ENV is
    // not production in tests, so strip it defensively — the point is the
    // account stays unverified until someone verifies it).
    const blocked = await login(adminEmail, password);
    expect(blocked.statusCode).toBe(403);
    expect(JSON.parse(blocked.payload).code).toBe('ACCOUNT_NOT_VERIFIED');

    // Wrong operator key rejected.
    const badKey = await server.inject({
      method: 'POST',
      url: '/api/v1/operator/admin-account',
      headers: { 'x-operator-key': 'wrong' },
      payload: { companySlug, mode: 'activate' },
    });
    expect(badKey.statusCode).toBe(401);

    // Operator activates the first admin.
    const ok = await server.inject({
      method: 'POST',
      url: '/api/v1/operator/admin-account',
      headers: { 'x-operator-key': OPERATOR_KEY },
      payload: { companySlug, mode: 'activate' },
    });
    expect(ok.statusCode).toBe(200);
    const okBody = JSON.parse(ok.payload).data;
    expect(okBody.admin.email).toBe(adminEmail);
    expect(okBody.admin.role).toBe('COMPANY_ADMIN');

    // Audit log written.
    const tenant = await prisma.tenant.findUnique({ where: { slug: companySlug } });
    const audit = await withTenantTx(prisma, tenant!.id, (tx) =>
      tx.auditLog.findFirst({
        where: { tenant_id: tenant!.id, action: 'OPERATOR_ADMIN_ACTIVATED' },
        orderBy: { created_at: 'desc' },
      }));
    expect(audit).toBeTruthy();

    // Login now works.
    const good = await login(adminEmail, password);
    expect(good.statusCode).toBe(200);
    expect(good.headers['set-cookie']).toBeTruthy();
  });

  it('operator reset-password mode rotates the admin password', async () => {
    const newPw = 'Rotated#Pass456';
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/operator/admin-account',
      headers: { 'x-operator-key': OPERATOR_KEY },
      payload: { companySlug, mode: 'reset-password', newPassword: newPw },
    });
    expect(res.statusCode).toBe(200);

    const oldLogin = await login(adminEmail, password);
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await login(adminEmail, newPw);
    expect(newLogin.statusCode).toBe(200);

    const tenant = await prisma.tenant.findUnique({ where: { slug: companySlug } });
    const audit = await withTenantTx(prisma, tenant!.id, (tx) =>
      tx.auditLog.findFirst({
        where: { tenant_id: tenant!.id, action: 'OPERATOR_ADMIN_PASSWORD_RESET' },
        orderBy: { created_at: 'desc' },
      }));
    expect(audit).toBeTruthy();
  });

  it('endpoint is disabled when OPERATOR_KEY is unset', async () => {
    delete process.env.OPERATOR_KEY;
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/operator/admin-account',
      headers: { 'x-operator-key': 'anything' },
      payload: { companySlug, mode: 'activate' },
    });
    expect(res.statusCode).toBe(503);
    process.env.OPERATOR_KEY = OPERATOR_KEY;
  });
});
