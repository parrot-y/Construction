import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import fastify, { FastifyInstance } from 'fastify';
import { HealthCheckResponse } from '@construction/validation';
import { authPlugin } from './plugins/auth';
import { securityGuardPlugin } from './plugins/security-guard';
import { authRoutes } from './routes/auth';
import { boqRoutes } from './routes/boq';
import { companyRoutes } from './routes/company';
import { dashboardRoutes } from './routes/dashboard';
import { invitationRoutes } from './routes/invitations';
import { projectRoutes } from './routes/projects';

export function buildServer(): FastifyInstance {
  const server = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Secure HTTP Headers
  server.register(helmet, {
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
  });

  // Strict CORS
  server.register(cors, {
    origin: process.env.WEB_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  // Multipart file upload (capped at 15MB per ADR-003)
  server.register(multipart, {
    limits: {
      fileSize: 15 * 1024 * 1024,
    },
  });

  // Database security guard (asserts db_app non-superuser RLS connection)
  server.register(securityGuardPlugin);

  // Authentication & Session Plugin
  server.register(authPlugin);

  // Application Routes
  server.register(authRoutes);
  server.register(boqRoutes);
  server.register(companyRoutes);
  server.register(dashboardRoutes);
  server.register(invitationRoutes);
  server.register(projectRoutes);

  // Root unauthenticated health check route
  server.get('/health', async (_request, reply) => {
    const response: HealthCheckResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
    return reply.status(200).send(response);
  });

  return server;
}

export async function startServer(): Promise<void> {
  const server = buildServer();
  const port = parseInt(process.env.PORT || '4000', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    server.log.info(`API Server successfully listening on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Start server if executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer();
}
