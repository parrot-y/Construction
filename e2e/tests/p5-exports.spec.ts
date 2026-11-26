import { test, expect, Page } from '@playwright/test';
import { login, apiGet, firstProjectId, Session } from './helpers';

/**
 * P5.10 — slow work off the request path.
 *
 * The Reports tab's Excel buttons no longer hit the synchronous *.xlsx
 * endpoints: they POST an export job, the pg-boss worker builds the
 * workbook, and the file downloads once the job is READY.
 */

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

test.describe('P5.10 — queued report exports', () => {
  let admin: Session;
  let projectId = '';

  test.beforeAll(async ({ request }) => {
    admin = await login(request, 'admin@apexbuilders.co.ke');
    projectId = await firstProjectId(request, admin);
  });

  test('Cost Report export runs as a job and downloads the xlsx', async ({ page, request }) => {
    test.setTimeout(120_000);
    await uiLogin(page);
    await page.goto(`/app/files/reports?project=${projectId}`);
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible({ timeout: 30_000 });

    const exportBtn = page.getByRole('button', { name: 'Export XLSX' }).first();
    await expect(exportBtn).toBeVisible({ timeout: 15_000 });

    // Capture the export POST to prove it is the queued path, not .xlsx.
    const exportPosts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/reports\/(financials|cost)\/export$/.test(r.url())) {
        exportPosts.push(r.url());
      }
    });

    const [download, exportResp] = await Promise.all([
      page.waitForEvent('download', { timeout: 90_000 }),
      page.waitForResponse(
        (r) => r.request().method() === 'POST' && /\/reports\/(financials|cost)\/export$/.test(r.url()),
        { timeout: 30_000 },
      ),
      exportBtn.click(),
    ]);

    expect(exportPosts.length, 'export must POST the queued export endpoint').toBeGreaterThan(0);
    expect(exportResp.status()).toBe(202);
    const { jobId } = (await exportResp.json()).data;
    expect(jobId).toBeTruthy();
    expect(download.suggestedFilename()).toMatch(/cost-report-.*\.xlsx$/);

    // The job row reached READY server-side.
    const job = await apiGet(request, admin, `/api/v1/export-jobs/${jobId}`);
    expect(job.status()).toBe(200);
    const jobData = (await job.json()).data;
    expect(jobData.status).toBe('READY');
    expect(jobData.filename).toBe(download.suggestedFilename());
  });
});
