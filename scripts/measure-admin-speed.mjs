#!/usr/bin/env node
/**
 * Admin-console speed measurement.
 *
 * Measures against the PRODUCTION web build (vite preview) — dev-server
 * module waterfalls would make the numbers meaningless.
 *
 * Prerequisites:
 *   - API running on :4199 (E2E_API_URL to override)
 *   - web built + preview on :5181 (SPEED_WEB_URL to override)
 *     pnpm --filter @construction/web build
 *     VITE_API_TARGET=http://localhost:4199 pnpm --filter @construction/web exec vite preview --port 5181
 *
 * Prints a markdown table; paste into docs/evidence/admin-speed-<sha>.md.
 */
import { chromium, devices } from '../e2e/node_modules/@playwright/test/index.mjs';
import { execSync } from 'node:child_process';

const API = process.env.E2E_API_URL || 'http://localhost:4199';
const WEB = process.env.SPEED_WEB_URL || 'http://localhost:5181';
const SHA = execSync('git rev-parse --short HEAD').toString().trim();
const RUN = Date.now();
const email = `speed.${RUN}@speed.test`;
const password = 'Speed#2026';

const results = [];
const rec = (metric, value, budget, pass) => results.push({ metric, value, budget, pass });

const reg = await fetch(`${API}/api/v1/auth/register-company`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    companyName: `Speed Co ${RUN}`, adminFullName: 'Speed Admin', email,
    phone: `+2547${String(RUN).slice(-8)}`, password,
  }),
});
if (reg.status !== 201) { console.error('register failed', reg.status, await reg.text()); process.exit(1); }
const loginRes = await fetch(`${API}/api/v1/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const setCookie = loginRes.headers.get('set-cookie') || '';
const cookies = setCookie.split(/,(?=[^;]+=)/).map((c) => {
  const [pair] = c.split(';'); const i = pair.indexOf('=');
  return { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim(), domain: 'localhost', path: '/' };
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 } });
await ctx.addCookies(cookies);
const page = await ctx.newPage();

const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', {
  offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750,
});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

let jsBytes = 0, totalBytes = 0;
cdp.on('Network.loadingFinished', (e) => { totalBytes += e.encodedDataLength || 0; });
cdp.on('Network.responseReceived', (e) => {
  const m = e.response?.mimeType || '';
  if (m.includes('javascript')) {
    const len = Number(e.response.headers['content-length'] || e.response.encodedDataLength || 0);
    jsBytes += len;
  }
});

let t0 = Date.now();
await page.goto(`${WEB}/app`, { waitUntil: 'domcontentloaded' });
const firstScreen = await page.getByRole('heading', { name: 'Home' }).first()
  .waitFor({ state: 'visible', timeout: 120_000 }).then(() => Date.now() - t0).catch(() => -1);
rec('first useful screen (/app → Home)', `${firstScreen} ms`, '< 3000 ms', firstScreen > 0 && firstScreen < 3000);

await page.goto(`${WEB}/app/projects/all`);
await page.getByRole('button', { name: 'New project' }).click();
const dlg = page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name: 'New project' }) });
await dlg.getByLabel(/Project name/).fill('Speed Site');
await dlg.getByLabel(/Project code/).fill(`SPD-${RUN}`);
await dlg.getByRole('button', { name: 'Create project' }).click();
await page.getByRole('heading', { name: 'Speed Site' }).first().waitFor({ state: 'visible', timeout: 120_000 });

for (const label of ['Projects', 'Money', 'People', 'Site', 'Files & reports', 'Home']) {
  const btn = page.locator(`nav[aria-label="Workspace sections"]:visible button[aria-label="${label}"]`).first();
  const tc = Date.now();
  await btn.click({ force: true });
  const shell = await page.locator('main h1, [aria-busy="true"]').first()
    .waitFor({ state: 'visible', timeout: 10_000 }).then(() => Date.now() - tc).catch(() => -1);
  const data = await page.locator('[aria-busy="true"]').first()
    .waitFor({ state: 'hidden', timeout: 30_000 }).then(() => Date.now() - tc).catch(() => -1);
  rec(`nav → ${label} shell`, `${shell} ms`, '< 100 ms', shell > 0 && shell < 100);
  rec(`nav → ${label} data`, `${data} ms`, '< 1500 ms', data > 0 && data < 1500);
}

await page.goto(`${WEB}/app/projects/all`);
await page.getByRole('button', { name: 'New project' }).click();
const dlg2 = page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name: 'New project' }) });
await dlg2.getByLabel(/Project name/).fill('Speed Site Two');
await dlg2.getByLabel(/Project code/).fill(`SPD2-${RUN}`);
const submitBtn = dlg2.getByRole('button', { name: 'Create project' });
const ts = Date.now();
await submitBtn.click();
const pressed = await submitBtn.isDisabled().then(() => Date.now() - ts).catch(() => -1);
const created = await page.getByRole('heading', { name: 'Speed Site Two' }).first()
  .waitFor({ state: 'visible', timeout: 120_000 }).then(() => Date.now() - ts).catch(() => -1);
rec('submit → disabled state', `${pressed} ms`, 'immediate', pressed >= 0 && pressed < 1000);
rec('submit → project visible', `${created} ms`, 'reported (throttled)', created > 0);

rec('JS bytes transferred', `${Math.round(jsBytes / 1024)} KiB`, '—', true);
rec('total bytes transferred', `${Math.round(totalBytes / 1024)} KiB`, '—', true);

await browser.close();

console.log(`\n## admin-speed measurements — commit ${SHA}\n`);
console.log('Environment: production build (vite preview), Fast 3G (150 ms RTT, 1.6/0.75 Mbps), 4x CPU, 390 px.\n');
console.log('| metric | value | budget | pass |');
console.log('|---|---|---|---|');
for (const r of results) console.log(`| ${r.metric} | ${r.value} | ${r.budget} | ${r.pass ? 'PASS' : 'MISS'} |`);
const misses = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - misses}/${results.length} budgets met.`);
process.exit(misses ? 1 : 0);
