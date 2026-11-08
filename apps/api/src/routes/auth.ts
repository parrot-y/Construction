import { prisma, verifyPassword, withTenantTx } from '@construction/db';
import { getPermissionsForRole, Role } from '@construction/permissions';
import { AuthUserResponse, LoginRequestSchema } from '@construction/validation';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

interface LoginAttempt {
  count: number;
  resetAt: number;
}

// In-memory sliding window rate limiter for login protection (OWASP A07)
const MAX_FAILED_ATTEMPTS = 20;
const LOCKOUT_WINDOW_MS = 5 * 60 * 1000; // 5-minute lockout window
const failedLoginsMap = new Map<string, LoginAttempt>();

// Clean up stale attempt records
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempt] of failedLoginsMap.entries()) {
    if (now > attempt.resetAt) {
      failedLoginsMap.delete(ip);
    }
  }
}, 60 * 1000).unref();

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';

const setSessionCookies = (reply: any, accessToken: string, refreshToken: string) => {
  const isProd = process.env.NODE_ENV === 'production';
  reply.setCookie('access_token', accessToken, {
    path: '/', httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 15 * 60,
  });
  reply.setCookie('refresh_token', refreshToken, {
    path: '/api/v1/auth', httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60,
  });
};

const clearSessionCookies = (reply: any) => {
  reply.clearCookie('access_token', { path: '/' });
  reply.clearCookie('refresh_token', { path: '/api/v1/auth' });
};

export const authRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // POST /api/v1/auth/login
  server.post('/api/v1/auth/login', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const clientIp = request.ip || '127.0.0.1';
    const now = Date.now();
    const attempt = failedLoginsMap.get(clientIp);

    // Rate limiting guard
    if (attempt && now < attempt.resetAt && attempt.count >= MAX_FAILED_ATTEMPTS) {
      const retryAfterSeconds = Math.ceil((attempt.resetAt - now) / 1000);
      reply.header('Retry-After', retryAfterSeconds);
      server.log.warn(
        { ip: clientIp, attempts: attempt.count },
        'Security Audit: Login rate limit exceeded; request throttled',
      );
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: 'Too many failed login attempts. Please try again later.',
      });
    }

    const recordFailedAttempt = () => {
      const cur = failedLoginsMap.get(clientIp);
      if (!cur || now > cur.resetAt) {
        failedLoginsMap.set(clientIp, { count: 1, resetAt: now + LOCKOUT_WINDOW_MS });
      } else {
        cur.count += 1;
      }
    };

    const parseResult = LoginRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid login payload',
        details: parseResult.error.flatten(),
      });
    }

    const { email, password, tenantId } = parseResult.data;

    // Retrieve user directly from public schema without auth_context bypasses (2c)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.is_active) {
      recordFailedAttempt();
      server.log.warn(
        { ip: clientIp, email: email.toLowerCase(), reason: 'USER_NOT_FOUND_OR_INACTIVE' },
        'Security Audit: Failed authentication attempt',
      );
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      recordFailedAttempt();
      server.log.warn(
        { ip: clientIp, email: email.toLowerCase(), reason: 'INVALID_PASSWORD' },
        'Security Audit: Failed authentication attempt',
      );
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Reset failed login counter on successful authentication
    failedLoginsMap.delete(clientIp);

    // Retrieve tenant memberships via narrow SECURITY DEFINER lookup function without auth_context bypasses (2c)
    const membershipRows = await prisma.$queryRaw<any[]>`
      SELECT * FROM lookup_user_memberships_for_login(${user.id}::uuid);
    `;

    const memberships = membershipRows.map((m) => ({
      id: m.id,
      tenant_id: m.tenant_id,
      role: m.role,
      tenant: {
        id: m.tenant_id,
        name: m.tenant_name,
        slug: m.tenant_slug,
        currency: m.tenant_currency || 'KES',
      },
    }));

    if (memberships.length === 0) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'User does not belong to any active company tenant',
      });
    }

    // Select target membership
    const activeMembership = tenantId
      ? memberships.find((m) => m.tenant_id === tenantId)
      : memberships[0];

    if (!activeMembership) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'User is not authorized for the requested company tenant',
      });
    }

    const tokenPayloadBase = {
      sub: user.id,
      email: user.email,
      fullName: user.full_name,
      tenantId: activeMembership.tenant_id,
      role: activeMembership.role,
    };

    const tokenPayload = { ...tokenPayloadBase, typ: 'access' as const };
    const token = server.jwt.sign(tokenPayload, { expiresIn: ACCESS_TTL });
    const refreshToken = server.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        fullName: user.full_name,
        tenantId: activeMembership.tenant_id,
        role: activeMembership.role,
        typ: 'refresh' as const,
      },
      { expiresIn: REFRESH_TTL },
    );

    // Short-lived access cookie + rotating refresh cookie (audit S-01)
    setSessionCookies(reply, token, refreshToken);

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
    clearSessionCookies(reply);
    return reply.status(200).send({
      success: true,
      message: 'Logged out successfully',
    });
  });

  // POST /api/v1/auth/refresh — rotate the refresh token and issue a new pair
  server.post('/api/v1/auth/refresh', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const refreshToken = request.cookies?.refresh_token;
    if (!refreshToken) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Missing refresh token' });
    }
    let payload: any;
    try {
      payload = server.jwt.verify(refreshToken);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid refresh token' });
    }
    if (payload.typ !== 'refresh' || !payload.sub || !payload.tenantId) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid refresh token' });
    }

    const membership = await withTenantTx(prisma, payload.tenantId, async (tx) => {
      const m = await tx.membership.findFirst({
        where: { tenant_id: payload.tenantId, user_id: payload.sub },
        include: { user: { select: { is_active: true, email: true, full_name: true } }, tenant: true },
      });
      return m;
    });
    if (!membership || !membership.user.is_active) {
      clearSessionCookies(reply);
      return reply.status(401).send({ error: 'Unauthorized', message: 'Session revoked' });
    }

    const token = server.jwt.sign(
      {
        sub: membership.user_id ?? payload.sub,
        email: membership.user.email,
        fullName: membership.user.full_name,
        tenantId: payload.tenantId,
        role: membership.role,
        typ: 'access',
      },
      { expiresIn: ACCESS_TTL },
    );
    const newRefresh = server.jwt.sign(
      {
        sub: payload.sub,
        email: membership.user.email,
        fullName: membership.user.full_name,
        tenantId: payload.tenantId,
        role: membership.role,
        typ: 'refresh',
      },
      { expiresIn: REFRESH_TTL },
    );
    setSessionCookies(reply, token, newRefresh);
    return reply.status(200).send({ success: true });
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

  // PATCH /api/v1/auth/me — profile self-service (name, phone, country)
  server.patch(
    '/api/v1/auth/me',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const body = (request.body || {}) as { fullName?: string; phoneNumber?: string | null; country?: string | null };
      const data: Record<string, unknown> = {};
      if (typeof body.fullName === 'string' && body.fullName.trim()) data.full_name = body.fullName.trim().slice(0, 255);
      if (body.phoneNumber !== undefined) data.phone_number = body.phoneNumber ? String(body.phoneNumber).slice(0, 30) : null;
      if (body.country !== undefined) data.country = body.country ? String(body.country).slice(0, 60) : null;
      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No updatable fields provided' });
      }
      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) =>
          tx.user.update({ where: { id: sub }, data }),
        );
        return reply.status(200).send({ data: { id: updated.id, fullName: updated.full_name, phoneNumber: updated.phone_number, country: updated.country } });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update profile' });
      }
    },
  );
};
