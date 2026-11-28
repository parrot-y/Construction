import { test, expect, Page } from '@playwright/test';
import { login, apiPost, Session, API } from './helpers';

/**
 * P5.5 — live notifications over SSE.
 *
 * An inbox message written by another team member must reach an open console
 * session without a reload: the SSE stream hints, the app toasts, and the
 * Inbox view refetches through the normal filtered endpoint.
 */

const RUN = Date.now();
const BODY = `Live ping ${RUN} — check the tower crane`;

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

test.describe('P5.5 — live inbox notifications', () => {
  let admin: Session;
  let supervisor: Session;

  test.beforeAll(async ({ request }) => {
    admin = await login(request, 'admin@apexbuilders.co.ke');
    supervisor = await login(request, 'supervisor@apexbuilders.co.ke');
  });

  test('events stream requires authentication', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/events`);
    expect(res.status()).toBe(401);
  });

  test('a teammate message toasts and lands in the open Inbox', async ({ page, request }) => {
    await uiLogin(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 30_000 });

    // Give the EventSource a moment to connect before the write.
    await page.waitForTimeout(1500);

    const send = await apiPost(request, supervisor, '/api/v1/inbox', {
      body: BODY,
      audience: 'ALL_MEMBERS',
    });
    expect(send.status()).toBe(201);

    // Live toast — no reload, no polling wait.
    await expect(page.getByText('New message in your Inbox')).toBeVisible({ timeout: 15_000 });

    // The Inbox tab shows the real message (fetched via the filtered feed).
    // Home mounts the inbox surface more than once, so scope to the first.
    await page.getByRole('tab', { name: 'Inbox' }).or(page.getByRole('button', { name: 'Inbox' })).first().click();
    await expect(page.getByText(BODY).first()).toBeVisible({ timeout: 15_000 });
  });
});
