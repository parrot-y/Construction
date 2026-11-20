import { test, expect, Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * ROUND L3 — ADMIN FIRST-HOUR JOURNEY (UI only, no API shortcuts).
 *
 * What a brand-new owner does on day one, entirely through the product:
 *   1. register a company on the landing page
 *   2. create a project from the Projects screen
 *   3. try to add BoQ items            → FINDING if no UI path exists
 *   4. invite a team member
 *   5. create a quote
 *   6. see the project in the list
 *
 * Every step is screenshotted at 390px into
 * docs/evidence/visual/<HEAD-sha>/admin-first-hour/.
 */

const RUN = Date.now();
const EMAIL = `owner.${RUN}@firsthour.test`;
const PASSWORD = 'FirstHour#2026';
const SHOT_DIR = path.resolve(
  __dirname,
  '../../docs/evidence/visual',
  execSync('git rev-parse HEAD', { cwd: path.resolve(__dirname, '../..') }).toString().trim(),
  'admin-first-hour',
);

async function shot(page: Page, name: string) {
  // Evidence contract is 390px phone captures — the desktop pass exercises
  // the same journey but must not overwrite them.
  if ((page.viewportSize()?.width ?? 0) > 500) return;
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false });
}

test.use({ video: 'off' }); // heavy single-journey spec — ffmpeg video encoding is a real CPU cost on constrained boxes; trace+screenshots remain

