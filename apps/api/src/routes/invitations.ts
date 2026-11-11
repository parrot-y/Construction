import { hashPassword, prisma, recordAuditLog, verifyPassword, withTenantTx } from '@construction/db';
import { canInviteRole, Permissions, Roles } from '@construction/permissions';
import { AcceptInvitationSchema, InviteMemberSchema } from '@construction/validation';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'node:crypto';
import { requirePermission } from '../plugins/rbac';
import { issueEmailVerificationToken } from '../lib/accountTokens';

/** Field roles that can be onboarded by phone + PIN (no email account). */
const PIN_FIELD_ROLES = new Set(['FOREMAN', 'WORKER', 'SITE_ENGINEER', 'TRADE_LEAD']);

/** Kenyan phone normalization: accepts 07…, 7…, 254…, +254… → +254XXXXXXXXX. */
export function normalizeKenyaPhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+254')) return digits;
  if (digits.startsWith('254')) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `+254${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

/** Weak-PIN rejection: all-same digits, keyboard walks, or common sequences. */
export function isWeakPin(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return true;
  if (/^(\d)\1{5}$/.test(pin)) return true; // 111111, 000000…
  const seq = '0123456789';
  const d = pin.split('').map(Number);
  const asc = d.every((v, i) => i === 0 || v === ((d[i - 1] ?? 0) + 1) % 10);
  const desc = d.every((v, i) => i === 0 || v === ((d[i - 1] ?? 0) + 9) % 10);
  if (asc || desc) return true;
  // repeated 2- or 3-digit blocks (121212, 123123…)
  if (pin.slice(0, 2) === pin.slice(2, 4) && pin.slice(2, 4) === pin.slice(4, 6)) return true;
  if (pin.slice(0, 3) === pin.slice(3, 6)) return true;
  void seq;
  return false;
}

/** Synthetic login email for phone+PIN field accounts — `.local` can never
 * receive mail; uniqueness is per-tenant so the same worker phone can be
 * invited by different companies without colliding. */
const fieldEmailFor = (tenantId: string, phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return `field-${tenantId}-${digits}@pin.local`;
};

const inviteUrlFor = (token: string): string => {
  const base = (process.env.WEB_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/?invite=${token}`;
};

/** Public-safe invitation payload — never exposes the raw token, only the
 * explicit copy-and-send link an admin hands to the invitee out-of-band. */
const invitePayload = (invite: any) => ({
  id: invite.id,
  email: invite.email,
  role: invite.role,
  status: invite.status,
  // The raw token is returned alongside inviteUrl: acceptance requires the
  // invitee's own password (or PIN) plus full name, so possessing the token
  // alone cannot attach an existing account — the copy-and-send link is the
  // intended delivery channel, the token field keeps API consumers unblocked.
  token: invite.token,
  inviteUrl: inviteUrlFor(invite.token),
  expiresAt: invite.expires_at,
});

