import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, withTenantTx } from '@construction/db';
import { Permission, Permissions, Role, Roles } from '@construction/permissions';
import { requirePermission } from './rbac';

/**
 * Central route authorization (audit C-01 follow-up).
 *
 * Every authenticated route must resolve to exactly one of:
 *  1. An inline `requirePermission(...)` in its route options (existing style), or
 *  2. An entry in ROUTE_PERMISSIONS below (applied centrally via onRoute), or
 *  3. An entry in SELF_SERVICE_ALLOWLIST (authenticated but permission-exempt,
 *     each with a justification).
 *
 * Project-scoped routes (`/api/v1/projects/:projectId/...` and
 * `/api/v1/projects/:id`) additionally require project membership for any
 * role that is not tenant-wide, enforced by requireProjectMembership.
 */

// ---------------------------------------------------------------------------
// Permission map for routes that authenticate but declare no inline guard.
// Key: "METHOD /path". Keep in sync with route-guard.test.ts.
// ---------------------------------------------------------------------------
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  // Announcements
  'GET /api/v1/announcements': Permissions.REPORT_VIEW,

  // Certificates & closeout
  
  // Client project requests — staff listing
  'GET /api/v1/client/project-requests': Permissions.PROJECT_VIEW,

  // Commercial operations
  'GET /api/v1/projects/:projectId/material-requisitions': Permissions.COST_VIEW,
  'POST /api/v1/projects/:projectId/material-requisitions': Permissions.COST_CREATE,
  'PATCH /api/v1/projects/:projectId/material-requisitions/:requisitionId': Permissions.COST_APPROVE,
  'GET /api/v1/projects/:projectId/material-wastage': Permissions.COST_VIEW,
  'POST /api/v1/projects/:projectId/material-wastage': Permissions.COST_CREATE,
  'GET /api/v1/projects/:projectId/cash-flow': Permissions.COST_VIEW,
  'POST /api/v1/projects/:projectId/cash-flow': Permissions.COST_CREATE,
  'GET /api/v1/projects/:projectId/subcontractor-valuations': Permissions.COST_VIEW,
  'POST /api/v1/projects/:projectId/subcontractor-valuations': Permissions.COST_CREATE,
  'PATCH /api/v1/projects/:projectId/subcontractor-valuations/:valuationId': Permissions.COST_APPROVE,

  // Commitments / payment applications
  
  // Company
  'GET /api/v1/company/members': Permissions.COMPANY_INVITE,

  // Contract claims (delay events, tax certificates)
  'POST /api/v1/projects/:projectId/delay-events': Permissions.PROGRESS_RECORD,
  'GET /api/v1/projects/:projectId/delay-events': Permissions.COST_VIEW,
  'PUT /api/v1/projects/:projectId/delay-events/:id/review': Permissions.COST_APPROVE,
  'POST /api/v1/projects/:projectId/tax-certificates': Permissions.COST_CREATE,
  'GET /api/v1/projects/:projectId/tax-certificates': Permissions.COST_VIEW,
  'PUT /api/v1/projects/:projectId/tax-certificates/:id/remit': Permissions.COST_APPROVE,

  // Enterprise operations
  'GET /api/v1/projects/:projectId/etims-invoices': Permissions.INVOICE_VIEW,
  'POST /api/v1/projects/:projectId/etims-invoices': Permissions.INVOICE_CREATE,
  'GET /api/v1/projects/:projectId/subcontractor-tcc': Permissions.COST_VIEW,
  'POST /api/v1/projects/:projectId/subcontractor-tcc': Permissions.COST_CREATE,
  'GET /api/v1/projects/:projectId/site-webhook-logs': Permissions.REPORT_VIEW,
  'GET /api/v1/projects/:projectId/site-alerts': Permissions.REPORT_VIEW,
  'POST /api/v1/projects/:projectId/site-alerts': Permissions.ANNOUNCEMENT_MANAGE,
  'GET /api/v1/projects/:projectId/subcontractor-retention-releases': Permissions.COST_VIEW,
  'POST /api/v1/projects/:projectId/subcontractor-retention-releases': Permissions.COST_CREATE,
  'POST /api/v1/projects/:projectId/subcontractor-retention-releases/:releaseId/review': Permissions.COST_APPROVE,
  'GET /api/v1/projects/:projectId/contractor-bonds': Permissions.COST_VIEW,
  'POST /api/v1/projects/:projectId/contractor-bonds': Permissions.COST_CREATE,

  // Integrations
    
  // Lifecycle: RFIs
  'GET /api/v1/projects/:projectId/rfis': Permissions.PROJECT_VIEW,
  'POST /api/v1/projects/:projectId/rfis': Permissions.PROGRESS_RECORD,
  'POST /api/v1/projects/:projectId/rfis/:rfiId/responses': Permissions.PROGRESS_RECORD,
  'POST /api/v1/projects/:projectId/rfis/:rfiId/close': Permissions.PROGRESS_RECORD,

  // Lifecycle: inspections & cube tests
  'GET /api/v1/projects/:projectId/inspections': Permissions.INSPECTION_VIEW,
  'POST /api/v1/projects/:projectId/inspections': Permissions.INSPECTION_REQUEST,
  'PUT /api/v1/projects/:projectId/inspections/:id/items/:itemId': Permissions.INSPECTION_SUBMIT,
  'GET /api/v1/projects/:projectId/cube-tests': Permissions.INSPECTION_VIEW,
  'POST /api/v1/projects/:projectId/cube-tests': Permissions.INSPECTION_SUBMIT,
  'POST /api/v1/projects/:projectId/cube-tests/:id/breaks': Permissions.INSPECTION_SUBMIT,

  // Lifecycle: snags
  'GET /api/v1/projects/:projectId/snags': Permissions.SITE_DIARY_VIEW,
  'GET /api/v1/projects/:projectId/snags/export': Permissions.REPORT_VIEW,
  'POST /api/v1/projects/:projectId/snags': Permissions.SITE_DIARY_CREATE,
  'PUT /api/v1/projects/:projectId/snags/:snagId/status': Permissions.PROGRESS_RECORD,
  'GET /api/v1/projects/:projectId/snags/:snagId': Permissions.SITE_DIARY_VIEW,
  'POST /api/v1/projects/:projectId/snags/:snagId/comments': Permissions.SITE_DIARY_CREATE,
  'POST /api/v1/projects/:projectId/snags/:snagId/distributions': Permissions.PROGRESS_RECORD,

  // Lifecycle: certificates
  'GET /api/v1/projects/:projectId/certificates': Permissions.REPORT_VIEW,
  'POST /api/v1/projects/:projectId/certificates': Permissions.CERTIFICATE_MANAGE,

  // Operations: tasks, inventory, safety, documents, subcontractors
  'GET /api/v1/projects/:projectId/tasks': Permissions.SITE_DIARY_VIEW,
  'POST /api/v1/projects/:projectId/tasks': Permissions.PROGRESS_RECORD,
  'PUT /api/v1/projects/:projectId/tasks/:taskId': Permissions.PROGRESS_RECORD,
  'GET /api/v1/projects/:projectId/inventory': Permissions.COST_VIEW,
  'POST /api/v1/projects/:projectId/inventory/items': Permissions.COST_CREATE,
  'POST /api/v1/projects/:projectId/inventory/movements': Permissions.COST_CREATE,
  'GET /api/v1/projects/:projectId/safety-incidents': Permissions.SITE_DIARY_VIEW,
  'POST /api/v1/projects/:projectId/safety-incidents': Permissions.SITE_DIARY_CREATE,
  'GET /api/v1/projects/:projectId/documents': Permissions.REPORT_VIEW,
  'POST /api/v1/projects/:projectId/documents': Permissions.DOCUMENT_MANAGE,
  'GET /api/v1/projects/:projectId/subcontractors': Permissions.PROJECT_VIEW,
  'POST /api/v1/projects/:projectId/subcontractors': Permissions.COST_CREATE,
  'PATCH /api/v1/projects/:projectId/subcontractors/:packageId': Permissions.COST_APPROVE,

  // Drawing annotations
  'GET /api/v1/projects/:projectId/documents/:documentId/annotations': Permissions.REPORT_VIEW,
  'POST /api/v1/projects/:projectId/documents/:documentId/annotations': Permissions.DOCUMENT_MANAGE,
  'PATCH /api/v1/projects/:projectId/documents/:documentId/annotations/:annotationId': Permissions.DOCUMENT_MANAGE,

  // Platform services: billing
  'POST /api/v1/billing/mpesa-express': Permissions.COMPANY_MANAGE,
  'GET /api/v1/billing/transactions': Permissions.COMPANY_MANAGE,

  // Platform services: geofence & clock
  'GET /api/v1/projects/:projectId/geofences': Permissions.SITE_DIARY_VIEW,
  'POST /api/v1/projects/:projectId/geofences': Permissions.SITE_DIARY_CREATE,
  'POST /api/v1/projects/:projectId/clock-in': Permissions.SITE_DIARY_CREATE,
  'GET /api/v1/projects/:projectId/clock-events': Permissions.SITE_DIARY_VIEW,

  // Platform services: telematics / plant
  'GET /api/v1/projects/:projectId/telematics-devices': Permissions.COST_VIEW,
    'GET /api/v1/projects/:projectId/telematics-pings': Permissions.COST_VIEW,
    'GET /api/v1/projects/:projectId/maintenance-alerts': Permissions.COST_VIEW,
  
  // Platform services: BBS / steel / concrete / surveys
  'POST /api/v1/projects/:projectId/bar-bending-schedules': Permissions.BOQ_EDIT,
  'GET /api/v1/projects/:projectId/bar-bending-schedules': Permissions.BOQ_VIEW,
  'GET /api/v1/projects/:projectId/bar-bending-schedules/:scheduleId': Permissions.BOQ_VIEW,
  'PATCH /api/v1/projects/:projectId/bar-bending-schedules/:scheduleId/status': Permissions.BOQ_EDIT,
  'POST /api/v1/projects/:projectId/b2c-disburse': Permissions.COST_APPROVE,
  'POST /api/v1/projects/:projectId/b2c-disbursements/:id/approve': Permissions.COST_APPROVE,
  'POST /api/v1/projects/:projectId/b2c-disbursements/:id/reject': Permissions.COST_APPROVE,
  'GET /api/v1/projects/:projectId/b2c-disbursements': Permissions.COST_VIEW,
  'POST /api/v1/projects/:projectId/rmc-deliveries': Permissions.PROGRESS_RECORD,
  'GET /api/v1/projects/:projectId/rmc-deliveries': Permissions.PROGRESS_VIEW,
  'POST /api/v1/projects/:projectId/rmc-deliveries/:deliveryId/slump-tests': Permissions.PROGRESS_RECORD,
  'PATCH /api/v1/projects/:projectId/rmc-deliveries/:deliveryId/discharge': Permissions.PROGRESS_RECORD,
  'POST /api/v1/projects/:projectId/structural-steel-takeoffs': Permissions.BOQ_EDIT,
  'GET /api/v1/projects/:projectId/structural-steel-takeoffs': Permissions.BOQ_VIEW,
  'GET /api/v1/projects/:projectId/structural-steel-takeoffs/:takeoffId': Permissions.BOQ_VIEW,
  'PATCH /api/v1/projects/:projectId/structural-steel-takeoffs/:takeoffId/status': Permissions.BOQ_EDIT,
    'GET /api/v1/projects/:projectId/soil-tests': Permissions.PROGRESS_VIEW,
    'GET /api/v1/projects/:projectId/asphalt-batches': Permissions.PROGRESS_VIEW,
      'GET /api/v1/projects/:projectId/topographic-surveys': Permissions.PROGRESS_VIEW,
  'GET /api/v1/projects/:projectId/topographic-surveys/:surveyId': Permissions.PROGRESS_VIEW,

  // Platform services: independent inspections
  'POST /api/v1/projects/:projectId/independent-inspections': Permissions.INSPECTION_REQUEST,
  'GET /api/v1/projects/:projectId/independent-inspections': Permissions.INSPECTION_VIEW,
  'GET /api/v1/projects/:projectId/independent-inspections/:inspectionId': Permissions.INSPECTION_VIEW,
    'POST /api/v1/projects/:projectId/independent-inspections/:inspectionId/notify-client': Permissions.INSPECTION_REVIEW,
  'PATCH /api/v1/projects/:projectId/independent-inspections/:inspectionId/client-review': Permissions.INSPECTION_REVIEW,

  // Platform services: tenders
    'GET /api/v1/projects/:projectId/tenders': Permissions.TENDER_VIEW,
  'POST /api/v1/projects/:projectId/tenders/:tenderId/bids': Permissions.TENDER_BID,
  'GET /api/v1/projects/:projectId/tenders/:tenderId/bids': Permissions.TENDER_VIEW,
  
  // Site operations: equipment, laborers, muster rolls, safety audits
  'GET /api/v1/projects/:projectId/equipment': Permissions.SITE_DIARY_VIEW,
  'POST /api/v1/projects/:projectId/equipment': Permissions.SITE_DIARY_CREATE,
  'POST /api/v1/projects/:projectId/equipment-logs': Permissions.SITE_DIARY_CREATE,
  'GET /api/v1/projects/:projectId/laborers': Permissions.SITE_DIARY_VIEW,
  'POST /api/v1/projects/:projectId/laborers': Permissions.SITE_DIARY_CREATE,
  'GET /api/v1/projects/:projectId/muster-rolls': Permissions.SITE_DIARY_VIEW,
  'POST /api/v1/projects/:projectId/muster-rolls': Permissions.SITE_DIARY_CREATE,
  'PATCH /api/v1/projects/:projectId/muster-rolls/:musterRollId': Permissions.PROGRESS_RECORD,
  'GET /api/v1/projects/:projectId/safety-audits': Permissions.SITE_DIARY_VIEW,
  'POST /api/v1/projects/:projectId/safety-audits': Permissions.SITE_DIARY_CREATE,

  // Variations review
  };

