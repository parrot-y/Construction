import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROUTE_PERMISSIONS, SELF_SERVICE_ALLOWLIST, IN_HANDLER_GUARDED } from './plugins/routeAuthorization';

/**
 * C-01 (Claude audit): CI guard — every registered API route must either
 * declare `server.authenticate` in its route options, or appear in the
 * explicit UNAUTHENTICATED_ALLOWLIST below with a justification.
 *
 * This is a static scan of apps/api/src/routes/*.ts so it fails fast in CI
 * the moment someone adds a route without an auth guard.
 */

const ROUTES_DIR = join(__dirname, 'routes');

/**
 * Routes intentionally reachable without a JWT session. Each entry must
 * justify itself: token-scoped lookups, provider callbacks, or the login
 * endpoint itself. Anything else MUST use server.authenticate.
 */
const UNAUTHENTICATED_ALLOWLIST: Record<string, string> = {
  'POST /api/v1/auth/login': 'Credential exchange — issues the session',
  'POST /api/v1/auth/refresh': 'Refresh-token rotation via refresh cookie',
  'POST /api/v1/auth/logout': 'Clears session cookies — safe unauthenticated',
  'POST /api/v1/webhooks/site-ops': 'HMAC-signed site-ops webhook (verified in-handler)',
  'GET /api/v1/portals/validate/:token': 'Token-scoped external portal validation',
  'GET /api/v1/portals/consultant/:token': 'Token-scoped consultant portal',
  'POST /api/v1/portals/consultant/:token/rfis/:rfiId/reply': 'Token-scoped consultant reply',
  'GET /api/v1/portals/subcontractor/:token': 'Token-scoped subcontractor portal',
  'POST /api/v1/portals/subcontractor/:token/snags/:snagId/rectify': 'Token-scoped snag reply',
  'GET /api/v1/portals/supplier/:token': 'Token-scoped supplier portal',
  'GET /api/v1/portals/compliance/:token': 'Token-scoped compliance portal',
  'GET /api/v1/portals/client/:token/change-orders': 'Token-scoped client CO approval list (ADR-010)',
  'POST /api/v1/portals/client/:token/change-orders/:coId/respond': 'Token-scoped client CO approval (ADR-010)',
  'POST /api/v1/invitations/accept': 'Invitation token acceptance flow',
  'POST /api/v1/billing/mpesa-callback': 'Safaricom Daraja STK callback (checkout-request-id lookup)',
  'POST /api/v1/billing/mpesa-b2c-callback': 'Safaricom Daraja B2C callback (result lookup)',
  'POST /api/v1/telematics/ping': 'Device ingest endpoint (device-token auth in-handler)',
  'POST /api/v1/telematics/canbus-ping': 'Device ingest endpoint (device-token auth in-handler)',
  'GET /api/public/quotes/:token': 'Public quote share link (SHA-256 hashed token + rate limit)',
  'POST /api/public/quotes/:token/respond': 'Public quote share link response (SHA-256 hashed token + rate limit)',
};

interface RouteRegistration {
  method: string;
  path: string;
  file: string;
  hasAuthenticate: boolean;
  hasPermissionGuard: boolean;
}

function scanRoutes(): RouteRegistration[] {
  const routes: RouteRegistration[] = [];
  const methodRe = /server\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;

  for (const file of readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(join(ROUTES_DIR, file), 'utf8');
    for (const m of src.matchAll(methodRe)) {
      const method = (m[1] ?? '').toUpperCase();
      const path = m[2] ?? '';
      // Options object sits between the path and the handler signature.
      const rest = src.slice((m.index ?? 0) + m[0].length);
      const handlerIdx = rest.indexOf('async (request');
      const optionsSegment = handlerIdx === -1 ? rest.slice(0, 900) : rest.slice(0, handlerIdx);
      routes.push({
        method,
        path,
        file,
        hasAuthenticate: optionsSegment.includes('authenticate'),
        hasPermissionGuard:
          optionsSegment.includes('requirePermission') ||
          optionsSegment.includes('requireAnyPermission') ||
          optionsSegment.includes('requireProjectMembership'),
      });
    }
  }
  return routes;
}

describe('C-01: Route authentication guard coverage', () => {
  const routes = scanRoutes();

  it('discovers a plausible number of routes (scan is not silently empty)', () => {
    expect(routes.length).toBeGreaterThan(100);
  });

  it('every route either authenticates or is explicitly allowlisted', () => {
    const violations = routes
      .filter((r) => !r.hasAuthenticate && !UNAUTHENTICATED_ALLOWLIST[`${r.method} ${r.path}`])
      .map((r) => `${r.method} ${r.path} (${r.file})`);
    expect(violations).toEqual([]);
  });

  it('allowlist contains no stale entries (route still exists and is still unauthenticated)', () => {
    const registered = new Set(routes.map((r) => `${r.method} ${r.path}`));
    const stale = Object.keys(UNAUTHENTICATED_ALLOWLIST).filter((key) => !registered.has(key));
    expect(stale).toEqual([]);
  });

  it('allowlisted routes remain unauthenticated (guard not silently added without list update)', () => {
    // If someone adds server.authenticate to an allowlisted route, they must
    // also remove it from the allowlist — this keeps the list honest.
    const authenticatedAllowlisted = routes
      .filter((r) => r.hasAuthenticate && UNAUTHENTICATED_ALLOWLIST[`${r.method} ${r.path}`])
      .map((r) => `${r.method} ${r.path}`);
    expect(authenticatedAllowlisted).toEqual([]);
  });
});


/**
 * C-01b (Claude audit): permission coverage — every authenticated route must
 * declare requirePermission inline, appear in ROUTE_PERMISSIONS (applied via
 * the central onRoute guard), or be explicitly self-service allowlisted.
 */
describe('C-01b: Route permission coverage', () => {
  const routes = scanRoutes();

  it('every authenticated route has a permission guard, map entry, or self-service justification', () => {
    const violations = routes
      .filter((r) => {
        if (!r.hasAuthenticate) return false; // covered by C-01 allowlist
        const key = `${r.method} ${r.path}`;
        return (
          !r.hasPermissionGuard &&
          !ROUTE_PERMISSIONS[key] &&
          !SELF_SERVICE_ALLOWLIST[key] &&
          !IN_HANDLER_GUARDED[key]
        );
      })
      .map((r) => `${r.method} ${r.path} (${r.file})`);
    expect(violations).toEqual([]);
  });

  it('ROUTE_PERMISSIONS contains no stale entries', () => {
    const registered = new Set(routes.map((r) => `${r.method} ${r.path}`));
    const stale = Object.keys(ROUTE_PERMISSIONS).filter((k) => !registered.has(k));
    expect(stale).toEqual([]);
  });

  it('IN_HANDLER_GUARDED contains no stale entries', () => {
    const registered = new Set(routes.map((r) => `${r.method} ${r.path}`));
    const stale = Object.keys(IN_HANDLER_GUARDED).filter((k) => !registered.has(k));
    expect(stale).toEqual([]);
  });

  it('SELF_SERVICE_ALLOWLIST contains no stale entries', () => {
    const registered = new Set(routes.map((r) => `${r.method} ${r.path}`));
    const stale = Object.keys(SELF_SERVICE_ALLOWLIST).filter((k) => !registered.has(k));
    expect(stale).toEqual([]);
  });
});
