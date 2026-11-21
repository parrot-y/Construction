import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { prisma, withTenantTx } from '@construction/db';
import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import '../types/auth';

const authPluginAsync: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Fail-closed startup guard: Prevent weak or default secrets in production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('dev-super-secure')) {
      throw new Error('CRITICAL SECURITY VIOLATION: Production requires a cryptographically strong JWT_SECRET with at least 32 characters');
    }
    if (!process.env.COOKIE_SECRET || process.env.COOKIE_SECRET.length < 32 || process.env.COOKIE_SECRET.includes('dev-super-secure')) {
      throw new Error('CRITICAL SECURITY VIOLATION: Production requires a cryptographically strong COOKIE_SECRET with at least 32 characters');
    }
  }

  const jwtSecret = process.env.JWT_SECRET || 'dev-super-secure-jwt-signing-secret-key-32-chars-minimum!';
  const cookieSecret = process.env.COOKIE_SECRET || 'dev-super-secure-cookie-secret-key-32-chars!';

  await server.register(cookie, {
    secret: cookieSecret,
    hook: 'onRequest',
  });

  await server.register(jwt, {
    secret: jwtSecret,
    cookie: {
      cookieName: 'access_token',
      signed: false,
    },
  });

  server.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (request.cookies?.access_token) {
        await request.jwtVerify({ onlyCookie: true });
      } else {
        await request.jwtVerify();
      }
    } catch (err) {
      server.log.warn({ err }, 'Authentication failed');
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or missing authentication token',
      });
    }

    // Session revocation check (audit S-01): reject non-access tokens and
    // verify the user is still active with a live membership on EVERY request.
    const payload = request.user as { sub?: string; tenantId?: string; typ?: string } | undefined;
    if (!payload?.sub || !payload.tenantId || payload.typ !== 'access') {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or missing authentication token',
      });
    }
    let membershipRole: string | undefined;
    try {
      const membership = await withTenantTx(prisma, payload.tenantId, (tx) =>
        tx.membership.findFirst({
          where: { tenant_id: payload.tenantId, user_id: payload.sub },
          select: { role: true, user: { select: { is_active: true } } },
        }),
      );
      membershipRole = membership?.role;
      if (!membership?.user.is_active) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'User session is inactive or revoked',
        });
      }
    } catch (err) {
      server.log.error({ err }, 'Session validation failed');
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Session validation failed',
      });
    }

    // The JWT role claim is a login-time snapshot — the membership row is
    // authoritative so demotions/removals apply to already-issued tokens.
    if (membershipRole) {
      (request.user as { role?: string }).role = membershipRole;
    }
  });
};

export const authPlugin = fp(authPluginAsync, {
  name: 'auth-plugin',
});
