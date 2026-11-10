import { describe, expect, it } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

const RUN = Date.now().toString(36);

describe('Company onboarding — POST /api/v1/auth/register-company', () => {
  const server = buildServer();

  it('rejects malformed payloads', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register-company',
      payload: { companyName: 'X', adminFullName: 'A', email: 'bad', password: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('creates tenant + first COMPANY_ADMIN + membership in one flow; user can log in and sees an empty console', async () => {
    const email = `founder-${RUN}@newbuild.co.ke`;
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register-company',
      payload: {
        companyName: `NewBuild Contractors ${RUN}`,
        adminFullName: 'Jane Wanjiru',
        email,
        phone: '0712345678',
        password: 'Str0ng!Pass',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.data.tenant.slug).toMatch(/^newbuild-contractors-/);
    expect(body.data.user.email).toBe(email);
    expect(body.data.user.role).toBe('COMPANY_ADMIN');

    // Tenant, user and membership all exist
    const tenant = await prisma.tenant.findUnique({ where: { slug: body.data.tenant.slug } });
    expect(tenant).not.toBeNull();
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    const membership = await withTenantTx(prisma, tenant!.id, (tx) =>
      tx.membership.findFirst({
        where: { tenant_id: tenant!.id, user_id: user!.id },
      }),
    );
    expect(membership?.role).toBe('COMPANY_ADMIN');

    // Audit log recorded
    const audit = await withTenantTx(prisma, tenant!.id, (tx) =>
      tx.auditLog.findFirst({
        where: { tenant_id: tenant!.id, action: 'COMPANY_REGISTERED' },
      }),
    );
    expect(audit).not.toBeNull();

    // Account starts unverified — login is gated until verification.
    expect((user as any).email_verified_at).toBeNull();
    const blockedLogin = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'Str0ng!Pass' },
    });
    expect(blockedLogin.statusCode).toBe(403);

    // Simulated delivery returns the verification token; consume it once.
    const verificationToken = body.data.verificationToken;
    expect(verificationToken).toBeTruthy();
    const verify = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: verificationToken },
    });
    expect(verify.statusCode).toBe(200);

    // New admin can now log in through the normal flow
    const login = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'Str0ng!Pass' },
    });
    expect(login.statusCode).toBe(200);
    const loginBody = JSON.parse(login.payload);
    expect(loginBody.user.tenant.id).toBe(tenant!.id);
    expect(loginBody.user.role).toBe('COMPANY_ADMIN');

    // Empty console: dashboard returns real empty data, not fabricated
    const dash = await server.inject({
      method: 'GET',
      url: '/api/v1/dashboard',
      headers: { authorization: `Bearer ${loginBody.token}` },
    });
    expect(dash.statusCode).toBe(200);
    const dashBody = JSON.parse(dash.payload);
    expect(JSON.stringify(dashBody)).not.toContain('45000000');
  });

  it('rejects duplicate email with 409', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register-company',
      payload: {
        companyName: 'Duplicate Co',
        adminFullName: 'Dup User',
        email: 'admin@apexbuilders.co.ke',
        password: 'Str0ng!Pass',
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it('generates unique slugs for same-name companies', async () => {
    const mk = (n: number) => server.inject({
      method: 'POST',
      url: '/api/v1/auth/register-company',
      payload: {
        companyName: `Same Name Builders ${RUN}`,
        adminFullName: `Admin ${n}`,
        email: `same-${RUN}-${n}@example.co.ke`,
        password: 'Str0ng!Pass',
      },
    });
    const r1 = await mk(1);
    const r2 = await mk(2);
    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    const s1 = JSON.parse(r1.payload).data.tenant.slug;
    const s2 = JSON.parse(r2.payload).data.tenant.slug;
    expect(s1).not.toBe(s2);
  });
});
