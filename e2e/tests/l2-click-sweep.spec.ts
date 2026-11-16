import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { API, login, apiPost, apiGet, unwrap, Session } from './helpers';

/**
 * ROUND L2 — CLICK-THROUGH SWEEP: no dead button may ship.
 *
 * Signs in as company admin (and PM/QS), walks every console section and
 * tab, and clicks every visible button/link. A click must produce at
 * least one of: URL change, visible DOM mutation, or a network request.
 * Anything else is a dead control and fails the suite. Same sweep on
 * the PM/QS console and on every external portal landing page.
 *
 * Skip list (documented in-test): controls that mutate server state on
 * a bare click (approve/pay/accept/submit/delete…), file pickers,
 * downloads/print, sign-out, retry/refresh, clipboard, already-selected
 * tab/filter states, and pure navigation chrome handled elsewhere.
 */

const RUN = Date.now();
const PASSWORD = 'L2Sweep#2026';

const S: {
  admin?: Session; pm?: Session;
  projectId?: string;
  tokens: Record<string, string>;
  quoteToken?: string;
} = { tokens: {} };

// ---- skip list: bare-click mutations, pickers, downloads, session ----
const SKIP = new RegExp(
  [
    'sign out', 'log ?out', 'delete', 'revoke', 'remove', 'archive', 'void',
    'reject', 'decline', 'approve', 'authori', 'pay\\b', 'payment', 'settle',
    'submit', 'send\\b', 'invoice', 'confirm', 'acknowledge', 'acknowledg',
    'close out', 'closeout', 'verify', 'rectif', 'resolve', 'assign',
    'check-?in', 'check-?out', 'clock', 'save\\b', 'update', 'edit\\b',
    'create', 'new project', 'new\\b', 'invite', 'upload', 'import',
    'export', 'download', 'print', 'copy', 'refresh', 'retry',
    'load more', 'show more', 'show all', 'see all', 'view all',
    'next page', 'previous page', 'ask ai', 'respond', 'deliver',
    'record', 'certif', 'release', 'issue', 'award', 'post\\b',
    'accept', 'complete', 'finish', 'start\\b', 'end\\b', 'sign\\b',
    '\\.pdf', '\\.xlsx', 'download=',
  ].join('|'),
  'i',
);

const CONSOLE_TABS: Record<string, string[]> = {
  home: ['dashboard', 'inbox', 'announcements'],
  projects: ['all', 'schedule', 'drawings', 'changeorders', 'coordination', 'correspondence'],
  site: ['fieldview', 'dailylog', 'checklists', 'assignments', 'punch', 'inspections', 'observations', 'actionplans', 'safety', 'attendance'],
  money: ['financials', 'commitments', 'procurement', 'quotes', 'invoices', 'inventory', 'certificates', 'subvaluations', 'billing'],
  people: ['team', 'crews', 'subcontractors', 'directory', 'roles'],
  files: ['reports', 'companydocs', 'unfiled'],
};
const PM_TABS: Record<string, string[]> = {
  ...CONSOLE_TABS,
  money: ['financials', 'commitments', 'procurement', 'quotes', 'invoices', 'inventory', 'certificates', 'subvaluations'],
};

