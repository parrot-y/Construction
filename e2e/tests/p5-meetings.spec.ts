import { test, expect, Page } from '@playwright/test';
import { login, apiGet, apiPatch, firstProjectId, Session } from './helpers';

/**
 * P5.9 — meetings + .ics.
 *
 * A meeting scheduled from the Site → Meetings tab is listed, exports a
 * valid RFC 5545 calendar file, and cancelling flips STATUS:CANCELLED.
 */

const TITLE = 'Weekly site coordination meeting';
const LOCATION = 'Site office, Block B';

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

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test.describe('P5.9 — meetings + .ics', () => {
  let admin: Session;
  let projectId = '';
  let meetingId = '';

  test.beforeAll(async ({ request }) => {
    admin = await login(request, 'admin@apexbuilders.co.ke');
    projectId = await firstProjectId(request, admin);

    // Leftover SCHEDULED meetings with this title (earlier viewport runs)
    // would make the card/API lookups ambiguous — cancel them first.
    const list = await apiGet(request, admin, '/api/v1/meetings');
    const rows = (await list.json()).data || [];
    for (const m of rows.filter((r: any) => r.title === TITLE && r.status === 'SCHEDULED')) {
      await apiPatch(request, admin, `/api/v1/meetings/${m.id}`, { status: 'CANCELLED' });
    }
  });

  test('schedule a meeting, export .ics, cancel it', async ({ page, request }) => {
    test.setTimeout(120_000);
    await uiLogin(page);
    await page.goto(`/app/site/meetings?project=${projectId}`);
    await expect(page.getByRole('heading', { name: 'Meetings' })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: '+ Schedule meeting' }).click();
    await page.getByLabel(/Title/).fill(TITLE);
    const start = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    start.setMinutes(0, 0);
    await page.getByLabel(/^Starts/).fill(toLocalInput(start));
    await page.getByLabel(/^Ends/).fill(toLocalInput(new Date(start.getTime() + 3600 * 1000)));
    await page.getByLabel(/Location/).fill(LOCATION);
    await page.getByLabel(/Attendees/).fill('supervisor@apexbuilders.co.ke, client@example.com');
    await page.getByRole('button', { name: 'Schedule', exact: true }).click();

    // The console's active project may differ from firstProjectId (stored
    // selection wins) — scope lookups tenant-wide, not by projectId.
    const card = page.getByTestId('meeting-card').filter({ hasText: TITLE }).filter({ hasText: 'Scheduled' }).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText('Scheduled', { exact: true })).toBeVisible();

    // Resolve the id server-side and prove the .ics payload.
    const list = await apiGet(request, admin, '/api/v1/meetings');
    expect(list.status()).toBe(200);
    const meetings = (await list.json()).data || [];
    const mine = meetings.find((m: any) => m.title === TITLE && m.status === 'SCHEDULED');
    expect(mine, 'created meeting missing from API list').toBeTruthy();
    meetingId = mine.id;

    const ics = await apiGet(request, admin, `/api/v1/meetings/${meetingId}/ics`);
    expect(ics.status()).toBe(200);
    expect(ics.headers()['content-type']).toContain('text/calendar');
    const body = await ics.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain(`SUMMARY:${TITLE}`);
    expect(body).toContain('supervisor@apexbuilders.co.ke');
    expect(body).not.toContain('STATUS:CANCELLED');

    // The card exposes the download link wired to the same endpoint.
    await expect(card.locator(`a[href="/api/v1/meetings/${meetingId}/ics"]`)).toBeVisible();

    // Cancel from the UI — the chip flips and the .ics marks it cancelled.
    await card.getByRole('button', { name: 'Cancel' }).click();

    // Re-anchor on the meeting's own .ics href — stable across status flips.
    const done = page.locator(`[data-testid="meeting-card"]:has(a[href="/api/v1/meetings/${meetingId}/ics"])`);
    await expect(done.getByText('Cancelled', { exact: true })).toBeVisible({ timeout: 15_000 });

    const icsAfter = await apiGet(request, admin, `/api/v1/meetings/${meetingId}/ics`);
    expect(await icsAfter.text()).toContain('STATUS:CANCELLED');
  });
});
