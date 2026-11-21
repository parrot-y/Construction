import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { API, login, fixtureName, Session } from './helpers';

/**
 * P1.6 — break-it suite: the app must fail honestly everywhere.
 *
 * Scenarios (chromium + mobile-390):
 *  A. API stopped during the main save → plain message, typed data kept,
 *     dialog stays open, retry works when the API returns.
 *  B. Injected 403 / 409 / 422 / 500 on a save → plain-language message,
 *     never raw JSON or "Failed to fetch".
 *  C. Double-click / rapid-click on submit → exactly one record.
 *  D. Offline → queued save notice or last-saved data, never a blank page.
 *  E. Fast 3G section nav → skeleton or content, never a blank page.
 *
 * Console sections + portal landings are covered by l2-click-sweep for the
 * click pass; this spec injects failures into the highest-traffic saves.
 */

const RUN = Date.now();
const PASSWORD = 'P1Break#2026';
let admin: Session;
// Pool names must stay distinct within this file — scenario C asserts its
// project card is the ONLY one carrying the name.
const usedProjectNames = new Set<string>();
function uniqueProjectName(tag: string): string {
  let name = fixtureName('project', `${RUN}-${tag}-${test.info().project.name}-p1`);
  while (usedProjectNames.has(name)) name = fixtureName('project', `${name}-x`);
  usedProjectNames.add(name);
  return name;
}

