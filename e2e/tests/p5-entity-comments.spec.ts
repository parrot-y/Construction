import { test, expect, Page } from '@playwright/test';
import { login, apiGet, apiPost, unwrap, firstProjectId, selectActiveProject, Session, API } from './helpers';

/**
 * P5.6 — entity comments + @mentions.
 *
 * A comment posted on an invoice detail (and on a snag card) is stored on the
 * entity; an `@mention` resolves against tenant members and delivers a direct
 * inbox message to the mentioned teammate — verifiable through the API.
 */

const RUN = Date.now();
const INV_TITLE = `Comments proof invoice ${RUN}`;
const SNAG_DESC = `Comments proof snag ${RUN} — cracked render`;
const MENTION_BODY = `@John Kiprono please confirm the revised valuation ${RUN}`;

async function uiLogin(page: Page) {
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  }
  await page.locator('#email').fill('admin@apexbuilders.co.ke');
  await page.locator('#password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 30_000 });
}

test.describe('P5.6 — entity comments and @mentions', () => {
  let admin: Session;
  let supervisor: Session;
  let invoiceId = '';
  let projectId = '';

  test.beforeAll(async ({ request }) => {
    admin = await login(request, 'admin@apexbuilders.co.ke');
    supervisor = await login(request, 'supervisor@apexbuilders.co.ke');
    projectId = await firstProjectId(request, admin);

    const ir = await apiPost(request, admin, '/api/v1/invoices', {
      title: INV_TITLE,
      clientName: 'Comments Proof Client Ltd',
      projectId,
      items: [{ description: 'Comment thread fixture line', unit: 'item', quantity: 1, unitRate: 50000 }],
    });
    expect(ir.status(), await ir.text()).toBeLessThan(300);
    const inv = unwrap(await ir.json());
    invoiceId = inv.id || inv.invoice?.id || inv.data?.id;
    expect(invoiceId).toBeTruthy();

    const sr = await apiPost(request, admin, `/api/v1/projects/${projectId}/snags`, {
      locationFloor: 'Ground',
      locationRoom: 'Comments proof room',
      tradeCategory: 'PLASTERING',
      description: SNAG_DESC,
      severity: 'MINOR',
    });
    expect(sr.status(), await sr.text()).toBeLessThan(300);
  });

  test('invoice detail hosts a comment thread; @mention reaches the teammate inbox', async ({ page, request }) => {
    test.setTimeout(120_000);
    await uiLogin(page);
    await page.goto(`/app/money/invoices?project=${projectId}`);
    await expect(page.getByText(INV_TITLE).first()).toBeVisible({ timeout: 30_000 });

    // Expand the invoice row via its INV- number button.
    const row = page.locator('tr', { hasText: INV_TITLE }).first();
    await row.getByRole('button', { name: /^INV-/ }).click();

    const thread = page.getByTestId('entity-comments');
    await expect(thread).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('entity-comment-input').fill(MENTION_BODY);
    await page.getByTestId('entity-comment-submit').click();

    // Posted confirmation + mention count.
    await expect(page.getByText(/teammate.*notified/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(thread.getByText(MENTION_BODY)).toBeVisible();

    // Server-side proof: the mentioned supervisor has a direct inbox message.
    const inbox = await apiGet(request, supervisor, '/api/v1/inbox?unread=true');
    expect(inbox.status()).toBe(200);
    const body = await inbox.json();
    const items = body.data || body.messages || body;
    const hit = JSON.stringify(items).includes('mentioned you in a comment');
    expect(hit, 'supervisor inbox should contain the mention notification').toBe(true);
  });

  test('snag card exposes the same comment thread', async ({ page }) => {
    test.setTimeout(120_000);
    await uiLogin(page);
    await page.goto('/app/site/punch');
    await selectActiveProject(page, 'Riverside Commercial Plaza');
    await expect(page.getByRole('heading', { name: /punch list/i }).first()).toBeVisible({ timeout: 30_000 });

    // Each snag card is a `div.space-y-3.5` containing the description text.
    const snagCard = page.locator('div.space-y-3\\.5', { hasText: SNAG_DESC });
    await expect(snagCard.getByText(SNAG_DESC).first()).toBeVisible({ timeout: 30_000 });

    const toggle = snagCard.getByRole('button', { name: 'Comments' }).first();
    await toggle.click();

    const thread = page.getByTestId('entity-comments');
    await expect(thread).toBeVisible({ timeout: 15_000 });
    const note = `Site check done — re-render scheduled ${RUN}`;
    await page.getByTestId('entity-comment-input').fill(note);
    await page.getByTestId('entity-comment-submit').click();
    await expect(thread.getByText(note)).toBeVisible({ timeout: 15_000 });
  });
});