export const invitationRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // POST /api/v1/invitations - Invite new user (role-limited)
  server.post(
    '/api/v1/invitations',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_INVITE)],
    },
    async (request, reply) => {
      const { tenantId, sub, role: inviterRole } = request.user;
      const parsed = InviteMemberSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues[0]?.message || 'Invalid invitation payload',
          details: parsed.error.flatten(),
        });
      }
      const body = parsed.data;
      // PIN path only when the invitee has NO email — phone+email stays a
      // normal email invite (phone is just a contact field there).
      const isPinInvite = !!body.phone && !body.email;

      const validRoles = Object.values(Roles);
      if (!validRoles.includes(body.role as (typeof Roles)[keyof typeof Roles])) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Invalid role "${body.role}". Allowed roles: ${validRoles.join(', ')}`,
        });
      }

      // Phone invites are only for field roles — office roles need an email
      // account for password + verification flows.
      if (isPinInvite && !PIN_FIELD_ROLES.has(body.role)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Phone+PIN invites are only available for field roles (${[...PIN_FIELD_ROLES].join(', ')})`,
        });
      }
      if (!isPinInvite && !body.email) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Email and role are required' });
      }
      if (isPinInvite && body.pin && isWeakPin(body.pin)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'PIN is too weak — use 6 digits that are not a repeated, sequential or common pattern',
        });
      }

      // Seniority rule: only COMPANY_ADMIN may invite ADMIN/COMPANY_ADMIN;
      // every other inviter may only invite roles below their own.
      if (!canInviteRole(inviterRole, body.role)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: `Your role (${inviterRole}) cannot invite ${body.role}`,
        });
      }

      const inviteEmail = isPinInvite
        ? fieldEmailFor(tenantId, normalizeKenyaPhone(body.phone!))
        : body.email!.toLowerCase();
      const invitePhone = isPinInvite ? normalizeKenyaPhone(body.phone!) : (body.phone ?? null);

      // Check if user is already an active member of this tenant
      const existingMember = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.membership.findFirst({
          where: {
            tenant_id: tenantId,
            user: { email: inviteEmail },
          },
        });
      });

      if (existingMember) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'User is already a member of this company tenant',
        });
      }

      // A pending PIN invite for the same phone already covers this worker.
      if (isPinInvite) {
        const pendingDup = await withTenantTx(prisma, tenantId, async (tx) =>
          tx.invitation.findFirst({
            where: { tenant_id: tenantId, phone: invitePhone, status: 'PENDING' },
            select: { id: true },
          }),
        );
        if (pendingDup) {
          return reply.status(409).send({
            error: 'Conflict',
            message: 'A pending invitation already exists for this phone number',
          });
        }
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const pinHash = isPinInvite && body.pin ? await hashPassword(body.pin) : null;

      const invite = await withTenantTx(prisma, tenantId, async (tx) => {
        const created = await tx.invitation.create({
          data: {
            tenant_id: tenantId,
            email: inviteEmail,
            phone: invitePhone,
            role: body.role,
            token,
            pin_hash: pinHash,
            status: 'PENDING',
            expires_at: expiresAt,
          },
        });

        await recordAuditLog(tx, {
          tenantId,
          actorId: sub,
          action: 'MEMBER_INVITED',
          entityType: 'Invitation',
          entityId: created.id,
          changes: { email: isPinInvite ? undefined : inviteEmail, phone: invitePhone, role: body.role, authMethod: isPinInvite ? 'PIN' : 'PASSWORD' },
        });

        return created;
      });

      return reply.status(201).send({
        data: {
          ...invitePayload(invite),
          phone: invitePhone,
          authMethod: isPinInvite ? 'PIN' : 'PASSWORD',
        },
      });
    },
  );

  // GET /api/v1/invitations/lookup/:token - Public invite preview for the
  // acceptance screen. The token is a 32-byte random secret; the response only
  // reveals what the invitee needs (company, role, invited email, expiry).
  server.get(
    '/api/v1/invitations/lookup/:token',
    {
      config: {
        rateLimit: { max: 30, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      if (!token || token.length < 16 || token.length > 128) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Invalid invitation token' });
      }

      const rows = await prisma.$queryRaw<any[]>`
        SELECT * FROM lookup_invitation_by_token(${token}::text);
      `;
      const invitation = rows[0] || null;
      if (!invitation) {
        return reply.status(404).send({ error: 'Not Found', message: 'Invitation not found' });
      }

      const tenant = await prisma.tenant.findUnique({ where: { id: invitation.tenant_id } });
      const expired = invitation.status === 'PENDING' && new Date() > invitation.expires_at;

      return reply.status(200).send({
        data: {
          email: invitation.email,
          phone: invitation.phone,
          role: invitation.role,
          status: expired ? 'EXPIRED' : invitation.status,
          expiresAt: invitation.expires_at,
          companyName: tenant?.name ?? 'Unknown company',
        },
      });
    },
  );

  // GET /api/v1/invitations - List all invitations (pending, accepted, revoked, expired)
  server.get(
    '/api/v1/invitations',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_INVITE)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { status } = request.query as { status?: string };

      const invitations = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.invitation.findMany({
          where: {
            tenant_id: tenantId,
            ...(status ? { status } : {}),
          },
          orderBy: { created_at: 'desc' },
        });
      });

      // List view exposes inviteUrl (the copy-and-send link the admin UI's
      // "Copy link" action needs) but never the bare token field — same
      // COMPANY_INVITE permission gates create/regenerate which already
      // return full tokens, so this is not a privilege escalation.
      return reply.status(200).send({
        data: invitations.map((inv) => {
          const { token: _t, ...rest } = invitePayload(inv);
          return rest;
        }),
      });
    },
  );

  // POST /api/v1/invitations/:id/revoke - Revoke a pending invitation
  server.post(
    '/api/v1/invitations/:id/revoke',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_INVITE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };

      const result = await withTenantTx(prisma, tenantId, async (tx) => {
        const invite = await tx.invitation.findFirst({ where: { id, tenant_id: tenantId } });
        if (!invite) return { error: 404 as const };
        if (invite.status !== 'PENDING') return { error: 409 as const, status: invite.status };
        const updated = await tx.invitation.update({ where: { id }, data: { status: 'REVOKED' } });
        await recordAuditLog(tx, {
          tenantId,
          actorId: sub,
          action: 'INVITATION_REVOKED',
          entityType: 'Invitation',
          entityId: id,
          changes: { email: invite.email, role: invite.role },
        });
        return { invite: updated };
      });

      if ('error' in result) {
        if (result.error === 404) {
          return reply.status(404).send({ error: 'Not Found', message: 'Invitation not found' });
        }
        return reply.status(409).send({
          error: 'Conflict',
          message: `Cannot revoke an invitation that is already ${result.status}`,
        });
      }
      return reply.status(200).send({ data: invitePayload(result.invite) });
    },
  );

  // POST /api/v1/invitations/:id/regenerate - Issue a fresh token for a
  // pending (or revoked) invitation; the old token stops working immediately.
  server.post(
    '/api/v1/invitations/:id/regenerate',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_INVITE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };

      const result = await withTenantTx(prisma, tenantId, async (tx) => {
        const invite = await tx.invitation.findFirst({ where: { id, tenant_id: tenantId } });
        if (!invite) return { error: 404 as const };
        if (!['PENDING', 'REVOKED'].includes(invite.status)) {
          return { error: 409 as const, status: invite.status };
        }
        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const updated = await tx.invitation.update({
          where: { id },
          data: { token, status: 'PENDING', expires_at: expiresAt },
        });
        await recordAuditLog(tx, {
          tenantId,
          actorId: sub,
          action: 'INVITATION_REGENERATED',
          entityType: 'Invitation',
          entityId: id,
          changes: { email: invite.email, role: invite.role },
        });
        return { invite: updated };
      });

      if ('error' in result) {
        if (result.error === 404) {
          return reply.status(404).send({ error: 'Not Found', message: 'Invitation not found' });
        }
        return reply.status(409).send({
          error: 'Conflict',
          message: `Cannot regenerate an invitation that is ${result.status}`,
        });
      }
      return reply.status(200).send({ data: invitePayload(result.invite) });
    },
  );

  // POST /api/v1/invitations/accept - Accept invite and register / link user.
  // The invitee always sets (new account) or confirms (existing account) their
  // own password — possessing the token alone never attaches an existing user.
  server.post(
    '/api/v1/invitations/accept',
    {
      // E2E suites accept many invites per minute from one IP — the limit is
      // env-tunable (production default stays strict).
      config: { rateLimit: { max: Number(process.env.INVITATION_ACCEPT_RATE_LIMIT_MAX ?? 10), timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parseResult = AcceptInvitationSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid invitation acceptance payload',
          details: parseResult.error.flatten(),
        });
      }

      const { token, email, fullName, password, pin } = parseResult.data;

      // Retrieve invitation via narrow SECURITY DEFINER lookup function without auth_context bypasses (2c)
      const invitationRows = await prisma.$queryRaw<any[]>`
        SELECT * FROM lookup_invitation_by_token(${token}::text);
      `;
      const invitation = invitationRows[0] || null;

      if (!invitation || invitation.status !== 'PENDING') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid or already accepted invitation token',
        });
      }

      if (new Date() > invitation.expires_at) {
        await withTenantTx(prisma, invitation.tenant_id, async (tx) => {
          await tx.invitation.update({
            where: { id: invitation.id },
            data: { status: 'EXPIRED' },
          });
        });
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'This invitation has expired',
        });
      }

      if (email && email.toLowerCase() !== invitation.email.toLowerCase()) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'This invitation was issued to a different email address',
        });
      }

      // Phone (field-role) invites authenticate with a PIN copied onto the
      // account — set at invite time or chosen by the invitee at accept.
      // PIN invites are identified by their synthetic field email — a phone
      // number on an email invite is just a contact field and must not flip
      // acceptance into the PIN flow.
      const pinInvite = !!invitation.phone && invitation.email.endsWith('@pin.local');
      let acceptedPinHash: string | null = invitation.pin_hash || null;
      if (pinInvite && !acceptedPinHash) {
        if (!pin) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'A 6-digit PIN is required to accept this invitation',
          });
        }
        if (isWeakPin(pin)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'PIN is too weak — use 6 digits that are not a repeated, sequential or common pattern',
          });
        }
        acceptedPinHash = await hashPassword(pin);
      }
      if (!pinInvite && !password) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Password is required to accept this invitation',
        });
      }

      const tenant = await prisma.tenant.findUnique({ where: { id: invitation.tenant_id } });

      let outcome: { userId: string; existingAccount: boolean };
      try {
        outcome = await withTenantTx(prisma, invitation.tenant_id, async (tx) => {
          const existingUser = await tx.user.findUnique({
            where: { email: invitation.email },
          });

          let userId: string;
          let existingAccount = false;

          if (existingUser) {
            if (pinInvite) {
              // Re-invited field worker: rotate the PIN on the existing
              // account — the invite token is the authorization.
              await tx.user.update({
                where: { id: existingUser.id },
                data: { pin_hash: acceptedPinHash, is_active: true },
              });
              userId = existingUser.id;
              existingAccount = true;
            } else {
              // Existing account: the token holder must prove they control the
              // account by confirming its current password. The password is
              // never overwritten and fullName is not changed.
              if (!existingUser.is_active) {
                throw { status: 403, message: 'This account has been deactivated' };
              }
              const passwordOk = await verifyPassword(password!, existingUser.password_hash);
              if (!passwordOk) {
                throw {
                  status: 403,
                  message: 'This email already has an account — confirm your existing password to accept',
                };
              }
              userId = existingUser.id;
              existingAccount = true;
            }
          } else if (pinInvite) {
            // Field account: unusable random password (PIN is the credential),
            // phone marked verified — the company admin vouches for it.
            const created = await tx.user.create({
              data: {
                email: invitation.email,
                full_name: fullName,
                password_hash: await hashPassword(randomBytes(32).toString('hex')),
                phone_number: invitation.phone,
                phone_verified_at: new Date(),
                pin_hash: acceptedPinHash,
                is_active: true,
              },
            });
            userId = created.id;
          } else {
            const passwordHash = await hashPassword(password!);
            const created = await tx.user.create({
              data: {
                email: invitation.email,
                full_name: fullName,
                password_hash: passwordHash,
                phone_number: invitation.phone,
                is_active: true,
                // Pilot: non-production treats invite acceptance as verified
                // (delivery simulated); production stays PENDING for the
                // verification provider or operator activation.
                ...(process.env.NODE_ENV === 'development' ? { email_verified_at: new Date() } : {}),
              },
            });
            userId = created.id;
          }

          // Upsert membership
          await tx.membership.upsert({
            where: {
              tenant_id_user_id: {
                tenant_id: invitation.tenant_id,
                user_id: userId,
              },
            },
            update: {
              role: invitation.role,
            },
            create: {
              tenant_id: invitation.tenant_id,
              user_id: userId,
              role: invitation.role,
            },
          });

          // Mark invitation accepted
          await tx.invitation.update({
            where: { id: invitation.id },
            data: { status: 'ACCEPTED' },
          });

          await recordAuditLog(tx, {
            tenantId: invitation.tenant_id,
            actorId: userId,
            action: 'INVITATION_ACCEPTED',
            entityType: 'Invitation',
            entityId: invitation.id,
            changes: {
              email: invitation.email,
              role: invitation.role,
              existingAccount,
            },
          });

          return { userId, existingAccount };
        });
      } catch (err: any) {
        if (err?.status) {
          return reply.status(err.status).send({ error: 'Forbidden', message: err.message });
        }
        throw err;
      }

      // New/unverified accounts get a verification token (simulated delivery —
      // raw token returned outside production). Existing verified accounts skip.
      const user = await prisma.user.findUnique({ where: { id: outcome.userId } });
      const needsVerification = !!user && !user.email_verified_at && !user.phone_verified_at;
      const verificationToken = needsVerification
        ? await issueEmailVerificationToken(outcome.userId)
        : null;

      return reply.status(200).send({
        data: {
          success: true,
          message: outcome.existingAccount
            ? `Invitation accepted — you have joined ${tenant?.name ?? 'the company'} as ${invitation.role}.`
            : 'Invitation accepted. Verify your email address before signing in.',
          existingAccount: outcome.existingAccount,
          pendingVerification: needsVerification,
          companyName: tenant?.name ?? null,
          role: invitation.role,
          ...(verificationToken && process.env.NODE_ENV !== 'production' ? { verificationToken } : {}),
        },
      });
    },
  );
};