// ---------------------------------------------------------------------------
// Authenticated routes that intentionally carry no permission check.
// Every entry MUST justify itself — the guard test enforces honesty.
// ---------------------------------------------------------------------------
export const SELF_SERVICE_ALLOWLIST: Record<string, string> = {
  'POST /api/v1/auth/logout': 'Ends the caller\u2019s own session',
  'GET /api/v1/auth/me': 'Returns the caller\u2019s own profile',
  'PATCH /api/v1/auth/me': 'Self-service profile update (name/phone/country)',
  'POST /api/v1/announcements/:id/read': 'Per-user read acknowledgement',
  'GET /api/v1/dashboard': 'Caller-scoped dashboard aggregate',
  'GET /api/v1/company': 'Tenant profile read for any authenticated member',
  'POST /api/v1/client/project-requests': 'Client self-service intake; CLIENT role enforced in-handler',
  'GET /api/v1/client/quotes': 'Returns only quotes addressed to the caller',
  'POST /api/v1/client/quotes/:id/respond': 'Client accept/decline on own quote (e-signature in-handler)',
  'GET /api/v1/billing/subscription-status': 'Caller\u2019s tenant subscription status',
};

// ---------------------------------------------------------------------------
// Authenticated routes whose handlers perform their own fine-grained
// authorization (action-based permission checks or role gates). Listed here so
// the guard test can verify coverage without double-guarding.
// ---------------------------------------------------------------------------
export const IN_HANDLER_GUARDED: Record<string, string> = {
  'POST /api/v1/projects/:projectId/payment-certificates/:certId/action': 'Handler maps action -> CERTIFICATE_MANAGE/approve permission',
  'POST /api/v1/projects/:projectId/commitments/:commitmentId/applications/:applicationId/action': 'Handler maps application action -> permission check',
  'POST /api/v1/projects/:projectId/variations/:variationId/review': 'Handler maps action -> VARIATION_APPROVE/REVIEW per ADR-010',
  'GET /api/v1/integrations/status': 'Handler restricts to COMPANY_ADMIN',
  'POST /api/v1/integrations/test': 'Handler restricts to COMPANY_ADMIN',
  'POST /api/v1/projects/:projectId/telematics-devices': 'Handler role-gates (CLIENT read-only)',
  'POST /api/v1/projects/:projectId/canbus-devices': 'Handler role-gates (CLIENT read-only)',
  'PATCH /api/v1/projects/:projectId/maintenance-alerts/:alertId/acknowledge': 'Handler role-gates (CLIENT read-only)',
  'POST /api/v1/projects/:projectId/soil-tests': 'Handler role-gates (CLIENT read-only)',
  'POST /api/v1/projects/:projectId/asphalt-batches': 'Handler role-gates (CLIENT read-only)',
  'PATCH /api/v1/projects/:projectId/asphalt-batches/:batchId/core-test': 'Handler role-gates (CLIENT read-only)',
  'POST /api/v1/projects/:projectId/topographic-surveys': 'Handler role-gates (CLIENT read-only)',
  'PATCH /api/v1/projects/:projectId/independent-inspections/:inspectionId/submit': 'Handler role-gates + inspection.submit permission',
  'POST /api/v1/projects/:projectId/tenders': 'Handler role-gates tender creation',
  'PATCH /api/v1/projects/:projectId/tenders/:tenderId/bids/:bidId/award': 'Handler role-gates tender award',
};

