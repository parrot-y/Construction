import { test, expect, APIRequestContext, Page, Locator } from '@playwright/test';
import { API, login, apiGet, apiPost, unwrap, fixtureName, Session } from './helpers';

/**
 * A6 — break-it coverage for EVERY primary save in the admin console.
 *
 * p1-break-it covers project create, invite, quote and variation. This spec
 * extends the same honest-failure contract to the remaining primary saves:
 *
 *   BoQ line · site diary · snag · inspection · safety incident ·
 *   purchase order · invoice · payment · subcontractor valuation ·
 *   payment certificate (IPC) · subcontractor package · company document ·
 *   announcement.
 *
 * Per surface, one serial test runs:
 *   1. injected 403 / 409 / 422 / 500  → plain-language error, form kept
 *   2. offline (context.setOffline)    → queued notice or honest error
 *   3. API connection refused          → plain error or offline queue
 *   4. double-click submit             → exactly one record (API-verified)
 *
 * Diary is special: transport failures legitimately queue offline, so its
 * api-stop/offline checks accept the queued notice; HTTP error statuses must
 * still surface as errors (regression: the modal used to queue on 403 too).
 */

const RUN = Date.now();
const PASSWORD = 'PaBreak#2026';
const PROJECT = { name: '', code: '', id: '' };
const FIX = { supplierName: '', invoiceId: '', invoiceTitle: '', pkgFirmName: '' };
let admin: Session;

const marker = (key: string) => `BRK-${key}-${String(RUN).slice(-6)}`;

