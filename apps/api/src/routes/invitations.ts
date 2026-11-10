import { hashPassword, prisma, recordAuditLog, verifyPassword, withTenantTx } from '@construction/db';
import { canInviteRole, Permissions, Roles } from '@construction/permissions';
import { AcceptInvitationSchema } from '@construction/validation';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'node:crypto';
import { requirePermission } from '../plugins/rbac';
import { issueEmailVerificationToken } from '../lib/accountTokens';

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
      const body = request.body as { email: string; phone?: string; role: string };

      if (!body.email || !body.role) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Email and role are required',
        });
      }

      const validRoles = Object.values(Roles);
      if (!validRoles.includes(body.role as (typeof Roles)[keyof typeof Roles])) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Invalid role "${body.role}". Allowed roles: ${validRoles.join(', ')}`,
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

      // Check if user is already an active member of this tenant
      const existingMember = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.membership.findFirst({
          where: {
            tenant_id: tenantId,
            user: { email: body.email.toLowerCase() },
          },
        });
      });

      if (existingMember) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'User is already a member of this company tenant',
        });
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invite = await withTenantTx(prisma, tenantId, async (tx) => {
        const created = await tx.invitation.create({
          data: {
            tenant_id: tenantId,
            email: body.email.toLowerCase(),
            phone: body.phone,
            role: body.role,
            token,
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
          changes: { email: body.email, role: body.role },
        });

        return created;
      });

      return reply.status(201).send({ data: invitePayload(invite) });
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

      return reply.status(200).send({ data: invitations.map(invitePayload) });
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
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
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

      const { token, email, fullName, password } = parseResult.data;

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
            // Existing account: the token holder must prove they control the
            // account by confirming its current password. The password is
            // never overwritten and fullName is not changed.
            if (!existingUser.is_active) {
              throw { status: 403, message: 'This account has been deactivated' };
            }
            const passwordOk = await verifyPassword(password, existingUser.password_hash);
            if (!passwordOk) {
              throw {
                status: 403,
                message: 'This email already has an account — confirm your existing password to accept',
              };
            }
            userId = existingUser.id;
            existingAccount = true;
          } else {
            const passwordHash = await hashPassword(password);
            const created = await tx.user.create({
              data: {
                email: invitation.email,
                full_name: fullName,
                password_hash: passwordHash,
                phone_number: invitation.phone,
                is_active: true,
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
