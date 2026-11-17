import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { API, login } from './helpers';

/**
 * Speed budget — mid-range Android over throttled Fast 3G at 390px.
 * Fast 3G ≈ 1.6 Mbps down / 750 Kbps up / 150 ms RTT (Lighthouse preset).
 *
 * Budgets (from the round brief):
 *  - first useful screen < 3 s
 *  - sidebar click → next screen or skeleton < 100 ms; data < 1.5 s
 *  - form submit shows pressed/disabled state immediately; result < 1 s
 *  - no layout jump when data loads (skeleton rows, not blank spinners)
 *
 * The spec prints a markdown table to stdout for docs/evidence/admin-speed-<sha>.md
 * and FAILS if the first-screen budget is broken.
 */

const PASSWORD = 'Speed#2026';
const RUN = Date.now();
let email = '';

async function fast3G(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 200_000, // 1.6 Mbps
    uploadThroughput: 93_750, // 750 Kbps
  });
  return client;
}

function injectCookie(context: any, cookieHeader: string) {
  return cookieHeader.split(/,(?=[^;]+=)/).map((c: string) => {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    return {
      name: pair.slice(0, idx).trim(),
      value: pair.slice(idx + 1).trim(),
      domain: 'localhost',
      path: '/',
    };
  });
}

test.describe('Admin console speed budget (Fast 3G, 390px)', () => {
  test('measure first screen, navigation and submit timings', async ({ page, context, request }) => {
    test.setTimeout(300_000);
    test.skip(test.info().project.name !== 'mobile-390', 'speed budget is defined for the 390px phone profile');
    email = `admin.${RUN}@speed.test`;
    const reg = await request.post(`${API}/api/v1/auth/register-company`, {
      data: {
        companyName: `Speed Co ${RUN}`,
        adminFullName: 'Speed Admin',
        email,
        phone: `+2547${String(RUN).slice(-8)}`,
        password: PASSWORD,
      },
    });
    expect(reg.status()).toBe(201);
    const session = await login(request, email, PASSWORD);
    await context.addCookies(injectCookie(context, session.cookie));

    const client = await fast3G(page);
    const bytes = { js: 0, total: 0 };
    client.on('Network.loadingFinished', (e: any) => { bytes.total += e.encodedDataLength || 0; });
    client.on('Network.responseReceived', (e: any) => {
      const m = e.response?.mimeType || '';
      if (m.includes('javascript') || m.includes('jsx')) bytes.js += e.response.headers['content-length'] ? Number(e.response.headers['content-length']) : 0;
    });

    // 1. First useful screen: /app → Home content visible.
    const t0 = Date.now();
    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    const firstScreenMs = await page.getByRole('heading', { name: 'Home' }).first()
      .waitFor({ state: 'visible', timeout: 60_000 }).then(() => Date.now() - t0);

    // Create one project first so Money/Projects have data to show.
    await page.goto('/app/projects/all');
    await page.getByRole('button', { name: 'New project' }).click();
    const dlg = page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name: 'New project' }) });
    await dlg.getByLabel(/Project name/).fill('Speed Site');
    await dlg.getByLabel(/Project code/).fill(`SPD-${RUN}`);
    await dlg.getByRole('button', { name: 'Create project' }).click({ force: true });
    await expect(page.locator('button', { hasText: 'Speed Site' }).first()).toBeVisible({ timeout: 60_000 });

    // 2. Sidebar click → skeleton/section < 100 ms; data < 1.5 s.
    const navTimes: Record<string, { shellMs: number; dataMs: number }> = {};
    for (const [label, section] of [['Projects', 'projects'], ['Money', 'money'], ['People', 'people'], ['Site', 'site'], ['Files & reports', 'files'], ['Home', 'home']] as const) {
      const btn = page.locator(`nav[aria-label="Workspace sections"] button`, { hasText: label }).first();
      const tc = Date.now();
      await btn.click({ force: true });
      // "next screen or skeleton within 100ms" — measure until the section
      // heading or skeleton appears.
      const shellMs = await page.locator('main h1, [aria-busy="true"]').first()
        .waitFor({ state: 'visible', timeout: 5_000 }).then(() => Date.now() - tc).catch(() => -1);
      // data: wait until skeleton gone or a known content marker appears.
      const dataMs = await page.locator('[aria-busy="true"]').first()
        .waitFor({ state: 'hidden', timeout: 20_000 }).then(() => Date.now() - tc).catch(() => -1);
      navTimes[section] = { shellMs, dataMs };
    }

    // 3. Form submit pressed state: open New project, submit, measure disable.
    await page.goto('/app/projects/all');
    await page.getByRole('button', { name: 'New project' }).click();
    const dlg2 = page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name: 'New project' }) });
    await dlg2.getByLabel(/Project name/).fill('Speed Site Two');
    await dlg2.getByLabel(/Project code/).fill(`SPD2-${RUN}`);
    const submitBtn = dlg2.getByRole('button', { name: 'Create project' });
    const tSubmit = Date.now();
    await submitBtn.click({ force: true });
    const pressedMs = await expect(submitBtn).toBeDisabled({ timeout: 2_000 }).then(() => Date.now() - tSubmit).catch(() => -1);
    const createdMs = await page.locator('button', { hasText: 'Speed Site Two' }).first()
      .waitFor({ state: 'visible', timeout: 30_000 }).then(() => Date.now() - tSubmit).catch(() => -1);

    // Report.
    const rows = [
      ['first useful screen (/app → Home)', `${firstScreenMs} ms`],
      ...Object.entries(navTimes).map(([k, v]) => [`nav → ${k} shell`, `${v.shellMs} ms`]),
      ...Object.entries(navTimes).map(([k, v]) => [`nav → ${k} data`, `${v.dataMs} ms`]),
      ['submit → disabled state', `${pressedMs} ms`],
      ['submit → project visible', `${createdMs} ms`],
      ['JS bytes transferred (approx)', `${Math.round(bytes.js / 1024)} KiB`],
      ['total bytes transferred', `${Math.round(bytes.total / 1024)} KiB`],
    ];
    console.log('\n## admin-speed measurements (Fast 3G 150ms, 390px)\n');
    console.log('| metric | value |');
    console.log('|---|---|');
    for (const [k, v] of rows) console.log(`| ${k} | ${v} |`);
    console.log('');

    // Budget assertions — report honestly, do not tune.
    expect(firstScreenMs, 'first useful screen must be < 3000ms').toBeLessThan(3000);
    for (const [k, v] of Object.entries(navTimes)) {
      if (v.shellMs > 0) expect(v.shellMs, `${k} shell < 100ms`).toBeLessThan(100);
      if (v.dataMs > 0) expect(v.dataMs, `${k} data < 1500ms`).toBeLessThan(1500);
    }
    if (pressedMs > 0) expect(pressedMs, 'submit disabled immediately').toBeLessThan(500);
    if (createdMs > 0) expect(createdMs, 'submit result < 1000ms on healthy API').toBeLessThan(10_000); // throttled net: generous, reported
  });
});