async function registerAndLogin(request: APIRequestContext) {
  const email = `admin.${RUN}@pa-break.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: {
      companyName: fixtureName('company', `${RUN}-pabreak-co`),
      adminFullName: 'Wanjiru Test',
      email,
      phone: '+254712000999',
      password: PASSWORD,
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  admin = await login(request, email, PASSWORD);
}

/** Cookie-injected session — same cookie the login form produces. */
async function uiLogin(page: Page) {
  const cookies = admin.cookie.split(/;\s*/).map((pair) => {
    const i = pair.indexOf('=');
    return { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim(), domain: 'localhost', path: '/' };
  });
  await page.context().addCookies(cookies);
}

async function gotoConsole(page: Page, path: string) {
  await page.goto(`/app${path}?project=${PROJECT.id}`);
  await expect(page.getByRole('navigation', { name: 'Workspace sections' }).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800);
}

/** Broad honest-error locator — InlineError (role=alert) plus the rose/red
 *  banners used by older views. */
function errorBox(page: Page): Locator {
  return page.locator('[role="alert"], [data-testid$="-error"], .bg-rose-50, .bg-red-50').first();
}

async function assertPlainError(page: Page) {
  const box = errorBox(page);
  await expect(box).toBeVisible({ timeout: 20_000 });
  const text = (await box.textContent()) || '';
  expect(text).not.toMatch(/Failed to fetch|TypeError|ECONNREFUSED|SyntaxError|\{.*"status"/i);
  expect(text.trim().length).toBeGreaterThan(8);
}

/** Count RECORDS containing `mark` — an entity may carry the marker in
 *  several fields (snag location + description), so count list elements,
 *  not string occurrences. */
function countMarkedRecords(node: unknown, mark: string): number {
  let best = 0;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) {
      const c = v.filter((el) => JSON.stringify(el).includes(mark)).length;
      if (c > best) best = c;
      v.forEach(walk);
    } else if (v && typeof v === 'object') {
      Object.values(v as Record<string, unknown>).forEach(walk);
    }
  };
  walk(node);
  return best;
}

/** Count list records containing `mark` inside a JSON API response body. */
async function countMarker(request: APIRequestContext, path: string, mark: string): Promise<number> {
  const res = await apiGet(request, admin, path);
  expect(res.status(), `${path} -> ${res.status()}`).toBe(200);
  return countMarkedRecords(await res.json(), mark);
}

interface Ctx { page: Page; request: APIRequestContext; mark: string }
interface Surface {
  key: string;
  screen: string;
  /** Console path under /app (project query appended automatically). */
  path: string;
  /** Open the form and fill every required field with the marker. */
  prepare: (c: Ctx) => Promise<void>;
  /** Locator for the primary save control. */
  submit: (c: Ctx) => Locator;
  /** Route predicate identifying THE save POST. */
  postMatch: (method: string, url: string) => boolean;
  /** API path searched for the marker after double-submit. */
  verifyPath: () => string;
  verify?: (c: Ctx) => Promise<number>;
  /** 'queued' = transport failure legitimately queues (diary). */
  offlineMode?: 'queued';
}

const postFrag = (frag: string) => (method: string, url: string) =>
  method === 'POST' && url.includes(frag);
const postPath = (pathname: string) => (method: string, url: string) =>
  method === 'POST' && new URL(url).pathname === pathname;
const postRe = (re: RegExp) => (method: string, url: string) =>
  method === 'POST' && re.test(new URL(url).pathname);

const lastFixed = (page: Page) => page.locator('div.fixed.inset-0').last();

const SURFACES: Surface[] = [
  {
    key: 'boq',
    screen: 'Money → Financials → Bill of quantities', path: '/money/financials',
    async prepare({ page, mark }) {
      await page.getByRole('button', { name: 'Bill of quantities' }).click();
      await page.getByRole('button', { name: 'Add item' }).click();
      const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save item' }) }).first();
      await form.getByLabel('Description').fill(`${mark} foundation blinding`);
      await form.getByLabel('Qty').fill('10');
      await form.getByLabel('Rate (KES)').fill('5000');
    },
    submit: ({ page }) => page.getByRole('button', { name: 'Save item' }),
    postMatch: postFrag('/boq/items'),
    verifyPath: () => '',
    verify: async ({ request, mark }) => countMarker(request, `/api/v1/projects/${PROJECT.id}/boq`, mark),
  },
  {
    key: 'diary',
    screen: 'Site → Daily log', path: '/site/dailylog',
    async prepare({ page, mark }) {
      await page.getByRole('button', { name: 'New daily log' }).click();
      await page.getByPlaceholder('Activities completed').fill(`${mark} foundation pour completed on grid C4`);
    },
    submit: ({ page }) => page.getByRole('button', { name: 'Record Daily Site Diary' }),
    postMatch: postFrag('/site-diaries'),
    verifyPath: () => `/api/v1/projects/${PROJECT.id}/site-diaries`,
    offlineMode: 'queued',
  },
  {
    key: 'snag',
    screen: 'Site → Punch list (snag)', path: '/site/punch',
    async prepare({ page, mark }) {
      await page.getByRole('button', { name: '+ Add Snag Item' }).click();
      const modal = lastFixed(page);
      await expect(modal).toBeVisible({ timeout: 15_000 });
      await modal.getByPlaceholder('e.g. Room 204 Ensuite').fill(`${mark} location`);
      await modal.getByPlaceholder('State precise defect').fill(`${mark} honeycombed column face`);
    },
    submit: ({ page }) => lastFixed(page).getByRole('button', { name: 'Add Snag Item' }),
    postMatch: postFrag('/snags'),
    verifyPath: () => `/api/v1/projects/${PROJECT.id}/snags`,
    offlineMode: 'queued',
  },
  {
    key: 'inspection',
    screen: 'Site → Inspections', path: '/site/inspections',
    async prepare({ page, mark }) {
      await page.getByRole('button', { name: 'New Request' }).click();
      const modal = lastFixed(page);
      await expect(modal).toBeVisible({ timeout: 15_000 });
      await modal.getByPlaceholder('e.g. Block B, 2nd floor slab').fill(`${mark} location`);
      await modal.locator('textarea').fill(`${mark} pre-pour inspection request`);
    },
    submit: ({ page }) => page.getByRole('button', { name: 'Submit request' }),
    postMatch: postFrag('/inspections'),
    verifyPath: () => `/api/v1/projects/${PROJECT.id}/inspections`,
  },
  {
    key: 'safety',
    screen: 'Site → Safety incident', path: '/site/safety',
    async prepare({ page, mark }) {
      await page.getByRole('button', { name: 'Log Safety Incident' }).click();
      const modal = lastFixed(page);
      await expect(modal).toBeVisible({ timeout: 15_000 });
      await modal.getByPlaceholder('e.g. Scaffolding Grid C-2').fill(`${mark} location`);
      await modal.getByPlaceholder('Detailed narrative').fill(`${mark} near-miss at edge protection`);
    },
    submit: ({ page }) => lastFixed(page).getByRole('button', { name: 'Save Incident Entry' }),
    postMatch: postFrag('/safety-incidents'),
    verifyPath: () => `/api/v1/projects/${PROJECT.id}/safety-incidents`,
    offlineMode: 'queued',
  },
  {
    key: 'po',
    screen: 'Money → Procurement (PO)', path: '/money/procurement',
    async prepare({ page, mark }) {
      await page.getByTestId('new-po-btn').click();
      await page.getByTestId('po-supplier-select').selectOption({ label: FIX.supplierName });
      await page.getByTestId('po-line-desc-0').fill(`${mark} cement supply`);
      await page.getByTestId('po-line-qty-0').fill('20');
      await page.getByTestId('po-line-rate-0').fill('850');
    },
    submit: ({ page }) => page.getByTestId('po-create-submit'),
    postMatch: postFrag('/purchase-orders'),
    verifyPath: () => `/api/v1/projects/${PROJECT.id}/purchase-orders`,
  },
  {
    key: 'invoice',
    screen: 'Money → Invoices (draft)', path: '/money/invoices',
    async prepare({ page, mark }) {
      await page.getByRole('button', { name: '+ New Invoice' }).click();
      const form = page.locator('form').filter({ has: page.getByRole('button', { name: /Save Draft Invoice/ }) });
      await form.locator('input').nth(0).fill(`${mark} progress claim`);
      await form.locator('input').nth(1).fill('Breakit Client Ltd');
      await page.getByPlaceholder('Description *').fill(`${mark} certified works`);
      await page.getByPlaceholder('Rate').fill('250000');
    },
    submit: ({ page }) => page.getByRole('button', { name: /Save Draft Invoice/ }),
    postMatch: postPath('/api/v1/invoices'),
    verifyPath: () => '/api/v1/invoices',
  },
  {
    key: 'payment',
    screen: 'Money → Invoices → record payment', path: '/money/invoices',
    async prepare({ page, mark }) {
      const row = page.locator('tr', { hasText: FIX.invoiceTitle }).first();
      await row.getByRole('button', { name: 'Record payment' }).click();
      const payForm = page.locator('div.border-emerald-200').last();
      await payForm.locator('input[type="number"]').first().fill('50000');
      await payForm.locator('input:not([type="number"])').last().fill(`${mark} mpesa ref`);
    },
    submit: ({ page }) => page.getByRole('button', { name: 'Save payment' }),
    postMatch: postRe(/^\/api\/v1\/invoices\/[^/]+\/payments$/),
    verifyPath: () => '',
    verify: async ({ request, mark }) => countMarker(request, `/api/v1/invoices/${FIX.invoiceId}`, mark),
  },
  {
    key: 'valuation',
    screen: 'Money → Subcontractor valuations', path: '/money/subvaluations',
    async prepare({ page, mark }) {
      await page.getByRole('button', { name: 'New Subcontractor Claim' }).click();
      const modal = lastFixed(page);
      await expect(modal).toBeVisible({ timeout: 15_000 });
      await modal.locator('select').first().selectOption({ label: `${FIX.pkgFirmName} (PLUMBING)` });
      await modal.getByPlaceholder('e.g. 1500000').fill('1500000');
      await modal.getByPlaceholder('e.g. Scope inspected on site, materials verified').fill(`${mark} claim notes`);
    },
    submit: ({ page }) => page.getByRole('button', { name: 'Issue Certificate' }),
    postMatch: postFrag('/subcontractor-valuations'),
    verifyPath: () => `/api/v1/projects/${PROJECT.id}/subcontractor-valuations`,
  },
  {
    key: 'certificate',
    screen: 'Money → Certificates (IPC)', path: '/money/certificates',
    async prepare({ page, mark }) {
      await page.getByRole('button', { name: '+ New IPC from progress' }).click();
      // Preview must be built from the seeded BoQ progress fixture.
      await expect(page.getByText(/This period \(KES\)|No uncertified progress/).first()).toBeVisible({ timeout: 25_000 });
      const notes = page.locator('div.border.rounded-xl.p-4').last().locator('input[type="text"]');
      if (await notes.count()) await notes.first().fill(`${mark} ipc notes`);
    },
    submit: ({ page }) => page.getByRole('button', { name: 'Draft IPC' }),
    postMatch: postRe(/^\/api\/v1\/projects\/[^/]+\/payment-certificates$/),
    verifyPath: () => `/api/v1/projects/${PROJECT.id}/payment-certificates`,
  },
  {
    key: 'subcontractor',
    screen: 'People → Subcontractors', path: '/people/subcontractors',
    async prepare({ page, mark }) {
      await page.getByRole('button', { name: 'Award Subcontract Package' }).click();
      const modal = lastFixed(page);
      await expect(modal).toBeVisible({ timeout: 15_000 });
      const inputs = modal.locator('form input');
      // DOM order: firm name, retention %, contact, phone, subcontract sum.
      await inputs.nth(0).fill(`${mark} plumbing services`);
      await inputs.nth(1).fill('10');
      await inputs.nth(4).fill('500000');
    },
    submit: ({ page }) => lastFixed(page).getByRole('button', { name: 'Award Subcontract' }),
    postMatch: postRe(/^\/api\/v1\/projects\/[^/]+\/subcontractors$/),
    verifyPath: () => `/api/v1/projects/${PROJECT.id}/subcontractors`,
  },
  {
    key: 'doc',
    screen: 'Files → Company documents', path: '/files/companydocs',
    async prepare({ page, mark }) {
      await page.getByRole('button', { name: '+ Upload' }).click();
      await page.getByPlaceholder('e.g. NCA Registration Certificate').fill(`${mark} insurance certificate`);
      await page.getByPlaceholder('certificate.pdf').fill('brk-certificate.pdf');
    },
    submit: ({ page }) => page.getByRole('button', { name: 'Upload document' }),
    postMatch: postPath('/api/v1/company/documents'),
    verifyPath: () => '/api/v1/company/documents',
  },
  {
    key: 'announcement',
    screen: 'Home → Announcements', path: '',
    async prepare({ page, mark }) {
      await page.goto('/app');
      await page.getByRole('tab', { name: 'Announcements' }).click();
      await page.getByRole('button', { name: '+ New Announcement' }).click();
      await page.getByPlaceholder('Title').fill(`${mark} site notice`);
      await page.getByPlaceholder('Message body…').fill(`${mark} tower crane lift scheduled Saturday`);
    },
    submit: ({ page }) => page.getByRole('button', { name: 'Publish' }),
    postMatch: postPath('/api/v1/announcements'),
    verifyPath: () => '/api/v1/announcements',
  },
];

async function setupFixtures(request: APIRequestContext) {
  PROJECT.name = fixtureName('project', `${RUN}-pabr`);
  PROJECT.code = `BRK-${String(RUN).slice(-6)}`;
  const pr = await apiPost(request, admin, '/api/v1/projects', { name: PROJECT.name, code: PROJECT.code });
  expect(pr.status(), await pr.text()).toBe(201);
  PROJECT.id = unwrap(await pr.json()).id;

  FIX.supplierName = fixtureName('supplier', `${RUN}-pabr-sup`);
  const sr = await apiPost(request, admin, '/api/v1/suppliers', { name: FIX.supplierName, phone: '+254711223344' });
  expect(sr.status(), await sr.text()).toBeLessThan(300);

  FIX.pkgFirmName = fixtureName('subcontractor', `${RUN}-pabr-pkg`);
  const kr = await apiPost(request, admin, `/api/v1/projects/${PROJECT.id}/subcontractors`, {
    tradeCategory: 'PLUMBING', firmName: FIX.pkgFirmName,
    subcontractSum: '600000.00', retentionRatePct: '10.00', status: 'ACTIVE',
  });
  expect(kr.status(), await kr.text()).toBeLessThan(300);

  // SENT invoice for the payment surface.
  FIX.invoiceTitle = `${fixtureName('invoice', `${RUN}-pabr-inv`)} BRK-${String(RUN).slice(-4)}`;
  const ir = await apiPost(request, admin, '/api/v1/invoices', {
    title: FIX.invoiceTitle, clientName: 'Breakit Client Ltd',
    items: [{ description: 'Fixture certified works', unit: 'item', quantity: 1, unitRate: 120000 }],
  });
  expect(ir.status(), await ir.text()).toBeLessThan(300);
  const inv = unwrap(await ir.json());
  FIX.invoiceId = inv.id || inv.invoice?.id;
  const send = await apiPost(request, admin, `/api/v1/invoices/${FIX.invoiceId}/send`, {});
  if (send.status() === 409) {
    await apiPost(request, admin, `/api/v1/invoices/${FIX.invoiceId}/send`, {
      selfApprovalReason: 'Break-it fixture invoice send — sole admin on test tenant',
    });
  }

  // BoQ item + recorded progress → payment-certificate preview has lines.
  const br = await apiPost(request, admin, `/api/v1/projects/${PROJECT.id}/boq/items`, {
    description: 'IPC fixture — foundation works', unit: 'm', quantity: 10, unitRate: 5000,
  });
  expect(br.status(), await br.text()).toBeLessThan(300);
  const boqItem = unwrap(await br.json());
  const boqItemId = boqItem.id || boqItem.item?.id || boqItem.data?.id;
  const today = new Date().toISOString().slice(0, 10);
  const prg = await apiPost(request, admin, `/api/v1/projects/${PROJECT.id}/progress`, {
    recordDate: today, overallProgress: '0.0500',
    items: [{ boqItemId, completedQuantity: '5.0000', completionPct: '0.5000' }],
  });
  expect(prg.status(), await prg.text()).toBeLessThan(300);
}

test.describe.serial('A6 break-it — every primary admin save', () => {
  test.beforeAll(async ({ request }) => {
    await registerAndLogin(request);
    await setupFixtures(request);
  });

  for (const s of SURFACES) {
    test(`${s.screen} — honest failures + single record`, async ({ page, request, context }) => {
      test.setTimeout(300_000);
      const mark = marker(s.key);
      await uiLogin(page);
      const ctx: Ctx = { page, request, mark };

      const reopen = async () => {
        if (s.path) await gotoConsole(page, s.path);
        await s.prepare(ctx);
      };

      await reopen();

      // 1. Injected HTTP errors — each must show a plain message, keep the form.
      for (const status of [403, 409, 422, 500]) {
        await page.unrouteAll();
        await page.route('**/api/v1/**', (route) => {
          const req = route.request();
          if (s.postMatch(req.method(), req.url())) {
            return route.fulfill({
              status,
              contentType: 'application/json',
              body: JSON.stringify({ message: `Injected ${status} for A6 break-it` }),
            });
          }
          return route.continue();
        });
        await s.submit(ctx).click({ timeout: 10_000 }).catch(() => {});
        await assertPlainError(page);
        await page.waitForTimeout(300);
      }
      await page.unrouteAll();

      // 2. Offline — queued notice (diary) or honest error; never blank/raw.
      await context.setOffline(true);
      await s.submit(ctx).click({ timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const offlineText = (await page.locator('main').last().textContent().catch(() => '')) || '';
      expect(offlineText).not.toMatch(/Failed to fetch|TypeError|ERR_INTERNET_DISCONNECTED/i);
      if (s.offlineMode === 'queued') {
        const modalGone = await page.locator('div.fixed.inset-0', { hasText: /Record Daily Site Diary|Add Snag Item|Safety Incident|Incident/i }).count().then((n) => n === 0);
        const queued = await page.getByText(/queued|offline|will sync|saved locally/i).first().isVisible().catch(() => false);
        expect(queued || modalGone, 'diary should queue offline or close with notice').toBeTruthy();
      } else {
        await assertPlainError(page);
      }
      await context.setOffline(false);
      await page.waitForTimeout(500);

      // 3. API connection refused — same honest contract.
      await page.route('**/api/v1/**', (route) => {
        const req = route.request();
        if (s.postMatch(req.method(), req.url())) return route.abort('connectionrefused');
        return route.continue();
      });
      await reopen().catch(() => {});
      await s.submit(ctx).click({ timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const refusedText = (await page.locator('main').last().textContent().catch(() => '')) || '';
      expect(refusedText).not.toMatch(/Failed to fetch|TypeError|ERR_INTERNET_DISCONNECTED/i);
      if (s.offlineMode === 'queued') {
        // navigator.onLine is still true on api-stop, so the honest outcomes
        // are: queued-close (if the view treats it as offline) OR an inline
        // error in the still-open form.
        const modalGone2 = await page.locator('div.fixed.inset-0', { hasText: /Record Daily Site Diary|Add Snag Item|Safety Incident|Incident/i }).count().then((n) => n === 0);
        const queuedText = /queued|offline|will sync|saved locally/i.test(refusedText);
        if (!(modalGone2 || queuedText)) await assertPlainError(page);
      } else {
        await assertPlainError(page);
      }
      await page.unrouteAll();

      // 4. Double-click → exactly one NEW record (API-verified delta).
      //    Queue-capable surfaces (diary/snag/safety) may still be flushing a
      //    legitimately queued offline write, so measure the delta around the
      //    submit rather than the absolute count.
      await reopen().catch(() => {});
      const countNow = () => (s.verify ? s.verify(ctx) : countMarker(request, s.verifyPath(), mark));
      const before = await countNow();
      const submit = s.submit(ctx);
      await submit.click({ timeout: 15_000 }).catch(() => {});
      await submit.click({ force: true, timeout: 2_000 }).catch(() => {});
      await page.waitForTimeout(4000);
      const after = await countNow();
      expect(after - before, `${s.screen}: double-submit created ${after - before} records (expected 1)`).toBe(1);
    });
  }
});
