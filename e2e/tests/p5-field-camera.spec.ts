import { test, expect, Page } from '@playwright/test';
import { login, apiGet, apiPost, unwrap, Session, firstProjectId, API } from './helpers';

/**
 * P5.4 — FIELD camera link end-to-end.
 *
 * A token link issued to a named worker opens a phone-first capture page
 * (no login). The first photo of the day files the site diary with the
 * weather/status the worker picks; every photo carries the device GPS fix
 * and accuracy. Photos are served back through the token-scoped file route.
 */

const RUN = Date.now();
const WORKER = `Field Cam ${RUN}`;
const GEO = { latitude: -1.3011, longitude: 36.8012, accuracy: 9 };

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function openFieldPortal(page: Page, token: string) {
  await page.goto(`/?portal=field&token=${token}`);
  await expect(page.getByTestId('field-portal-view')).toBeVisible({ timeout: 30_000 });
}

test.describe('P5.4 — field camera link', () => {
  let session: Session;
  let projectId: string;
  let fieldToken: string;

  test.beforeAll(async ({ request }) => {
    session = await login(request, 'admin@apexbuilders.co.ke');
    projectId = await firstProjectId(request, session);

    const res = await apiPost(request, session, `/api/v1/projects/${projectId}/portals/links`, {
      portalType: 'FIELD',
      stakeholderName: WORKER,
      stakeholderRole: 'Site Foreman',
      expiresInDays: 7,
    });
    expect(res.status()).toBe(201);
    fieldToken = unwrap(await res.json()).token;
    expect(fieldToken).toBeTruthy();
  });

  test('worker captures the daily photo with GPS — no login required', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      permissions: ['geolocation'],
      geolocation: GEO,
    });
    const page = await context.newPage();
    try {
      await openFieldPortal(page, fieldToken);

      // Context: project name, worker name. Diary state depends on whether an
      // earlier viewport run already filed today — handle both honestly.
      await expect(page.getByText(WORKER)).toBeVisible();
      const alreadyFiled = await page.getByText(/today's diary filed/i).isVisible().catch(() => false);
      const captionText = `Field shot ${RUN}`;

      if (!alreadyFiled) {
        await expect(page.getByText(/first photo of the day/i)).toBeVisible();
        await page.getByRole('button', { name: 'Sunny', exact: true }).click();
        await page.getByRole('button', { name: 'Working', exact: true }).click();
      }
      await page.getByTestId('field-caption-input').fill(captionText);

      await page.getByTestId('field-camera-input').setInputFiles({
        name: `field-daily-${RUN}.png`,
        mimeType: 'image/png',
        buffer: PNG,
      });

      await expect(page.getByTestId('field-notice')).toContainText(
        alreadyFiled ? /added to today's site diary/i : /photo saved/i,
        { timeout: 30_000 },
      );
      if (!alreadyFiled) {
        await expect(page.getByText(/today's diary filed/i)).toBeVisible();
      }

      // Server truth: context endpoint reports our photo with the device fix.
      const ctxRes = await context.request.get(`${API}/api/v1/portals/field/${fieldToken}`);
      expect(ctxRes.status()).toBe(200);
      const ctx = unwrap(await ctxRes.json());
      expect(ctx.diary).not.toBeNull();
      if (!alreadyFiled) expect(ctx.diary.weather).toBe('SUNNY_CLEAR');
      const mine = ctx.photos.find((p: any) => p.caption === captionText);
      expect(mine, 'captured photo missing from field context').toBeTruthy();
      expect(mine.gpsLatitude).toBeCloseTo(GEO.latitude, 3);
      expect(mine.gpsAccuracyMeters).toBeCloseTo(GEO.accuracy, 0);
      const countAfterFirst = ctx.photos.length;

      // Token-scoped file route serves the actual image bytes to the worker.
      const imgRes = await context.request.get(`${API}${mine.url}`);
      expect(imgRes.status()).toBe(200);
      expect(imgRes.headers()['content-type']).toContain('image/');

      // A second capture the same day attaches without re-filing the diary.
      await page.getByTestId('field-camera-input').setInputFiles({
        name: `field-daily-2-${RUN}.png`,
        mimeType: 'image/png',
        buffer: PNG,
      });
      await expect(page.getByTestId('field-notice')).toContainText(/added to today's site diary/i, { timeout: 30_000 });

      const ctx2Res = await context.request.get(`${API}/api/v1/portals/field/${fieldToken}`);
      const ctx2 = unwrap(await ctx2Res.json());
      expect(ctx2.photos.length).toBe(countAfterFirst + 1);
    } finally {
      await context.close();
    }
  });

  test('invalid token shows the honest link error, not a crash', async ({ page }) => {
    await page.goto('/?portal=field&token=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
    await expect(page.getByTestId('field-portal-error')).toBeVisible({ timeout: 30_000 });
  });
});
