import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import moduleGate from './plugins/moduleGate';
import fs from 'node:fs';
import path from 'node:path';
import fastify, { FastifyError, FastifyInstance } from 'fastify';
import { HealthCheckResponse } from '@construction/validation';
import { prisma } from '@construction/db';
import { registerAuthorizationGuards } from './plugins/routeAuthorization';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { redactUrl } from './lib/logRedaction';
import { initSentry } from './lib/sentry';
import { authPlugin } from './plugins/auth';
import { securityGuardPlugin } from './plugins/security-guard';
import { fileRoutes } from './routes/files';
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
import { invoicesRoutes } from './routes/invoices';
import { certificatesRoutes } from './routes/certificates';
import { commitmentsRoutes } from './routes/commitments';
import { announcementsRoutes } from './routes/announcements';
import { inboxRoutes } from './routes/inbox';
import { observationsRoutes } from './routes/observations';
import { crewsRoutes } from './routes/crews';
import { companyDocumentsRoutes } from './routes/companyDocuments';
import { correspondenceRoutes } from './routes/correspondence';
import { scheduledReportsRoutes } from './routes/scheduledReports';
import { attendanceRoutes } from './routes/attendance';
import { checklistsRoutes } from './routes/checklists';
import { integrationRoutes } from './routes/integrations';
import { meRoutes, clientPaymentNoticeRoutes } from './routes/me';
import { procurementRoutes } from './routes/procurement';
import { operatorRoutes } from './routes/operator';
import { validateEnvironmentSecurity } from './services/securityConfig';

export function buildServer(): FastifyInstance {
  // Error monitoring — no-op without SENTRY_DSN (dev/e2e unaffected).
  initSentry();
  // Validate production security invariants (Fail-Closed on missing/short secrets)
  validateEnvironmentSecurity();

  // Trust X-Forwarded-For only from configured proxy CIDRs (the ALB in
  // staging). TRUSTED_PROXY_CIDRS is a comma-separated list — never '*'.
  const trustedProxyCidrs = (process.env.TRUSTED_PROXY_CIDRS || '')
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && !c.includes('*'));

  const server = fastify({
    trustProxy: trustedProxyCidrs.length > 0 ? trustedProxyCidrs : false,
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      serializers: {
        // Never persist portal bearer tokens, credential headers, or
        // password/token fields in request logs.
        req(request) {
          return {
            method: request.method,
            url: redactUrl(request.url),
            host: request.headers?.host,
            remoteAddress: request.ip,
          };
        },
        res(reply) {
          return { statusCode: reply.statusCode };
        },
      },
    },
  });

  // Tolerant JSON body parser: DELETE/other bodiless requests may still carry
  // `Content-Type: application/json` with an empty payload — treat that as
  // "no body" instead of Fastify's default 400.
  server.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const raw = typeof body === 'string' ? body : String(body ?? '');
    if (!raw.trim()) return done(null, undefined);
    try {
      done(null, JSON.parse(raw));
    } catch {
      const err = new Error('Invalid JSON payload') as Error & { statusCode?: number };
      err.statusCode = 400;
      done(err);
    }
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

  // Upload storage root (local volume; object-storage driver slots in via UPLOAD_DRIVER)
  const uploadRoot = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
  fs.mkdirSync(uploadRoot, { recursive: true });

  // Rate limiting (audit S-02): opt-in per route via config.rateLimit —
  // global:false so test suites and high-frequency internal calls are unaffected.
  server.register(rateLimit, { global: false });

  // OpenAPI spec for core endpoints (D4). Off in production unless
  // OPENAPI_ENABLED=1 — spec exposes route shapes, not data.
  if (process.env.OPENAPI_ENABLED === '1' || process.env.NODE_ENV !== 'production') {
    server.register(swagger, {
      openapi: {
        info: { title: 'SiteSafi API', version: '0.1.0', description: 'Core endpoints. See docs/API_CONTRACT.md for the response envelope convention.' },
        components: {
          securitySchemes: {
            cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token' },
          },
        },
        security: [{ cookieAuth: [] }],
      },
    });
    server.register(swaggerUi, { routePrefix: '/docs' });
  }

  server.register(moduleGate);

  // Multipart file upload (capped at 15MB per ADR-003)
  server.register(multipart, {
    limits: {
      fileSize: 15 * 1024 * 1024,
    },
  });

  // Global defensive error handler (OWASP A05 - Prevent sensitive information leakage)
  server.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error, reqId: request.id }, 'Unhandled request error');

    // Prisma unique-violation safety net: concurrent creates that race past
    // application checks surface as 409, never 500.
    if ((error as any)?.code === 'P2002') {
      const target = (JSON.stringify((error as any)?.meta ?? '') + ' ' + String((error as any)?.message ?? '')).toLowerCase();
      const isPaymentRef = target.includes('reference') || target.includes('invoicepayment') || target.includes('invoice_payments');
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        code: isPaymentRef ? 'DUPLICATE_PAYMENT_REFERENCE' : 'DUPLICATE_RECORD',
        message: isPaymentRef
          ? 'A payment with this reference has already been recorded'
          : 'A record with these unique fields already exists',
      });
    }

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

  // Central route authorization (permission map + project membership)
  registerAuthorizationGuards(server);

  // Application Routes
  server.register(fileRoutes);
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
  server.register(invoicesRoutes);
  server.register(certificatesRoutes);
  server.register(commitmentsRoutes);
  server.register(announcementsRoutes);
  server.register(inboxRoutes);
  server.register(observationsRoutes);
  server.register(crewsRoutes);
  server.register(companyDocumentsRoutes);
  server.register(correspondenceRoutes);
  server.register(scheduledReportsRoutes);
  server.register(attendanceRoutes);
  server.register(checklistsRoutes);
  server.register(integrationRoutes);
  server.register(meRoutes);
  server.register(clientPaymentNoticeRoutes);
  server.register(procurementRoutes);
  server.register(operatorRoutes);

  // Readiness probe: /health is liveness; /ready proves the DB is reachable.
  server.get('/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.status(200).send({ status: 'ready', timestamp: new Date().toISOString() });
    } catch {
      return reply.status(503).send({ status: 'not_ready' });
    }
  });

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
