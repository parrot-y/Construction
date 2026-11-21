import { randomUUID } from 'node:crypto';
import { APIRequestContext, expect } from '@playwright/test';

export const API = process.env.E2E_API_URL || 'http://localhost:4199';

export interface Session {
  cookie: string;
  user: any;
  tenantId: string;
}

/** Log in through the real auth endpoint; returns the session cookie header. */
export async function login(request: APIRequestContext, email: string, password = 'Password123!'): Promise<Session> {
  const res = await request.post(`${API}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(res.status(), `login ${email}`).toBe(200);
  const body = await res.json();
  const setCookie = res.headers()['set-cookie'] || '';
  // Fastify may emit multiple Set-Cookie headers; Playwright joins them.
  const cookie = setCookie.split(/,(?=[^;]+=)/).map((c) => c.split(';')[0]).join('; ');
  return { cookie, user: body.user, tenantId: body.user.tenant.id };
}

export function authHeaders(session: Session): Record<string, string> {
  return { Cookie: session.cookie, 'Content-Type': 'application/json' };
}

/** Unwrap the common { data: ... } / { invoice: ... } response envelopes. */
export function unwrap(body: any): any {
  if (body && typeof body === 'object' && 'data' in body && body.data !== undefined) return body.data;
  return body;
}

export async function apiGet(request: APIRequestContext, session: Session, path: string) {
  return request.get(`${API}${path}`, { headers: authHeaders(session) });
}

export async function apiPost(request: APIRequestContext, session: Session, path: string, data?: any, extraHeaders: Record<string, string> = {}) {
  // Payment recording requires an Idempotency-Key (Stage-7). Specs that don't
  // set one get a fresh key per call — same semantics as before for them.
  const headers = { ...authHeaders(session), ...extraHeaders };
  if (path.includes('/payments') && !headers['idempotency-key'] && !headers['Idempotency-Key']) {
    headers['idempotency-key'] = randomUUID();
  }
  return request.post(`${API}${path}`, {
    headers,
    data,
  });
}

export async function apiPatch(request: APIRequestContext, session: Session, path: string, data?: any) {
  return request.patch(`${API}${path}`, { headers: authHeaders(session), data });
}

/** Pick the first project visible to a session. */
export async function firstProjectId(request: APIRequestContext, session: Session): Promise<string> {
  const res = await apiGet(request, session, '/api/v1/projects');
  expect(res.status()).toBe(200);
  const body = await res.json();
  const rows = Array.isArray(body) ? body : body.projects || body.data || [];
  expect(rows.length, 'seeded tenant must have at least one project').toBeGreaterThan(0);
  // Prefer the seeded demo project — it carries ProjectMember rows for every
  // seeded role; ad-hoc projects created by earlier runs may not.
  const seeded = rows.find((p: any) => /riverside/i.test(p.name || '')) || rows[0];
  return seeded.id;
}

/**
 * Clean demo names for e2e fixtures — visible names stay realistic
 * ("Kilimani Apartments"); uniqueness lives in codes/refs/emails.
 * Deterministic per salt so chromium/mobile runs pick varied names.
 */
const FIXTURE_NAME_POOLS = {
  project: ['Kilimani Apartments','Runda Residence','Lavington Court','Karen Bungalow','Westlands Plaza','Ruaka Townhouses','Kileleshwa Villas','Embakasi Warehouse','Kitisuru Gardens','Muthaiga Court'],
  company: ['Meridian Build Ltd','Savannah Construction Ltd','Highland Developers Ltd','Coastline Builders Ltd','Rift Valley Contractors Ltd','Acacia Homes Ltd'],
  supplier: ['East Africa Cement Suppliers','Savannah Timber & Boards','Nyali Steel & Roofing','Mombasa Hardware & Paints','Nakuru Aggregate Supplies','Tatu City Concrete Works'],
  subcontractor: ['FlowFit Mechanical Services','Kijani Electrical Contractors','PaveRight Asphalt Ltd','AquaLine Plumbing Services','SafeSite Scaffolding Ltd','BuildRight Masonry Ltd'],
  client: ['Nyambane Properties','Tatu City Logistics','Delta Freight Ltd','Savannah Holdings','Highland Property Group'],
  quote: ['Family Home Extension','Office Fit-Out Phase 1','Warehouse Expansion','School Block Renovation','Apartment Block Fit-Out','Retail Unit Refurbishment'],
  invoice: ['Progress claim — superstructure','Final account — external works','Variation account — additional piling','Stage payment — façade works','Interim valuation — ground floor'],
  variation: ['Additional piling to bedrock','Client-added ensuite bathrooms','Upgraded roof insulation','Extended stormwater drainage','Additional parking bays'],
  changeorder: ['Client-requested stone cladding','Additional canopy over main entrance','Upgraded flooring specification','Extra security lighting'],
  rfi: ['Clarification on foundation depth','Roof pitch dimension query','Door schedule discrepancy'],
  package: ['Plumbing first-fix package','Electrical first-fix package','Waterproofing package'],
  generic: ['River sand (plaster grade)','Ballast 20mm','Y12 reinforcement bar','Cement 50kg (Bamburi)','Plywood shuttering 18mm','Hardwood props 100x100'],
} as const;
export type FixtureKind = keyof typeof FIXTURE_NAME_POOLS;
export function fixtureName(kind: FixtureKind, salt: string | number): string {
  const pool = FIXTURE_NAME_POOLS[kind];
  const s = String(salt);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return pool[(h >>> 0) % pool.length]!;
}
