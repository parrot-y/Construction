import { prisma, verifyPassword, withTenantTx } from '@construction/db';
import { getPermissionsForRole, Role } from '@construction/permissions';
import { AuthUserResponse, LoginRequestSchema } from '@construction/validation';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const authRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // POST /api/v1/auth/login
  server.post('/api/v1/auth/login', async (request, reply) => {
    const parseResult = LoginRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid login payload',
        details: parseResult.error.flatten(),
      });
    }

    const { email, password, tenantId } = parseResult.data;

    // Retrieve user and their tenant memberships inside scoped auth transaction
    const user = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.auth_context', 'login', TRUE)`;
      return tx.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          memberships: {
            include: {
              tenant: true,
            },
          },
        },
      });
    });

    if (!user || !user.is_active) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    if (user.memberships.length === 0) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'User does not belong to any active company tenant',
      });
    }

    // Select target membership
    const activeMembership = tenantId
      ? user.memberships.find((m) => m.tenant_id === tenantId)
      : user.memberships[0];

    if (!activeMembership) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'User is not authorized for the requested company tenant',
      });
    }

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.full_name,
      tenantId: activeMembership.tenant_id,
      role: activeMembership.role,
    };

    const token = server.jwt.sign(tokenPayload, { expiresIn: '7d' });

    // Set HTTP-only secure cookie
    reply.setCookie('access_token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    const permissions = getPermissionsForRole(activeMembership.role as Role);

    const response: AuthUserResponse = {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phoneNumber: user.phone_number,
        role: activeMembership.role,
        tenant: {
          id: activeMembership.tenant.id,
          name: activeMembership.tenant.name,
          slug: activeMembership.tenant.slug,
          currency: activeMembership.tenant.currency,
        },
      },
      permissions: [...permissions],
      token,
    };

    return reply.status(200).send(response);
  });

  // POST /api/v1/auth/logout
  server.post('/api/v1/auth/logout', async (_request, reply) => {
    reply.clearCookie('access_token', { path: '/' });
    return reply.status(200).send({
      success: true,
      message: 'Logged out successfully',
    });
  });

  // GET /api/v1/auth/me
  server.get(
    '/api/v1/auth/me',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const userPayload = request.user;

      const user = await withTenantTx(prisma, userPayload.tenantId, async (tx) => {
        return tx.user.findUnique({
          where: { id: userPayload.sub },
          include: {
            memberships: {
              where: { tenant_id: userPayload.tenantId },
              include: {
                tenant: true,
              },
            },
          },
        });
      });

      const activeMembership = user?.memberships[0];
      if (!user || !user.is_active || !activeMembership) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'User session is inactive or revoked',
        });
      }

      const permissions = getPermissionsForRole(activeMembership.role as Role);

      const response: AuthUserResponse = {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          phoneNumber: user.phone_number,
          role: activeMembership.role,
          tenant: {
            id: activeMembership.tenant.id,
            name: activeMembership.tenant.name,
            slug: activeMembership.tenant.slug,
            currency: activeMembership.tenant.currency,
          },
        },
        permissions: [...permissions],
        token: request.headers.authorization?.replace(/^Bearer\s+/i, '') || '',
      };

      return reply.status(200).send(response);
    },
  );
};
