import { test, expect } from '@playwright/test';
import { API, login } from './helpers';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * Admin console captures — every sidebar tab at 390px and desktop, on the
 * seeded tenant (varied demo data). Output:
 *   docs/evidence/visual/<sha>/admin-console/<viewport>/<section>-<tab>.png
 * plus a contact-sheet.html index.
 */

const PASSWORD = 'Password123!';
const SHA = execSync('git rev-parse --short HEAD', { cwd: '..' }).toString().trim();
const OUT = `../docs/evidence/visual/${SHA}/admin-console`;

const TABS: [string, string][] = [
  ['home', 'dashboard'], ['home', 'inbox'], ['home', 'announcements'],
  ['projects', 'all'], ['projects', 'schedule'], ['projects', 'drawings'],
  ['projects', 'changeorders'], ['projects', 'coordination'], ['projects', 'correspondence'],
  ['site', 'fieldview'], ['site', 'map'], ['site', 'dailylog'], ['site', 'checklists'], ['site', 'assignments'],
  ['site', 'punch'], ['site', 'inspections'], ['site', 'observations'], ['site', 'actionplans'],
  ['site', 'safety'], ['site', 'attendance'],
  ['money', 'financials'], ['money', 'commitments'], ['money', 'procurement'], ['money', 'quotes'],
  ['money', 'invoices'], ['money', 'inventory'], ['money', 'requisitions'], ['money', 'certificates'], ['money', 'subvaluations'], ['money', 'billing'],
  ['people', 'team'], ['people', 'crews'], ['people', 'subcontractors'], ['people', 'directory'], ['people', 'roles'],
  ['files', 'reports'], ['files', 'companydocs'], ['files', 'unfiled'],
];

async function uiLogin(page: any, request: any) {
  // Cookie-injected session (same as the login form produces) — the capture
  // run must not flake on the auth form under load.
  const res = await request.post(`${process.env.E2E_API_URL || 'http://localhost:4199'}/api/v1/auth/login`, {
    data: { email: 'admin@apexbuilders.co.ke', password: PASSWORD },
  });
  expect(res.status()).toBe(200);
  const setCookie = res.headers()['set-cookie'] || '';
  const cookies = setCookie.split(/,(?=[^;]+=)/).map((c: string) => {
    const [pair] = c.split(';'); const i = pair.indexOf('=');
    return { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim(), domain: 'localhost', path: '/' };
  });
  await page.context().addCookies(cookies);
  await page.goto('/app');
  await expect(page.locator('nav[aria-label="Workspace sections"]:visible').first()).toBeVisible({ timeout: 60_000 });
}

test.describe('Admin console captures', () => {
  test('capture every sidebar tab at 390px and desktop', async ({ page, browserName, request }) => {
    test.setTimeout(600_000);
    mkdirSync(`${OUT}/mobile-390`, { recursive: true });
    mkdirSync(`${OUT}/desktop`, { recursive: true });
    await uiLogin(page, request);
    const vp = test.info().project.name === 'mobile-390' ? 'mobile-390' : 'desktop';
    const shots: string[] = [];
    for (const [section, tab] of TABS) {
      await page.goto(`/app/${section}/${tab}`, { waitUntil: 'domcontentloaded' });
      // Let lazy chunks + first data fetch settle.
      await page.waitForTimeout(2_200);
      const name = `${section}-${tab}.png`;
      await page.screenshot({ path: `${OUT}/${vp}/${name}`, fullPage: false });
      shots.push(`${vp}/${name}`);
    }
    // Contact sheet.
    const html = `<!doctype html><meta charset="utf-8"><title>Admin console captures ${SHA}</title>
<style>body{font-family:system-ui;background:#0f172a;color:#e2e8f0;padding:24px}h1{font-size:18px}section{margin:24px 0}h2{font-size:14px;color:#94a3b8}div{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}figure{margin:0}img{width:100%;border:1px solid #334155;border-radius:8px}figcaption{font-size:11px;color:#94a3b8;margin-top:4px}</style>
<h1>SiteSafi admin console — ${vp} captures @ ${SHA}</h1>
${shots.map((s) => `<figure><img src="${s}"><figcaption>${s}</figcaption></figure>`).join('')}`;
    writeFileSync(`${OUT}/contact-sheet-${vp}.html`, html);
    console.log(`CAPTURES ${vp}: ${shots.length} tabs → ${OUT}`);
  });
});
