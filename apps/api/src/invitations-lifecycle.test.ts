import { describe, expect, it } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

const RUN = Date.now().toString(36);

async function adminToken(server: any): Promise<string> {
  const res = await server.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
  });
  expect(res.statusCode).toBe(200);
  return JSON.parse(res.payload).token;
}

async function tenantIdOf(server: any, token: string): Promise<string> {
  const res = await server.inject({
    method: 'GET',
    url: '/api/v1/company',
    headers: { authorization: `Bearer ${token}` },
  });
  return JSON.parse(res.payload).data.id ?? JSON.parse(res.payload).data.tenant?.id;
}

describe('Invitation lifecycle — lookup, accept, admin management', () => {
  const server = buildServer();

  it('GET /invitations/lookup/:token returns company, role and invited email for a pending invite', async () => {
    const token = await adminToken(server);
    const email = `lookup-${RUN}@example.co.ke`;
    const inv = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      headers: { authorization: `Bearer ${token}` },
      payload: { email, role: 'SITE_ENGINEER' },
    });
    expect(inv.statusCode).toBe(201);
    const inviteToken = JSON.parse(inv.payload).data.token;

    const res = await server.inject({ method: 'GET', url: `/api/v1/invitations/lookup/${inviteToken}` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.email).toBe(email);
    expect(body.data.role).toBe('SITE_ENGINEER');
    expect(body.data.companyName).toBe('Apex Builders Kenya Ltd');
    expect(body.data.status).toBe('PENDING');
  });

  it('lookup returns a deterministic error for unknown tokens', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/invitations/lookup/${'a'.repeat(64)}`,
    });
    expect([400, 404]).toContain(res.statusCode);
  });

  it('accept rejects a mismatched email (wrong-email token)', async () => {
    const token = await adminToken(server);
    const inv = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: `right-${RUN}@example.co.ke`, role: 'PM_QS' },
    });
    const inviteToken = JSON.parse(inv.payload).data.token;

    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      payload: {
        token: inviteToken,
        email: 'attacker@other-domain.co.ke',
        fullName: 'Wrong Person',
        password: 'Str0ng!Pass',
      },
    });
    expect([400, 403]).toContain(res.statusCode);
  });

  it('accept succeeds with matching email and the invitee can log in', async () => {
    const token = await adminToken(server);
    const email = `accept-${RUN}@example.co.ke`;
    const inv = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      headers: { authorization: `Bearer ${token}` },
      payload: { email, role: 'SITE_SUPERVISOR' },
    });
    const inviteToken = JSON.parse(inv.payload).data.token;

    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      payload: { token: inviteToken, email, fullName: 'Accepted User', password: 'Str0ng!Pass' },
    });
    expect(res.statusCode).toBe(200);

    const login = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'Str0ng!Pass' },
    });
    expect(login.statusCode).toBe(200);
    expect(JSON.parse(login.payload).user.role).toBe('SITE_SUPERVISOR');
  });

  it('admin list returns pending, accepted and revoked invites', async () => {
    const token = await adminToken(server);
    const mk = async (tag: string) => {
      const r = await server.inject({
        method: 'POST',
        url: '/api/v1/invitations',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: `list-${tag}-${RUN}@example.co.ke`, role: 'CLIENT' },
      });
      return JSON.parse(r.payload).data;
    };
    const pending = await mk('pending');
    const toRevoke = await mk('revoke');
    const toAccept = await mk('accept');

    await server.inject({
      method: 'POST',
      url: `/api/v1/invitations/${toRevoke.id}/revoke`,
      headers: { authorization: `Bearer ${token}` },
    });
    await server.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      payload: {
        token: toAccept.token,
        email: `list-accept-${RUN}@example.co.ke`,
        fullName: 'List Acceptor',
        password: 'Str0ng!Pass',
      },
    });

    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/invitations',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const invites = JSON.parse(res.payload).data as any[];
    const byId = new Map(invites.map((i) => [i.id, i.status]));
    expect(byId.get(pending.id)).toBe('PENDING');
    expect(byId.get(toRevoke.id)).toBe('REVOKED');
    expect(byId.get(toAccept.id)).toBe('ACCEPTED');
  });

  it('revoke blocks acceptance; regenerate issues a working new token and kills the old one', async () => {
    const token = await adminToken(server);
    const inv = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: `regen-${RUN}@example.co.ke`, role: 'CONSULTANT' },
    });
    const invite = JSON.parse(inv.payload).data;

    // Regenerate
    const regen = await server.inject({
      method: 'POST',
      url: `/api/v1/invitations/${invite.id}/regenerate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(regen.statusCode).toBe(200);
    const newToken = JSON.parse(regen.payload).data.token;
    expect(newToken).not.toBe(invite.token);

    // Old token must fail
    const oldAccept = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      payload: { token: invite.token, email: `regen-${RUN}@example.co.ke`, fullName: 'R', password: 'Str0ng!Pass' },
    });
    expect(oldAccept.statusCode).toBe(400);

    // New token works
    const newAccept = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      payload: { token: newToken, email: `regen-${RUN}@example.co.ke`, fullName: 'Regen User', password: 'Str0ng!Pass' },
    });
    expect(newAccept.statusCode).toBe(200);

    // Second invite for revoke test
    const inv2 = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: `revoked-${RUN}@example.co.ke`, role: 'CLIENT' },
    });
    const invite2 = JSON.parse(inv2.payload).data;
    const rev = await server.inject({
      method: 'POST',
      url: `/api/v1/invitations/${invite2.id}/revoke`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(rev.statusCode).toBe(200);
    const acc = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      payload: { token: invite2.token, email: `revoked-${RUN}@example.co.ke`, fullName: 'X', password: 'Str0ng!Pass' },
    });
    expect(acc.statusCode).toBe(400);
  });

  it('expired invitation is rejected with a clear message', async () => {
    const token = await adminToken(server);
    const email = `expired-${RUN}@example.co.ke`;
    const inv = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      headers: { authorization: `Bearer ${token}` },
      payload: { email, role: 'PM_QS' },
    });
    const invite = JSON.parse(inv.payload).data;

    // Force expiry inside the tenant context
    const tId = await tenantIdOf(server, token);
    await withTenantTx(prisma, tId, (tx) =>
      tx.invitation.update({
        where: { id: invite.id },
        data: { expires_at: new Date(Date.now() - 1000) },
      }),
    );

    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      payload: { token: invite.token, email, fullName: 'Late', password: 'Str0ng!Pass' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).message).toMatch(/expired/i);
  });
});
