#!/usr/bin/env node
/**
 * Visual evidence capture — seeds nothing itself; uses the already-seeded
 * demo tenant (Apex Builders Kenya Ltd / Riverside Commercial Plaza) and the
 * five external portal links created via the API, then screenshots:
 *
 *   - 5 portals  (consultant, subcontractor, supplier, compliance, client)
 *   - 5 console roles (COMPANY_ADMIN, PM_QS, SITE_SUPERVISOR, CLIENT, VIEWER)
 *
 * at 390px and 1440px into docs/evidence/visual/<sha>/.
 *
 * Usage:
 *   node capture-visual.mjs [output-dir]
 * Env: E2E_API_URL (default http://localhost:4199), E2E_WEB_URL (default
 * http://localhost:5180), VISUAL_PASSWORD (default Password123!).
 * Requires the e2e webServers (API + vite) to be running.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const API = process.env.E2E_API_URL || 'http://localhost:4199';
const WEB = process.env.E2E_WEB_URL || 'http://localhost:5180';
const PASSWORD = process.env.VISUAL_PASSWORD || 'Password123!';
const SHA = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const OUT = process.argv[2] || `../docs/evidence/visual/${SHA}`;

const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

mkdirSync(OUT, { recursive: true });

// ---------- API helpers ----------
async function apiLogin(request, email) {
  const res = await request.post(`${API}/api/v1/auth/login`, {
    data: { email, password: PASSWORD },
  });
  if (!res.ok()) throw new Error(`login ${email}: ${res.status()} ${await res.text()}`);
  return res;
}

function cookiesFrom(res, webUrl) {
  const host = new URL(webUrl).hostname;
  return res.headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => {
      const [pair] = h.value.split(';');
      const eq = pair.indexOf('=');
      return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain: host, path: '/' };
    });
}

async function apiGet(request, cookieHeader, path) {
  const res = await request.get(`${API}${path}`, { headers: { cookie: cookieHeader } });
  if (!res.ok()) throw new Error(`GET ${path}: ${res.status()} ${await res.text()}`);
  return res.json();
}

async function apiPost(request, cookieHeader, path, data) {
  const res = await request.post(`${API}${path}`, { headers: { cookie: cookieHeader }, data });
  if (!res.ok()) throw new Error(`POST ${path}: ${res.status()} ${await res.text()}`);
  return res.json();
}

const unwrap = (j) => j?.data ?? j;

// ---------- main ----------
const browser = await chromium.launch();
const request = await (await import('@playwright/test')).request.newContext();

// Admin session for API-driven setup (portal links, project id).
const adminRes = await apiLogin(request, 'admin@apexbuilders.co.ke');
const adminCookies = cookiesFrom(adminRes, WEB);
const adminCookieHeader = adminCookies.map((c) => `${c.name}=${c.value}`).join('; ');

const projects = unwrap(await apiGet(request, adminCookieHeader, '/api/v1/projects'));
const projectId = (Array.isArray(projects) ? projects : projects.projects || projects.data || [])[0]?.id;
if (!projectId) throw new Error('No seeded project found — run prisma seed first');

// Resolve subcontractor package + supplier ids for scoped portal links.
let subcontractorPackageId = null;
let supplierId = null;
try {
  const subs = unwrap(await apiGet(request, adminCookieHeader, `/api/v1/projects/${projectId}/subcontractors`));
  const first = (Array.isArray(subs) ? subs : subs.packages || subs.data || [])[0];
  subcontractorPackageId = first?.id ?? first?.package?.id ?? null;
} catch (e) { console.warn('subcontractor list failed:', e.message); }
try {
  const suppliers = unwrap(await apiGet(request, adminCookieHeader, '/api/v1/suppliers'));
  const first = (Array.isArray(suppliers) ? suppliers : suppliers.suppliers || suppliers.data || [])[0];
  supplierId = first?.id ?? null;
} catch (e) { console.warn('supplier list failed:', e.message); }

// Create one link per portal type.
const PORTAL_TYPES = ['CONSULTANT', 'SUBCONTRACTOR', 'SUPPLIER', 'COMPLIANCE', 'CLIENT'];
const tokens = {};
for (const type of PORTAL_TYPES) {
  const payload = {
    portalType: type,
    stakeholderName: `Visual Evidence ${type}`,
    expiresInDays: 7,
    ...(type === 'SUBCONTRACTOR' && subcontractorPackageId ? { subcontractorPackageId } : {}),
    ...(type === 'SUPPLIER' && supplierId ? { supplierId } : {}),
  };
  try {
    const link = unwrap(await apiPost(request, adminCookieHeader, `/api/v1/projects/${projectId}/portals/links`, payload));
    tokens[type.toLowerCase()] = link.token || link.rawToken;
    if (!tokens[type.toLowerCase()]) console.warn(`${type}: no token in response`, link);
  } catch (e) {
    console.warn(`${type} link failed:`, e.message);
  }
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log('  ✓', name);
}

async function settle(page) {
  // Let lazy chunks + data fetches land before capture.
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
}

const CONSOLE_ROLES = [
  { key: 'admin', email: 'admin@apexbuilders.co.ke' },
  { key: 'pm-qs', email: 'qs@apexbuilders.co.ke' },
  { key: 'supervisor', email: 'supervisor@apexbuilders.co.ke' },
  { key: 'client', email: 'client@apexbuilders.co.ke' },
  { key: 'viewer', email: 'viewer@apexbuilders.co.ke' },
];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });

  // --- external portals (token links, no login) ---
  for (const [type, token] of Object.entries(tokens)) {
    if (!token) continue;
    const page = await context.newPage();
    try {
      await page.goto(`${WEB}/?portal=${type}&token=${encodeURIComponent(token)}`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      await shot(page, `portal-${type}-${vp.name}`);
    } catch (e) {
      console.warn(`portal ${type} ${vp.name} failed:`, e.message);
    }
    await page.close();
  }

  // --- console roles (cookie session) ---
  for (const role of CONSOLE_ROLES) {
    const page = await context.newPage();
    try {
      const loginRes = await apiLogin(request, role.email);
      await context.addCookies(cookiesFrom(loginRes, WEB));
      await page.goto(`${WEB}/`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      await shot(page, `console-${role.key}-${vp.name}`);
    } catch (e) {
      console.warn(`console ${role.key} ${vp.name} failed:`, e.message);
    }
    await page.close();
  }

  await context.close();
}

await browser.close();
await request.dispose();
console.log(`Done → ${OUT} (sha ${SHA})`);
