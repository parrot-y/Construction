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
  return request.post(`${API}${path}`, {
    headers: { ...authHeaders(session), ...extraHeaders },
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