test.describe('L3 — admin first-hour journey (UI only)', () => {
  test('day-one journey at 390px', async ({ page }, testInfo) => {
    test.setTimeout(900_000);

    // 1. Register the company through the public signup form.
    await page.goto('/?signup=1');
    await page.locator('#company-name').fill('Meridian Build Ltd');
    await page.locator('#admin-name').fill('Amani Otieno');
    await page.locator('#signup-email').fill(EMAIL);
    await page.locator('#signup-phone').fill('+254712345999');
    await page.locator('#signup-password').fill(PASSWORD);
    await page.locator('#signup-confirm').fill(PASSWORD);
    await shot(page, '01-signup-form');
    await page.getByRole('button', { name: /create|register|sign up|continue/i }).last().click();
    // Signup does NOT auto-login: the workspace is created pending email
    // verification (simulated delivery renders the link on screen).
    await expect(page.getByRole('heading', { name: 'Workspace created' })).toBeVisible({ timeout: 30_000 });
    await shot(page, '02-workspace-created-verify');
    await page.getByRole('link', { name: /verify=/ }).click();
    await expect(page.getByRole('heading', { name: 'Email verification' })).toBeVisible({ timeout: 20_000 });
    await shot(page, '03-email-verified');
    await page.getByRole('button', { name: 'Continue to sign in' }).click();
    // Continue lands on the sign-in form directly; the landing variant
    // needs one more click. Handle both. The login form is a lazy chunk —
    // wait for whichever variant renders instead of one-shot probing.
    const emailBox = page.locator('#email, input[type="email"]').first();
    const signInToWorkspace = page.getByRole('button', { name: 'Sign in to your workspace' });
    const signInLanding = page.getByRole('button', { name: 'Sign in', exact: true }).first();
    await expect(emailBox.or(signInToWorkspace).or(signInLanding).first()).toBeVisible({ timeout: 30_000 });
    if (!(await emailBox.isVisible().catch(() => false))) {
      if (await signInToWorkspace.isVisible().catch(() => false)) {
        await signInToWorkspace.click();
      } else {
        await signInLanding.click();
      }
    }
    await emailBox.fill(EMAIL);
    await page.locator('#password, input[type="password"]').first().fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in to workspace' }).click();
    await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 45_000 });
    await shot(page, '04-console-home');

    // 2. Create the first project from the Projects screen.
    await page.goto('/app/projects/all');
    await page.getByRole('button', { name: 'New project' }).click();
    const dlg = page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name: 'New project' }) });
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: 'Commercial', exact: true }).click();
    await dlg.getByRole('button', { name: 'Continue' }).click();
    await dlg.getByLabel(/Project name/).fill('Kileleshwa Mixed-Use Development');
    await dlg.getByLabel(/Project code/).fill(`MUD-${String(RUN).slice(-5)}`);
    await dlg.getByLabel('Location').fill('Kileleshwa, Nairobi');
    await dlg.getByRole('button', { name: 'Continue' }).click();
    await dlg.getByLabel(/Contract value/).fill('186000000');
    await dlg.getByRole('button', { name: 'Continue' }).click();
    await shot(page, '05-new-project-form');
    // Footer primary swaps Continue→submit at the same spot; a fast click can
  // submit early — click submit only if the modal is still open.
  const npSubmit = dlg.locator('button[type=\"submit\"]');
  await dlg.page().waitForTimeout(400);
  if (await npSubmit.isVisible().catch(() => false) && !(await npSubmit.isDisabled().catch(() => true))) {
    await npSubmit.click({ timeout: 10_000 }).catch(() => {});
  }
    const card = page.locator('button', { hasText: 'Kileleshwa Mixed-Use Development' }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await shot(page, '06-project-created');

    // 3. BoQ items — look for ANY visible way to add them.
    await page.goto('/app/money/financials');
    await page.waitForTimeout(800);
    const boqTab = page.getByRole('tab', { name: /bill of quantities/i })
      .or(page.getByRole('button', { name: /bill of quantities/i })).first();
    if (await boqTab.isVisible().catch(() => false)) {
      await boqTab.click();
      await page.waitForTimeout(800);
    }
    await shot(page, '07-boq-screen');
    // Finding check: is there any add/import affordance?
    const boqAdd = page.getByRole('button', { name: /add|new|import|upload|item/i }).first();
    const boqFinding = !(await boqAdd.isVisible().catch(() => false));
    test.info().annotations.push({
      type: boqFinding ? 'finding' : 'note',
      description: boqFinding
        ? 'FINDING: no visible UI path to add BoQ items — BoqWorkbookView is read-only and BoqImportModal is not mounted in the console'
        : 'BoQ add affordance found',
    });

    // 4. Invite a team member.
    await page.goto('/app/people/team');
    await page.waitForTimeout(800);
    const inviteBtn = page.getByRole('button', { name: /invite|add member|new member/i }).first();
    await expect(inviteBtn).toBeVisible({ timeout: 15_000 });
    await inviteBtn.click();
    await page.waitForTimeout(400);
    // Invite form is an inline panel on the Team tab (not a modal) — scope by
    // its unique placeholder/labels so hidden page controls can't wedge fill().
    const emailInput = page.getByPlaceholder(/teammate@/);
    await emailInput.fill(`siteengineer.${RUN}@firsthour.test`);
    const roleSelect = page.locator('label', { hasText: /^Role$/ }).locator('select');
    if (await roleSelect.isVisible().catch(() => false)) {
      await roleSelect.selectOption('SITE_ENGINEER').catch(async () => {
        await roleSelect.selectOption({ index: 1 }).catch(() => {});
      });
    }
    await shot(page, '08-invite-member');
    await page.getByRole('button', { name: 'Send invite', exact: true }).click();
    await page.waitForTimeout(1200);
    await shot(page, '09-invite-sent');

    // 5. Create a quote.
    await page.goto('/app/money/quotes');
    await page.waitForTimeout(800);
    const newQuote = page.getByRole('button', { name: '+ New Quote' }).first();
    await expect(newQuote).toBeVisible({ timeout: 15_000 });
    await newQuote.click();
    await page.waitForTimeout(400);
    const q = page.locator('form').last();
    const qInputs = q.locator('input:visible');
    if (await qInputs.nth(0).isVisible().catch(() => false)) await qInputs.nth(0).fill('Boundary wall & gate — package A');
    if (await qInputs.nth(1).isVisible().catch(() => false)) await qInputs.nth(1).fill('Kileleshwa Mixed-Use Dev LLP');
    // first line item
    const itemDesc = q.locator('input[placeholder*="description" i], input').nth(3);
    if (await itemDesc.isVisible().catch(() => false)) await itemDesc.fill('Boundary wall construction');
    const itemQty = q.locator('input[inputmode="decimal"], input[type="number"]').first();
    if (await itemQty.isVisible().catch(() => false)) await itemQty.fill('120');
    const itemRate = q.locator('input[inputmode="decimal"], input[type="number"]').nth(1);
    if (await itemRate.isVisible().catch(() => false)) await itemRate.fill('45000');
    await shot(page, '10-quote-form');
    await q.getByRole('button', { name: /create|save|submit/i }).first().click();
    await page.waitForTimeout(1500);
    await shot(page, '11-quote-created');

    // 6. Project visible in the list.
    await page.goto('/app/projects/all');
    await expect(page.locator('button', { hasText: 'Kileleshwa Mixed-Use Development' }).first()).toBeVisible({ timeout: 15_000 });
    await shot(page, '12-project-in-list');
  });
});
