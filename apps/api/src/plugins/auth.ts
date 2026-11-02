import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import '../types/auth';

const authPluginAsync: FastifyPluginAsync = async (server: FastifyInstance) => {
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
  });
};

export const authPlugin = fp(authPluginAsync, {
  name: 'auth-plugin',
});
