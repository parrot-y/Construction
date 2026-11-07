import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import fastify, { FastifyError, FastifyInstance } from 'fastify';
import { HealthCheckResponse } from '@construction/validation';
import { authPlugin } from './plugins/auth';
import { securityGuardPlugin } from './plugins/security-guard';
import { authRoutes } from './routes/auth';
import { boqRoutes } from './routes/boq';
import { companyRoutes } from './routes/company';
import { costRoutes } from './routes/costs';
import { dashboardRoutes } from './routes/dashboard';
import { invitationRoutes } from './routes/invitations';
import { projectRoutes } from './routes/projects';
import { siteRoutes } from './routes/site';
import { variationsRoutes } from './routes/variations';
import { clientPortalRoutes } from './routes/clientPortal';
import { reportsRoutes } from './routes/reports';
import { lifecycleRoutes } from './routes/lifecycle';
import { externalPortalRoutes } from './routes/externalPortals';
import { operationsRoutes } from './routes/operations';
import { contractClaimsRoutes } from './routes/contractClaims';
import { commercialOperationsRoutes } from './routes/commercialOperations';
import { siteOperationsRoutes } from './routes/siteOperations';
import { enterpriseOperationsRoutes } from './routes/enterpriseOperations';
import { platformServicesRoutes } from './routes/platformServices';
import { quotesRoutes } from './routes/quotes';
import { validateEnvironmentSecurity } from './services/securityConfig';

export function buildServer(): FastifyInstance {
  // Validate production security invariants (Fail-Closed on missing/short secrets)
  validateEnvironmentSecurity();

  const server = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Secure HTTP Headers (OWASP A05 Security Misconfiguration defense)
  server.register(helmet, {
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        upgradeInsecureRequests: [],
      },
    } : false,
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
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

  // Global defensive error handler (OWASP A05 - Prevent sensitive information leakage)
  server.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error, reqId: request.id }, 'Unhandled request error');

    const statusCode = error.statusCode || 500;

    // For client errors (4xx), return sanitized error payload
    if (statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        statusCode,
        error: error.name || 'Bad Request',
        message: error.message,
        details: (error as any).details || (error as any).validation || undefined,
      });
    }

    // For server errors (500), strictly sanitize in production to avoid leaking database schemas, queries, or paths
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected internal server error occurred'
        : error.message,
    });
  });

  // Database security guard (asserts db_app non-superuser RLS connection)
  server.register(securityGuardPlugin);

  // Authentication & Session Plugin
  server.register(authPlugin);

  // Application Routes
  server.register(authRoutes);
  server.register(boqRoutes);
  server.register(companyRoutes);
  server.register(costRoutes);
  server.register(dashboardRoutes);
  server.register(invitationRoutes);
  server.register(projectRoutes);
  server.register(siteRoutes);
  server.register(variationsRoutes);
  server.register(clientPortalRoutes);
  server.register(reportsRoutes);
  server.register(lifecycleRoutes);
  server.register(externalPortalRoutes);
  server.register(operationsRoutes);
  server.register(contractClaimsRoutes);
  server.register(commercialOperationsRoutes);
  server.register(siteOperationsRoutes);
  server.register(enterpriseOperationsRoutes);
  server.register(platformServicesRoutes);
  server.register(quotesRoutes);

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
