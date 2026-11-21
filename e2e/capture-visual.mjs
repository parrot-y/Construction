#!/usr/bin/env node
/**
 * Visual evidence capture — seeds its OWN dedicated demo tenant via the
 * public API (register-company + invitations + one project + portal
 * links), completely separate from the seeded e2e tenant the API test
 * suite mutates. Idempotent: re-running logs into the same tenant.
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
import { mkdirSync, writeFileSync } from 'node:fs';
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

// ---------- dedicated demo tenant (never touched by the API test suite) ----------
const COMPANY = {
  companyName: 'Nyota Construction Ltd',
  adminName: 'Brian Ochieng',
  adminEmail: 'admin@nyota-builders.co.ke',
  adminPhone: '+254712345001',
  password: PASSWORD,
};
const MEMBERS = [
  { key: 'pm-qs', role: 'PM_QS', name: 'Otieno Odhiambo', email: 'pm@nyota-builders.co.ke' },
  { key: 'supervisor', role: 'SITE_SUPERVISOR', name: 'Mwangi Njoroge', email: 'supervisor@nyota-builders.co.ke' },
  { key: 'client', role: 'CLIENT', name: 'Sarah Achieng', email: 'client@nyota-builders.co.ke' },
  { key: 'viewer', role: 'VIEWER', name: 'Kevin Maina', email: 'viewer@nyota-builders.co.ke' },
];
const PROJECT = {
  name: 'Kileleshwa Residential Villas',
  code: 'KIL-RES-01',
  location: 'Kileleshwa, Nairobi',
  description: 'Eight high-end residential villas with basement parking and lift.',
  contractValue: '84500000',
  startDate: '2026-01-12',
  targetEndDate: '2027-06-30',
};

// ---------- API helpers ----------
async function apiLogin(request, email, password = PASSWORD) {
  const res = await request.post(`${API}/api/v1/auth/login`, {
    data: { email, password },
  });
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

const cookieHeaderOf = (res) =>
  res.headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value.split(';')[0])
    .join('; ');

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

// Ensure the dedicated tenant + admin exist (register once, reuse after).
async function ensureAdmin(request) {
  let res = await apiLogin(request, COMPANY.adminEmail);
  if (res.ok()) return res;
  const reg = await request.post(`${API}/api/v1/auth/register-company`, {
    data: {
      companyName: COMPANY.companyName,
      adminFullName: COMPANY.adminName,
      adminEmail: COMPANY.adminEmail,
      adminPhone: COMPANY.adminPhone,
      password: COMPANY.password,
    },
  });
  if (!reg.ok()) throw new Error(`register-company: ${reg.status()} ${await reg.text()}`);
  res = await apiLogin(request, COMPANY.adminEmail);
  if (!res.ok()) throw new Error(`admin login after register: ${res.status()}`);
  return res;
}

// Ensure a member exists: login, else invite + accept, then login.
async function ensureMember(request, adminCookie, member) {
  let res = await apiLogin(request, member.email);
  if (res.ok()) return res;
  const inv = unwrap(await apiPost(request, adminCookie, '/api/v1/invitations', {
    email: member.email, role: member.role, fullName: member.name,
  }));
  const token = inv.token || inv.invitation?.token;
  if (!token) throw new Error(`invite ${member.key}: no token in ${JSON.stringify(inv)}`);
  const acc = await request.post(`${API}/api/v1/invitations/accept`, {
    data: { token, email: member.email, fullName: member.name, password: PASSWORD },
  });
  if (!acc.ok()) throw new Error(`accept ${member.key}: ${acc.status()} ${await acc.text()}`);
  res = await apiLogin(request, member.email);
  if (!res.ok()) throw new Error(`login ${member.key}: ${res.status()}`);
  return res;
}

// ---------- main ----------
const browser = await chromium.launch();
const request = await (await import('@playwright/test')).request.newContext();

const adminRes = await ensureAdmin(request);
const adminCookies = cookiesFrom(adminRes, WEB);
const adminCookieHeader = adminCookies.map((c) => `${c.name}=${c.value}`).join('; ');

// Dedicated project — create only if this tenant has none yet.
let projects = unwrap(await apiGet(request, adminCookieHeader, '/api/v1/projects'));
let projectList = Array.isArray(projects) ? projects : projects.projects || projects.data || [];
let projectId = projectList[0]?.id;
if (!projectId) {
  const created = unwrap(await apiPost(request, adminCookieHeader, '/api/v1/projects', PROJECT));
  projectId = created.id || created.project?.id;
  if (!projectId) throw new Error(`project create returned no id: ${JSON.stringify(created)}`);
}
console.log(`tenant: ${COMPANY.companyName} · project: ${PROJECT.name}`);

// One issued invoice so Money / client portal show real content.
try {
  const invs = unwrap(await apiGet(request, adminCookieHeader, '/api/v1/invoices'));
  const invList = Array.isArray(invs) ? invs : invs.invoices || invs.data || [];
  if (invList.length === 0) {
    const inv = unwrap(await apiPost(request, adminCookieHeader, '/api/v1/invoices', {
      projectId,
      title: 'Structural works — stage 1',
      clientName: 'Nyota Residential Holdings',
      clientEmail: 'accounts@nyota-holdings.co.ke',
      currency: 'KES',
      items: [
        { description: 'Foundation and substructure', unit: 'sum', quantity: 1, unitRate: 18500000 },
        { description: 'Superstructure to slab level 3', unit: 'sum', quantity: 1, unitRate: 34200000 },
        { description: 'Finishes and MEP first fix', unit: 'sum', quantity: 1, unitRate: 21800000 },
      ],
    }));
    const invId = inv.id || inv.invoice?.id;
    if (invId) {
      await apiPost(request, adminCookieHeader, `/api/v1/invoices/${invId}/send`, {
        selfApprovalReason: 'Visual evidence capture — demo invoice send',
      });
    }
  }
} catch (e) {
  console.warn('invoice seed skipped:', e.message);
}

// Provision the four non-admin console members (invite + accept on first run).
for (const m of MEMBERS) {
  await ensureMember(request, adminCookieHeader, m);
}

// One subcontractor package — SUBCONTRACTOR portal links require it.
let subcontractorPackageId = null;
try {
  const subs = unwrap(await apiGet(request, adminCookieHeader, `/api/v1/projects/${projectId}/subcontractors`));
  const subList = Array.isArray(subs) ? subs : subs.packages || subs.data || [];
  subcontractorPackageId = subList[0]?.id ?? subList[0]?.package?.id ?? null;
  if (!subcontractorPackageId) {
    const pkg = await apiPost(request, adminCookieHeader, `/api/v1/projects/${projectId}/subcontractors`, {
      tradeCategory: 'MASONRY',
      firmName: 'Mabati & Masonry Works Ltd',
      contactPerson: 'Peter Waweru',
      phoneNumber: '+254722000456',
      subcontractSum: '9600000',
      retentionRatePct: '5.00',
      scopeDescription: 'Blockwork, plastering and roofing for all eight villas.',
    });
    subcontractorPackageId = pkg.id;
  }
} catch (e) {
  console.warn('subcontractor package seed skipped:', e.message);
}

// Portal links — one per external portal type on the dedicated project.
const PORTAL_TYPES = ['CONSULTANT', 'SUBCONTRACTOR', 'SUPPLIER', 'COMPLIANCE', 'CLIENT'];
const STAKEHOLDER_NAMES = {
  CONSULTANT: 'Eng. Wanjiru Kamau — Lead Consultant',
  SUBCONTRACTOR: 'Mabati & Masonry Works Ltd',
  SUPPLIER: 'East Africa Cement Suppliers',
  COMPLIANCE: 'NCA Compliance Office',
  CLIENT: 'Nyota Residential Holdings',
};
const tokens = {};
for (const type of PORTAL_TYPES) {
  try {
    const link = unwrap(await apiPost(request, adminCookieHeader, `/api/v1/projects/${projectId}/portals/links`, {
      portalType: type,
      stakeholderName: STAKEHOLDER_NAMES[type],
      expiresInDays: 30,
      ...(type === 'SUBCONTRACTOR' && subcontractorPackageId ? { subcontractorPackageId } : {}),
    }));
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
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
}

const CONSOLE_ROLES = [
  { key: 'admin', email: COMPANY.adminEmail },
  ...MEMBERS.map((m) => ({ key: m.key, email: m.email })),
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
      if (!loginRes.ok()) throw new Error(`login ${role.email}: ${loginRes.status()}`);
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

// Record which seed produced this capture for CAPTURE.md traceability.
writeFileSync(`${OUT}/SEED.txt`, [
  `tenant: ${COMPANY.companyName} (${COMPANY.adminEmail})`,
  `project: ${PROJECT.name} (${PROJECT.code})`,
  `seeded by: e2e/capture-visual.mjs via /api/v1/auth/register-company + /api/v1/invitations`,
  `commit: ${execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()}`,
  '',
].join('\n'));

await browser.close();
await request.dispose();
console.log(`Done → ${OUT} (sha ${SHA})`);
