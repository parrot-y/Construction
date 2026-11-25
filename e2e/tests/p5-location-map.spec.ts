import { test, expect, Page } from '@playwright/test';
import { login, apiGet, unwrap, Session } from './helpers';

/**
 * P5 — real device location end-to-end.
 *
 * 1. Diary photo captured with a granted geolocation fix must persist the
 *    device coordinates AND accuracy — never a hardcoded default.
 * 2. Site → Map tab renders the map surface (leaflet or honest empty state).
 */

const RUN = Date.now();
const GEO = { latitude: -1.2921, longitude: 36.8219, accuracy: 12 };

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

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

test.describe('P5 — location capture & project map', () => {
  let session: Session;

  test.beforeAll(async ({ request }) => {
    session = await login(request, 'admin@apexbuilders.co.ke');
  });

  test('diary photo carries the real device fix with accuracy', async ({ page, context, request }) => {
    await context.grantPermissions(['geolocation']).catch(() => {});
    await context.setGeolocation(GEO);
    await uiLogin(page);

    await page.goto(`/app/site/dailylog`);
    await page.getByRole('button', { name: /new daily log/i }).click();
    const dialog = page.locator('div.fixed.inset-0').last();
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // Attach a photo — the modal requests a device fix at pick time.
    const fileInput = dialog.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles({ name: `site-evidence-${RUN}.png`, mimeType: 'image/png', buffer: PNG });

    // Wait for the GPS badge to resolve (fix or honest "no fix" — never fake).
    await expect(dialog.getByText(/GPS ±|No GPS fix|Getting location/)).toBeVisible({ timeout: 15_000 });

    await dialog.getByRole('button', { name: /record daily site diary/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 30_000 });

    // The UI writes to whichever project is active in the picker — find the
    // photo carrying THIS run's device fix across the tenant's projects.
    const projectsRes = await apiGet(request, session, '/api/v1/projects');
    const projectsBody = unwrap(await projectsRes.json());
    const projects = Array.isArray(projectsBody) ? projectsBody : projectsBody?.data ?? projectsBody?.projects ?? [];
    let photo: any = null;
    for (const p of projects) {
      const pid = p.id;
      if (!pid) continue;
      const listRes = await apiGet(request, session, `/api/v1/projects/${pid}/site-diaries`);
      if (listRes.status() !== 200) continue;
      const rows = unwrap(await listRes.json());
      const diaries = Array.isArray(rows) ? rows : rows?.data ?? rows?.diaries ?? [];
      photo = diaries
        .flatMap((d: any) => d.photos ?? [])
        .find((ph: any) => {
          const la = parseFloat(String(ph.gps_latitude));
          const lo = parseFloat(String(ph.gps_longitude));
          return Number.isFinite(la) && Math.abs(la - GEO.latitude) < 0.001
            && Number.isFinite(lo) && Math.abs(lo - GEO.longitude) < 0.001;
        });
      if (photo) break;
    }
    expect(photo, 'no photo persisted with the device fix').toBeTruthy();
    expect(photo.gps_accuracy_meters, 'accuracy not persisted').not.toBeNull();
    expect(parseFloat(String(photo.gps_accuracy_meters))).toBeCloseTo(GEO.accuracy, 0);
  });

  test('site map tab renders the map surface', async ({ page }) => {
    await uiLogin(page);
    await page.goto('/app/site/map');
    // Either the leaflet canvas or the honest "no location data" state.
    await expect(
      page.locator('.leaflet-container').or(page.getByText(/no location data yet/i)),
    ).toBeVisible({ timeout: 30_000 });
  });
});