// Roles that see every project in the tenant without a ProjectMember row.
const TENANT_WIDE_ROLES = new Set<Role>([Roles.COMPANY_ADMIN, Roles.ADMIN, Roles.EXECUTIVE]);

const PROJECT_PATH_RE = /\/api\/v1\/projects\/(?::projectId|:id)\//;
const PROJECT_DETAIL_RE = /^\/api\/v1\/projects\/:id$/;

/** preHandler: caller must be a member of :projectId unless tenant-wide. */
export async function requireProjectMembership(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user?.role || TENANT_WIDE_ROLES.has(user.role as Role)) return;
  const params = request.params as Record<string, string>;
  const projectId = params.projectId ?? params.id;
  // Non-UUID ids are rejected by the handler's own 404 validation.
  if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) return;
  // Forged/legacy tokens with non-UUID subs can't be members — let the
  // handler's own tenant scoping produce its 404.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.sub)) return;
  const { member, projectExists } = await withTenantTx(prisma, user.tenantId, async (tx) => {
    const [member, project] = await Promise.all([
      tx.projectMember.findFirst({
        where: { project_id: projectId, user_id: user.sub },
        select: { id: true },
      }),
      tx.project.findUnique({ where: { id: projectId }, select: { id: true } }),
    ]);
    return { member, projectExists: !!project };
  });
  // Nonexistent project → let the handler return its own 404.
  if (!projectExists) return;
  if (!member) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'You are not a member of this project',
    });
  }
}

/**
 * Installs central authorization via Fastify's onRoute hook. Must be called
 * BEFORE route plugins are registered so the hook sees every route.
 */
export function registerAuthorizationGuards(server: FastifyInstance) {
  server.addHook('onRoute', (routeOptions) => {
    const methods = Array.isArray(routeOptions.method) ? routeOptions.method : [routeOptions.method];
    const guards: any[] = [];

    for (const method of methods) {
      const key = `${String(method).toUpperCase()} ${routeOptions.url}`;
      const perm = ROUTE_PERMISSIONS[key];
      if (perm) guards.push(requirePermission(perm));
    }

    const isProjectScoped = PROJECT_PATH_RE.test(routeOptions.url) || PROJECT_DETAIL_RE.test(routeOptions.url);
    if (isProjectScoped) guards.push(requireProjectMembership);

    if (guards.length === 0) return;
    const existing = routeOptions.preHandler;
    const existingArr = existing == null ? [] : Array.isArray(existing) ? existing : [existing];
    routeOptions.preHandler = [...existingArr, ...guards];
  });
}