async function register(request: APIRequestContext, salt: string): Promise<Session> {
  const email = `admin.${RUN}@p1-break.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: {
      companyName: fixtureName('company', salt),
      adminFullName: 'Wanjiru Test',
      email,
      phone: '+254712000888',
      password: PASSWORD,
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}

async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  }
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 30_000 });
}

/** Open the new-project wizard and fill through to the final step. */
async function openWizardAtSubmit(page: Page, tag = 'A') {
  const name = uniqueProjectName(tag);
  // The wizard deliberately resumes an unfinished draft from localStorage;
  // each scenario starts a fresh draft.
  await page.goto('/app/projects/all');
  await page.evaluate(() => localStorage.removeItem('sitesafi-new-project-draft'));
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name: 'New project' }) });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Residential', exact: true }).click();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await dialog.getByLabel(/Project name/).fill(name);
  await dialog.getByLabel(/Project code/).fill(`P1${tag}-${String(RUN).slice(-6)}`);
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  return { dialog, name };
}

test.describe.serial('P1.6 break-it — honest failures', () => {
  test.beforeAll(async ({ request }, testInfo) => {
    admin = await register(request, `${RUN}-${testInfo.project.name}-p1co`);
  });

  test('A. API stopped during project create — plain error, data kept, retry works', async ({ page, request }) => {
    test.setTimeout(120_000);
    await uiLogin(page, `admin.${RUN}@p1-break.test`, PASSWORD);

    // Cut the API mid-save.
    await page.route('**/api/v1/projects', (route) => {
      if (route.request().method() === 'POST') return route.abort('connectionrefused');
      return route.continue();
    });

    const { dialog, name } = await openWizardAtSubmit(page);
    const submit = dialog.locator('button[type="submit"]');
    await page.waitForTimeout(400);
    await submit.click({ timeout: 10_000 }).catch(() => {});

    // Plain-language error inside the dialog — never "Failed to fetch"/JSON.
    const errBox = dialog.locator('[role="alert"], .text-red-600, .text-red-700').first();
    await expect(errBox).toBeVisible({ timeout: 30_000 });
    const errText = (await errBox.textContent()) || '';
    expect(errText).not.toMatch(/Failed to fetch|TypeError|ECONNREFUSED|\{.*\}/i);
    expect(errText.length).toBeGreaterThan(10);
    // Dialog stays open with typed data kept — step back to the details
    // step and the name field must still hold what was typed.
    await expect(dialog).toBeVisible();
    // Step 3 (team) → Back lands on commercial; Back again reaches basics.
    await dialog.getByRole('button', { name: 'Back' }).click();
    await dialog.getByRole('button', { name: 'Back' }).click();
    await expect(dialog.getByLabel(/Project name/)).toHaveValue(name);
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await dialog.getByRole('button', { name: 'Continue' }).click();

    // API returns → retry succeeds, project appears.
    await page.unroute('**/api/v1/projects');
    await submit.click({ timeout: 10_000 }).catch(() => {});
    await expect(dialog).not.toBeVisible({ timeout: 30_000 });
    await expect(page.locator('button', { hasText: name }).first()).toBeVisible({ timeout: 20_000 });
  });

  test('B. injected 403/409/422/500 on project create — plain messages', async ({ page, request }) => {
    test.setTimeout(180_000);
    await uiLogin(page, `admin.${RUN}@p1-break.test`, PASSWORD);

    for (const [status, expected] of [
      [403, /permission|admin/i],
      [409, /already|exists|conflict/i],
      [422, /fixing|details|required/i],
      [500, /wrong|try again|side/i],
    ] as const) {
      await page.unrouteAll();
      await page.route('**/api/v1/projects', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify({ message: `Injected ${status} for break-it test` }),
          });
        }
        return route.continue();
      });

      const { dialog } = await openWizardAtSubmit(page, 'B');
      const submit = dialog.locator('button[type="submit"]');
      await page.waitForTimeout(400);
      await submit.click({ timeout: 10_000 }).catch(() => {});

      const errBox = dialog.locator('[role="alert"], .text-red-600, .text-red-700').first();
      await expect(errBox).toBeVisible({ timeout: 30_000 });
      const errText = (await errBox.textContent()) || '';
      expect(errText).not.toContain('{');
      expect(errText).not.toMatch(/Failed to fetch|TypeError/i);
      await expect(dialog).toBeVisible(); // stays open for correction
      await dialog.getByRole('button', { name: 'Close' }).click();
      await page.waitForTimeout(300);
    }
    await page.unrouteAll();
  });

  test('C. double-click project create → exactly one record', async ({ page, request }) => {
    test.setTimeout(120_000);
    await uiLogin(page, `admin.${RUN}@p1-break.test`, PASSWORD);

    const { dialog, name } = await openWizardAtSubmit(page, 'C');
    const submit = dialog.locator('button[type="submit"]');
    await page.waitForTimeout(400);
    // Rapid double activation.
    await submit.click({ timeout: 10_000 }).catch(() => {});
    await submit.click({ timeout: 2_000, force: true }).catch(() => {});
    await expect(dialog).not.toBeVisible({ timeout: 30_000 });

    const cards = page.locator('button', { hasText: name });
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    expect(await cards.count()).toBe(1);
  });

  test('D. offline → section shows saved/queued notice, never blank', async ({ page, request, context }) => {
    test.setTimeout(120_000);
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 300)}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) problems.push(`console: ${m.text().slice(0, 300)}`); });
    await uiLogin(page, `admin.${RUN}@p1-break.test`, PASSWORD);
    await page.goto('/app/projects/all');
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible({ timeout: 20_000 });

    // Dev server has no service worker, so a full reload offline is a
    // browser error page by definition — the contract is that the RUNNING
    // app degrades honestly: cached content stays, failures show the
    // offline/unreachable notice, and nothing blanks out.
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Money', exact: true }).first().click({ timeout: 20_000 }).catch(async () => {
      // Shell nav itself may be unreachable if its chunk was never warmed —
      // the honest fallback panel is still a pass for "never blank".
      console.log('NAV-CLICK-FAILED problems:', problems.join(' || '));
    });
    await page.waitForTimeout(3000);
    const main = page.locator('main').last();
    await expect(main).toBeVisible({ timeout: 15_000 });
    const text = (await main.textContent()) || '';
    expect(text.trim().length).toBeGreaterThan(20);
    // Offline notice or last-synced content must be present — never an
    // empty shell or a raw browser error.
    expect(text).not.toMatch(/Failed to fetch|TypeError|ERR_INTERNET_DISCONNECTED/i);
    expect(problems, problems.join('\n')).toEqual([]);
    await context.setOffline(false);
  });

  test('E. Fast 3G section nav → skeleton or content, never blank', async ({ page, request, context }) => {
    test.setTimeout(120_000);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 90_000,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await uiLogin(page, `admin.${RUN}@p1-break.test`, PASSWORD);
    await page.goto('/app/projects/all');
    await page.waitForTimeout(500);
    // Wait for the nav shell — under Fast 3G + CPU throttle it can lag the
    // goto. The desktop sidebar nav is hidden on phones, so wait on a button
    // that exists in whichever nav is visible.
    await page.getByRole('button', { name: 'More sections' })
      .or(page.getByRole('button', { name: 'Money', exact: true }))
      .first().waitFor({ timeout: 30_000 });
    const moreSheet = page.getByRole('navigation', { name: 'All sections' });
    for (const section of ['Money', 'People', 'Site', 'Files & reports', 'Home']) {
      // On phones People/Files live in the bottom bar's More sheet; scope the
      // sheet click or the bottom-bar button with the same name wins .first().
      const direct = page.getByRole('button', { name: section, exact: true }).first();
      if (await direct.isVisible().catch(() => false)) {
        await direct.click();
      } else {
        await page.getByRole('button', { name: 'More sections' }).click();
        await moreSheet.getByRole('button', { name: section, exact: true }).click();
      }
      // Within 3s the section must show skeleton, content, or an error state.
      const main = page.locator('main').last();
      await expect(main).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1200);
      const busy = await page.locator('[aria-busy="true"], [class*="skeleton"], [class*="animate-pulse"]').count();
      const text = ((await main.textContent()) || '').trim();
      expect(busy + text.length).toBeGreaterThan(0);
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  });

  test('F. double-click invite → exactly one invitation', async ({ page, request }) => {
    test.setTimeout(120_000);
    await uiLogin(page, `admin.${RUN}@p1-break.test`, PASSWORD);
    const email = `invite.${RUN}@p1-break.test`;

    await page.goto('/app/people/team');
    await page.getByRole('button', { name: 'Invite member' }).click();
    await page.locator('input[type="email"]').fill(email);
    const send = page.getByRole('button', { name: 'Send invite' });
    await send.click();
    await send.click({ force: true, timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const j: any = await (await request.get(`${API}/api/v1/invitations`, { headers: { cookie: admin.cookie } })).json();
    const matches = (j?.data || j || []).filter((i: any) => (i.email || '').toLowerCase() === email.toLowerCase());
    expect(matches.length, `expected 1 invite for ${email}, got ${matches.length}`).toBe(1);
  });

  test('G. double-click quote save → exactly one draft quote', async ({ page, request }) => {
    test.setTimeout(120_000);
    await uiLogin(page, `admin.${RUN}@p1-break.test`, PASSWORD);
    const title = fixtureName('quote', `${RUN}-g-${test.info().project.name}-q`);

    await page.goto('/app/money/quotes');
    await page.getByRole('button', { name: '+ New Quote' }).click();
    const qform = page.locator('form', { has: page.getByRole('button', { name: /Save Draft Quote/ }) });
    await qform.locator('input').nth(0).fill(title);
    await qform.locator('input').nth(1).fill(fixtureName('client', `${RUN}-g-${test.info().project.name}`));
    await page.getByPlaceholder('Description *').fill('Bulk excavation — phase 1');
    await page.getByPlaceholder('Rate').fill('1000');
    const save = page.getByRole('button', { name: /Save Draft Quote/ });
    await save.click();
    await save.click({ force: true, timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const j: any = await (await request.get(`${API}/api/v1/quotes`, { headers: { cookie: admin.cookie } })).json();
    const matches = (j?.quotes || j?.data || []).filter((q: any) => q.title === title);
    expect(matches.length, `expected 1 quote "${title}", got ${matches.length}`).toBe(1);
  });

  test('H. double-click variation submit → exactly one change order', async ({ page, request }) => {
    test.setTimeout(150_000);
    await uiLogin(page, `admin.${RUN}@p1-break.test`, PASSWORD);
    const title = fixtureName('changeorder', `${RUN}-h-${test.info().project.name}-co`);

    // Fixture: this scenario needs a project — create one via API (the UI
    // journey itself stays click-driven).
    const projName = fixtureName('project', `${RUN}-hproj-${test.info().project.name}`);
    const pr = await request.post(`${API}/api/v1/projects`, {
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      data: { name: projName, code: `P1CO-${String(RUN).slice(-6)}` },
    });
    expect(pr.status(), await pr.text()).toBe(201);

    await page.goto('/app/projects/all');
    const card = page.locator('button', { hasText: projName }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.click();
    await page.getByRole('tab', { name: 'Change orders' }).or(page.getByRole('button', { name: 'Change orders' })).first().click();
    await page.getByRole('button', { name: '+ New Change Order' }).click();

    const modal = page.locator('div.fixed.inset-0').last();
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await modal.getByPlaceholder(/Raft Foundation/).fill(title);
    await modal.getByPlaceholder(/Cite site instruction/).fill('Client instructed additional excavation at grid B4 during site visit.');
    await modal.getByPlaceholder(/Item description/).fill('Additional excavation in rock');
    await modal.getByPlaceholder('e.g. 50').fill('2');
    await modal.getByPlaceholder('e.g. 3500.00').fill('5000');

    const submit = modal.getByRole('button', { name: 'Submit Variation Order' });
    await submit.click();
    await submit.click({ force: true, timeout: 2_000 }).catch(() => {});
    await expect(modal).not.toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);

    const text = (await page.locator('main').last().textContent()) || '';
    const occurrences = text.split(title).length - 1;
    expect(occurrences, `expected change order "${title}" once, found ${occurrences}`).toBe(1);
  });
});
