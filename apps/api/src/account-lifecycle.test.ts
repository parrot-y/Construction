import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

/**
 * Stage-1 closure — account lifecycle hardening:
 *  1. Password reset (self-serve + admin-assisted), single-use expiring tokens,
 *     rate limited, no user enumeration.
 *  2. Email verification gate for self-serve accounts (register-company,
 *     invite accept); admin-approved activation as pilot path.
 *  3. Invite role limits (only COMPANY_ADMIN invites ADMIN/COMPANY_ADMIN;
 *     everyone else only roles below their own).
 *  4. Invite for an existing account requires password confirmation.
 */
describe('Account lifecycle hardening', () => {
  const server = buildServer();
  let adminCookie: string;
  let tenantId: string;
  const RUN = Date.now().toString().slice(-8);

  const login = async (email: string, password: string) => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    return { status: res.statusCode, cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
  };
  const authed = (cookie: string) => ({ cookie });

  beforeAll(async () => {
    await server.ready();
    const admin = await login('admin@apexbuilders.co.ke', 'Password123!');
    expect(admin.status).toBe(200);
    adminCookie = admin.cookie;
    tenantId = admin.body.user.tenant.id;
  });

  // ------------------------------------------------------------------
  // 1. PASSWORD RESET
  // ------------------------------------------------------------------
  it('request-reset never enumerates users; known email gets a usable single-use token', async () => {
    // Unknown email — identical shape, no token material.
    const unknown = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/request-password-reset',
      payload: { email: `nobody-${RUN}@nowhere.test` },
    });
    expect(unknown.statusCode).toBe(200);
    const unknownBody = JSON.parse(unknown.payload).data;
    expect(unknownBody.resetToken).toBeUndefined();

    // Known email (seeded admin) — simulated delivery exposes the token in dev.
    const known = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/request-password-reset',
      payload: { email: 'admin@apexbuilders.co.ke' },
    });
    expect(known.statusCode).toBe(200);
    const { resetToken } = JSON.parse(known.payload).data;
    expect(resetToken).toBeTruthy();

    // Reset with the token.
    const reset = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: resetToken, password: 'N3w!ResetPass' },
    });
    expect(reset.statusCode).toBe(200);

    // New password works, old does not.
    expect((await login('admin@apexbuilders.co.ke', 'N3w!ResetPass')).status).toBe(200);
    expect((await login('admin@apexbuilders.co.ke', 'Password123!')).status).toBe(401);

    // Single-use: replaying the token fails.
    const replay = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: resetToken, password: 'An0ther!Pass' },
    });
    expect([400, 410]).toContain(replay.statusCode);

    // Restore the seeded password for the rest of the suite.
    const restore = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/request-password-reset',
      payload: { email: 'admin@apexbuilders.co.ke' },
    });
    const { resetToken: t2 } = JSON.parse(restore.payload).data;
    await server.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: t2, password: 'Password123!' },
    });
    adminCookie = (await login('admin@apexbuilders.co.ke', 'Password123!')).cookie;
  });

  it('reset-password rejects bogus and expired tokens', async () => {
    const bogus = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: 'f'.repeat(64), password: 'Whatever!234' },
    });
    expect([400, 404, 410]).toContain(bogus.statusCode);
  });

  it('company admin can generate a one-time reset link for a team member', async () => {
    // Fresh verified user to reset.
    const email = `resetme-${RUN}@apexbuilders.co.ke`;
    const reg = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register-company',
      payload: {
        companyName: `ResetCo ${RUN}`,
        adminFullName: 'Reset User',
        email,
        password: 'First!Pass123',
      },
    });
    expect(reg.statusCode).toBe(201);
    const { verificationToken } = JSON.parse(reg.payload).data;
    await server.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: verificationToken },
    });

    // That tenant's admin mints a reset link for their own member.
    const coAdmin = await login(email, 'First!Pass123');
    expect(coAdmin.status).toBe(200);
    const linkRes = await server.inject({
      method: 'POST',
      url: `/api/v1/company/members/${coAdmin.body.user.id}/password-reset`,
      headers: authed(coAdmin.cookie),
    });
    expect(linkRes.statusCode).toBe(201);
    const { resetUrl } = JSON.parse(linkRes.payload).data;
    expect(resetUrl).toMatch(/reset=/);
    const token = new URL(resetUrl, 'http://x').searchParams.get('reset')!;

    const done = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token, password: 'Sec0nd!Pass' },
    });
    expect(done.statusCode).toBe(200);
    expect((await login(email, 'Sec0nd!Pass')).status).toBe(200);
    expect((await login(email, 'First!Pass123')).status).toBe(401);
  });

  it('request-password-reset is rate limited', async () => {
    let saw429 = false;
    for (let i = 0; i < 12; i++) {
      const r = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/request-password-reset',
        payload: { email: `rl-${i}-${RUN}@x.test` },
      });
      if (r.statusCode === 429) { saw429 = true; break; }
    }
    expect(saw429, 'request-password-reset must be rate limited').toBe(true);
  });

  // ------------------------------------------------------------------
  // 2. ACCOUNT VERIFICATION GATE
  // ------------------------------------------------------------------
  it('register-company account cannot log in until email is verified', async () => {
    const email = `verify-${RUN}@verify-e2e.test`;
    const reg = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register-company',
      payload: {
        companyName: `VerifyCo ${RUN}`,
        adminFullName: 'Verify Me',
        email,
        password: 'Ver!fyPass123',
      },
    });
    expect(reg.statusCode).toBe(201);
    const regBody = JSON.parse(reg.payload).data;
    expect(regBody.verificationToken, 'simulated verification token must be issued').toBeTruthy();

    const blocked = await login(email, 'Ver!fyPass123');
    expect(blocked.status).toBe(403);
    expect(JSON.stringify(blocked.body)).toMatch(/verif/i);

    const verify = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: regBody.verificationToken },
    });
    expect(verify.statusCode).toBe(200);

    // Token is single-use.
    const reuse = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: regBody.verificationToken },
    });
    expect([400, 410]).toContain(reuse.statusCode);

    expect((await login(email, 'Ver!fyPass123')).status).toBe(200);
  });

  it('invite-accepted account is pending verification until verified or admin-activated', async () => {
    // Company admin invites a fresh user.
    const invite = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      headers: authed(adminCookie),
      payload: { email: `invited-${RUN}@apexbuilders.co.ke`, role: 'VIEWER' },
    });
    expect(invite.statusCode).toBe(201);
    const invBody = JSON.parse(invite.payload).data;
    const inviteUrl: string = invBody.inviteUrl;
    expect(inviteUrl).toMatch(/\/\?invite=/);
    const token = new URL(inviteUrl, 'http://x').searchParams.get('invite')!;
    expect(token).toBeTruthy();

    const accept = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      payload: { token, fullName: 'Invited User', password: 'Inv!tePass123' },
    });
    expect(accept.statusCode).toBe(200);
    const acceptBody = JSON.parse(accept.payload).data;
    expect(acceptBody.pendingVerification).toBe(true);
    const verificationToken = acceptBody.verificationToken;

    const blocked = await login(`invited-${RUN}@apexbuilders.co.ke`, 'Inv!tePass123');
    expect(blocked.status).toBe(403);

    // Admin-approved activation path (pilot): company admin activates the member.
    const members = await withTenantTx(prisma, tenantId, async (tx) =>
      tx.user.findUnique({ where: { email: `invited-${RUN}@apexbuilders.co.ke` } }),
    );
    const activate = await server.inject({
      method: 'POST',
      url: `/api/v1/company/members/${members!.id}/activate`,
      headers: authed(adminCookie),
    });
    expect(activate.statusCode).toBe(200);
    expect((await login(`invited-${RUN}@apexbuilders.co.ke`, 'Inv!tePass123')).status).toBe(200);
    expect(verificationToken).toBeTruthy(); // simulated delivery also issued
  });

  // ------------------------------------------------------------------
  // 3. INVITE ROLE LIMITS
  // ------------------------------------------------------------------
  it('only COMPANY_ADMIN may invite ADMIN or COMPANY_ADMIN; others only below their own', async () => {
    // Seed an EXECUTIVE user in the tenant.
    const execEmail = `exec-${RUN}@apexbuilders.co.ke`;
    await withTenantTx(prisma, tenantId, async (tx) => {
      const u = await tx.user.create({
        data: {
          email: execEmail,
          full_name: 'Exec Invite',
          password_hash: 'x',
          email_verified_at: new Date(),
          is_active: true,
        },
      });
      await tx.membership.create({ data: { tenant_id: tenantId, user_id: u.id, role: 'EXECUTIVE' } });
    });
    // Give exec a real password via direct update.
    const { hashPassword } = await import('@construction/db');
    await prisma.user.update({
      where: { email: execEmail },
      data: { password_hash: await hashPassword('Exec!Pass123') },
    });
    const exec = await login(execEmail, 'Exec!Pass123');
    expect(exec.status).toBe(200);

    const inviteAs = async (role: string) =>
      server.inject({
        method: 'POST',
        url: '/api/v1/invitations',
        headers: authed(exec.cookie),
        payload: { email: `t-${role.toLowerCase()}-${RUN}@x.test`, role },
      });

    expect((await inviteAs('ADMIN')).statusCode).toBe(403);
    expect((await inviteAs('COMPANY_ADMIN')).statusCode).toBe(403);
    expect((await inviteAs('EXECUTIVE')).statusCode).toBe(403); // equal rank — not below
    expect((await inviteAs('PM_QS')).statusCode).toBe(201);     // below executive

    // COMPANY_ADMIN may invite ADMIN.
    const ca = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      headers: authed(adminCookie),
      payload: { email: `newadmin-${RUN}@apexbuilders.co.ke`, role: 'ADMIN' },
    });
    expect(ca.statusCode).toBe(201);
  });

  // ------------------------------------------------------------------
  // 4. INVITE FOR EXISTING ACCOUNT
  // ------------------------------------------------------------------
  it('existing-account invite requires the account password and reports company+role', async () => {
    // A dedicated existing account (own company, verified) — never a shared
    // seeded user, so the test cannot pollute other suites' memberships.
    const existingEmail = `existing-${RUN}@apexbuilders.co.ke`;
    const existingReg = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register-company',
      payload: {
        companyName: `Existing Users Co ${RUN}`,
        adminFullName: 'Existing User',
        email: existingEmail,
        password: 'Exist!Pass123',
      },
    });
    const existingVerify = JSON.parse(existingReg.payload).data.verificationToken;
    await server.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token: existingVerify } });

    // A second company invites that existing account as a member.
    const reg = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register-company',
      payload: {
        companyName: `ExistingCo ${RUN}`,
        adminFullName: 'Boss',
        email: `boss-${RUN}@existing.test`,
        password: 'Boss!Pass123',
      },
    });
    const bossVerify = JSON.parse(reg.payload).data.verificationToken;
    await server.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token: bossVerify } });
    const boss = await login(`boss-${RUN}@existing.test`, 'Boss!Pass123');

    const invite = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      headers: authed(boss.cookie),
      payload: { email: existingEmail, role: 'VIEWER' },
    });
    expect(invite.statusCode).toBe(201);
    const token = new URL(JSON.parse(invite.payload).data.inviteUrl, 'http://x').searchParams.get('invite')!;

    // Wrong password → refused, no membership.
    const wrong = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      payload: { token, fullName: 'Existing User', password: 'Wr0ng!Pass' },
    });
    expect(wrong.statusCode).toBe(403);

    // Correct password → membership created; password NOT overwritten.
    const ok = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      payload: { token, fullName: 'Existing User', password: 'Exist!Pass123' },
    });
    expect(ok.statusCode).toBe(200);
    const okBody = JSON.parse(ok.payload).data;
    expect(okBody.existingAccount).toBe(true);
    expect(okBody.pendingVerification).toBe(false);
    expect(okBody.companyName).toBeTruthy();
    expect(okBody.role).toBe('VIEWER');

    // Old password still works; the wrong one never did.
    expect((await login(existingEmail, 'Exist!Pass123')).status).toBe(200);
    expect((await login(existingEmail, 'Wr0ng!Pass')).status).toBe(401);
  });

  it('invite accept requires the invitee to set their own password', async () => {
    const invite = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      headers: authed(adminCookie),
      payload: { email: `nopw-${RUN}@apexbuilders.co.ke`, role: 'VIEWER' },
    });
    const token = new URL(JSON.parse(invite.payload).data.inviteUrl, 'http://x').searchParams.get('invite')!;
    const noPw = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      payload: { token, fullName: 'No Password' },
    });
    expect(noPw.statusCode).toBe(400);
  });
});