async function register(request: APIRequestContext): Promise<Session> {
  const email = `admin.${RUN}@l2-sweep.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: { companyName: 'L2 Sweep Contractors Ltd', adminFullName: 'Wanjiru Njoroge', email, phone: '+254712000444', password: PASSWORD },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}

async function invite(request: APIRequestContext, admin: Session, key: string, role: string, name: string): Promise<Session> {
  const email = `${key}.${RUN}@l2-sweep.test`;
  const inv = await apiPost(request, admin, '/api/v1/invitations', { email, role });
  expect(inv.status(), await inv.text()).toBe(201);
  const token = unwrap(await inv.json()).token;
  const acc = await request.post(`${API}/api/v1/invitations/accept`, { data: { token, fullName: name, password: PASSWORD } });
  expect(acc.status(), await acc.text()).toBeLessThan(300);
  return login(request, email, PASSWORD);
}

async function uiLogin(page: Page, email: string, ready: import('@playwright/test').Locator) {
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  }
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(ready).toBeVisible({ timeout: 30_000 });
}

/** Arm a mutation counter + cheap fingerprint (url, dialog count, html size). */
async function armProbe(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__l2mut = 0;
    if (!w.__l2obs) {
      w.__l2obs = new MutationObserver(() => { w.__l2mut += 1; });
      w.__l2obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    }
  });
}
async function probe(page: Page) {
  return page.evaluate(() => ({
    url: location.href,
    mut: (window as any).__l2mut || 0,
    dialogs: document.querySelectorAll('[role="dialog"], .fixed.inset-0').length,
  }));
}

/**
 * Click every eligible control in scope; return no-op offender strings.
 * scopeSelector defaults to 'main' (console) — portals pass 'body'.
 */
async function sweep(page: Page, label: string, scopeSelector = 'main', maxItems = 120, swept?: Set<string>): Promise<string[]> {
  const offenders: string[] = [];
  const scope = page.locator(scopeSelector);
  // One DOM pass collects every candidate's metadata — no per-element
  // locator round-trips (the :visible pseudo was the bottleneck).
  const collect = () => scope.locator('button, a').evaluateAll((els) =>
    els.map((el, idx) => {
      const h = el as HTMLElement;
      const visible = !!(h.offsetWidth || h.offsetHeight || h.getClientRects().length);
      if (!visible) return null;
      return {
        idx,
        text: ((el.textContent || el.getAttribute('aria-label') || '') as string).trim().slice(0, 60),
        href: el.getAttribute('href') || '',
        sel: el.getAttribute('aria-selected'),
        pressed: el.getAttribute('aria-pressed'),
        current: el.getAttribute('aria-current'),
        disabled: (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true',
      };
    }).filter(Boolean) as any[]);
  let metas = await collect();
  console.log(`[sweep ${label}] collect: ${metas.length} candidates`);
  let reqCount = 0;
  let popupCount = 0;
  const onReq = () => { reqCount += 1; };
  const onPopup = () => { popupCount += 1; };
  // Context-level request event catches export/download/popup traffic that
  // page.on('request') misses (window.open targets are separate pages).
  page.context().on('request', onReq);
  page.on('popup', onPopup);
  await armProbe(page);
  let done = 0;

  const tStart = Date.now();
  let pos = 0;
  let rescans = 0;
  let scanned = 0;
  while (pos < metas.length && rescans < 8 && scanned < maxItems * 3) {
    scanned += 1;
    const meta = metas[pos];
    pos += 1;
    const desc = meta.text;
    const sig = `${meta.href}|${desc}`;
    if (swept?.has(sig)) continue; // chrome repeated on every tab — sweep once
    // Clear any overlay a previous click failed to dismiss — a lingering
    // modal/menu can mask the effect of the next DOM click.
    const openNow = await page.evaluate(() => document.querySelectorAll('[role="dialog"], .fixed.inset-0').length).catch(() => 0);
    if (openNow > 0) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(120);
    }
    swept?.add(sig);
    if (meta.disabled || (!desc && !meta.href)) continue;
    if (meta.sel === 'true' || meta.pressed === 'true' || meta.current) continue;
    if (SKIP.test(desc) || SKIP.test(meta.href)) continue;

    console.log(`[sweep ${label}] click "${desc || meta.href}"`);
    const reqBefore = reqCount;
    const popupBefore = popupCount;
    // Whole iteration raced against a hard budget — a click that wedges
    // the page (native dialog, stuck navigation) is itself a finding.
    const iter = (async () => {
      const b = await probe(page);
      // Find-and-click by signature in one evaluate — no indices at all,
      // so SPA re-renders can't drift the target onto a different control.
      const sel = `${scopeSelector} button, ${scopeSelector} a`;
      let clickedOk = false;
      for (let attempt = 0; attempt < 2 && !clickedOk; attempt++) {
        try {
          clickedOk = await page.evaluate(([s2, wantSig]) => {
            const els = [...document.querySelectorAll(s2)] as HTMLElement[];
            const node = els.find((el) => {
              if (!el.isConnected) return false;
              const r = el.getBoundingClientRect();
              if (!r.width && !r.height) return false;
              const txt = ((el.textContent || el.getAttribute('aria-label') || '') as string).trim().slice(0, 60);
              const href = el.getAttribute('href') || '';
              return `${href}|${txt}` === wantSig;
            });
            if (!node) return false;
            node.click();
            return true;
          }, [sel, sig]);
        } catch { /* retry */ }
        if (!clickedOk && attempt === 0) await page.waitForTimeout(200);
      }
      if (!clickedOk) {
        // Distinguish "re-rendered away" (not a defect) from a real dead node.
        const again = (await collect()).some((m: any) => `${m.href}|${m.text}` === sig);
        return { kind: again ? ('unclickable' as const) : ('gone' as const) };
      }
      await page.waitForTimeout(350);
      const a = await probe(page);
      return { kind: 'ok' as const, before: b, after: a, popups: popupCount };
    })();
    const raced = await Promise.race([
      iter,
      new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 12_000)),
    ]);
    if (raced === 'timeout') {
      const stuckUrl = await page.url().catch(() => '?');
      offenders.push(`[${label}] wedged page (>12s) at ${stuckUrl}: "${desc || meta.href}"`);
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      return offenders;
    }
    if (raced.kind === 'unclickable') {
      offenders.push(`[${label}] unclickable: "${desc || meta.href}"`);
      continue;
    }
    if (raced.kind === 'gone') continue; // re-rendered away — not a defect
    const { before, after } = raced;
    let acted = before.url !== after.url || after.mut > before.mut || before.dialogs !== after.dialogs
      || reqCount > reqBefore || raced.popups > popupBefore;
    if (!acted) {
      // Confirmation pass with a REAL click — DOM .click() can land on a
      // node mid-remount (SPA transition) and silently do nothing. If a
      // genuine actionability click also produces nothing, it is dead.
      const fresh = await collect();
      const again = fresh.find((m: any) => `${m.href}|${m.text}` === sig);
      if (again) {
        const b2 = await probe(page);
        const r2 = reqCount;
        // Real actionability click on the sig-matched element.
        const handle = page.locator(`${scopeSelector} button, ${scopeSelector} a`)
          .filter({ hasText: again.text.slice(0, 30) }).first();
        await handle.click({ timeout: 2500 }).catch(() => {});
        await page.waitForTimeout(400);
        const a2 = await probe(page);
        acted = b2.url !== a2.url || a2.mut > b2.mut || b2.dialogs !== a2.dialogs
          || reqCount > r2 || popupCount > popupBefore;
        if (acted) {
          // close whatever the confirm click opened
          if (a2.dialogs > b2.dialogs) {
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(120);
          }
        }
      }
    }
    if (!acted) offenders.push(`[${label}] dead control: "${desc || meta.href}"`);
    done += 1;
    if (done % 10 === 0) console.log(`[sweep ${label}] ${done} clicked (${((Date.now() - tStart) / 1000).toFixed(0)}s)`);

    // Close anything the click opened so the next candidate is reachable.
    if (after.dialogs > before.dialogs) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(120);
      const stillOpen = await page.locator('[role="dialog"], .fixed.inset-0').first().isVisible().catch(() => false);
      if (stillOpen) {
        // Bounded — a menu without a cancel button must not hang the sweep.
        await page.locator('button', { hasText: /cancel|close|×/i }).first().click({ timeout: 800 }).catch(() => {});
        await page.waitForTimeout(120);
      }
    }
    // A navigation invalidates indices — re-collect and rescan; the
    // signature set skips everything already exercised.
    if (before.url !== after.url) {
      rescans += 1;
      const ct = Date.now();
      metas = await collect();
      console.log(`[sweep ${label}] rescan ${rescans}: ${metas.length} candidates in ${Date.now() - ct}ms`);
      pos = 0;
    }
  }
  page.context().off('request', onReq);
  page.off('popup', onPopup);
  for (const p of page.context().pages()) {
    if (p !== page) await p.close().catch(() => {});
  }
  return offenders;
}

async function sweepSection(page: Page, section: string, tabs: string[], role: string, swept: Set<string>): Promise<string[]> {
  const offenders: string[] = [];
  for (const tab of tabs) {
    const url = section === 'home' ? '/app' : `/app/${section}/${tab}`;
    await page.goto(url);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(700);
    if (section === 'home') {
      const homeTab = page.getByRole('tab', { name: new RegExp(`^${tab}$`, 'i') })
        .or(page.getByRole('button', { name: new RegExp(`^${tab}$`, 'i') })).first();
      if (await homeTab.isVisible().catch(() => false)) {
        await homeTab.click().catch(() => {});
        await page.waitForTimeout(400);
      }
    }
    console.log(`[sweep] === ${role}/${section}/${tab} ===`);
    const t0 = Date.now();
    const found = await sweep(page, `${role}/${section}/${tab}`, 'main', 120, swept);
    console.log(`[sweep] === ${role}/${section}/${tab} done in ${((Date.now() - t0) / 1000).toFixed(0)}s, ${found.length} offenders ===`);
    offenders.push(...found);
  }
  return offenders;
}

const SECTION_GROUPS: [string, string[]][] = [
  ['home', CONSOLE_TABS.home],
  ['projects', CONSOLE_TABS.projects],
  ['site', CONSOLE_TABS.site],
  ['money', CONSOLE_TABS.money],
  ['people', CONSOLE_TABS.people],
  ['files', CONSOLE_TABS.files],
];

test.describe.serial('L2 — click-through sweep', () => {
  test('0. fixture: company, PM, project, portal links', async ({ request }) => {
    S.admin = await register(request);
    S.pm = await invite(request, S.admin, 'pm', 'PM_QS', 'Faith Achieng');

    const p = await apiPost(request, S.admin, '/api/v1/projects', {
      name: 'L2 Sweep Site Office', code: `L2-${String(RUN).slice(-6)}`, location: 'Kilimani, Nairobi',
      description: 'Sweep fixture project', contractValue: '9800000',
      startDate: '2026-11-01', targetEndDate: '2027-02-28',
    });
    expect(p.status(), await p.text()).toBeLessThan(300);
    const pb = unwrap(await p.json());
    S.projectId = pb.id || pb.data?.id || pb.project?.id;
    const m = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/members`, { userId: S.pm.user.id, role: 'PM_QS' });
    expect([200, 201, 409]).toContain(m.status());

    const mkLink = async (portalType: string, extra: Record<string, unknown> = {}) => {
      const r = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/portals/links`, {
        portalType, stakeholderName: `${portalType} contact`, expiresInDays: 30, ...extra,
      });
      expect(r.status(), `${portalType} link: ${await r.text()}`).toBeLessThan(300);
      return unwrap(await r.json()).token as string;
    };
    S.tokens.SUPPLIER = await mkLink('SUPPLIER');
    S.tokens.COMPLIANCE = await mkLink('COMPLIANCE');
    S.tokens.CONSULTANT = await mkLink('CONSULTANT');
    S.tokens.CLIENT = await mkLink('CLIENT');
  });

  // One test per console section keeps each run isolated and the timeout honest.
  for (const [section, tabs] of SECTION_GROUPS) {
    test(`1. admin console ${section}`, async ({ page }) => {
      test.setTimeout(300_000);
      await uiLogin(page, `admin.${RUN}@l2-sweep.test`, page.getByRole('button', { name: 'Projects' }).first());
      const offenders = await sweepSection(page, section, tabs, 'admin', new Set());
      expect(offenders, `dead controls in ${section}:\n${offenders.join('\n')}`).toEqual([]);
    });
  }

  test('2. PM/QS console sweep', async ({ page }) => {
    test.setTimeout(600_000);
    const offenders: string[] = [];
    const swept = new Set<string>();
    await uiLogin(page, `pm.${RUN}@l2-sweep.test`, page.getByRole('button', { name: 'Projects' }).first());
    for (const [section, tabs] of Object.entries(PM_TABS)) {
      offenders.push(...await sweepSection(page, section, tabs, 'pm', swept));
    }
    expect(offenders, `dead controls found:\n${offenders.join('\n')}`).toEqual([]);
  });

  test('3. portal landing pages sweep', async ({ page }) => {
    test.setTimeout(300_000);
    const offenders: string[] = [];
    const sweptPortals = new Set<string>();
    for (const [name, token] of Object.entries(S.tokens)) {
      await page.goto(`/?portal=${name.toLowerCase()}&token=${token}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(800);
      offenders.push(...await sweep(page, `portal/${name}`, 'body', 80, sweptPortals));
    }
    expect(offenders, `dead portal controls found:\n${offenders.join('\n')}`).toEqual([]);
  });
});
