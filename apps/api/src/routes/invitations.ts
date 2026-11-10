import { hashPassword, prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions, Roles } from '@construction/permissions';
import { AcceptInvitationSchema } from '@construction/validation';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'node:crypto';
import { requirePermission } from '../plugins/rbac';

export const invitationRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // POST /api/v1/invitations - Invite new user (Admin only)
  server.post(
    '/api/v1/invitations',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_INVITE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
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

      return reply.status(201).send({
        data: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          token: invite.token,
          expiresAt: invite.expires_at,
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

      return reply.status(200).send({ data: invitations });
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
      return reply.status(200).send({ data: result.invite });
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
      return reply.status(200).send({
        data: {
          id: result.invite.id,
          email: result.invite.email,
          role: result.invite.role,
          status: result.invite.status,
          token: result.invite.token,
          expiresAt: result.invite.expires_at,
        },
      });
    },
  );

  // POST /api/v1/invitations/accept - Accept invite and register / link user
  server.post('/api/v1/invitations/accept', async (request, reply) => {
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

    if (email.toLowerCase() !== invitation.email.toLowerCase()) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'This invitation was issued to a different email address',
      });
    }

    const passwordToHash = password || randomBytes(24).toString('base64');
    const passwordHash = await hashPassword(passwordToHash);

    // Complete acceptance transaction inside the target tenant's RLS lease
    await withTenantTx(prisma, invitation.tenant_id, async (tx) => {
      // Find or create user
      let user = await tx.user.findUnique({
        where: { email: invitation.email },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email: invitation.email,
            full_name: fullName,
            password_hash: passwordHash,
            phone_number: invitation.phone,
            is_active: true,
          },
        });
      }

      // Upsert membership
      await tx.membership.upsert({
        where: {
          tenant_id_user_id: {
            tenant_id: invitation.tenant_id,
            user_id: user.id,
          },
        },
        update: {
          role: invitation.role,
        },
        create: {
          tenant_id: invitation.tenant_id,
          user_id: user.id,
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
        actorId: user.id,
        action: 'INVITATION_ACCEPTED',
        entityType: 'Invitation',
        entityId: invitation.id,
        changes: { email: invitation.email, role: invitation.role },
      });
    });

    return reply.status(200).send({
      success: true,
      message: 'Invitation accepted successfully. You may now sign in.',
    });
  });
};
