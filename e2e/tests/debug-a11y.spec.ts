import { test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

// Temporary: inventory moderate/minor axe findings on audited surfaces.
test('dump moderate minor', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 800 });
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
  await page.getByRole('button', { name: 'Projects' }).first().waitFor({ timeout: 30000 });

  const tally = new Map<string, number>();
  for (const url of ['/', '/login', '/app', '/app/projects/all', '/app/site/dailylog', '/app/money/financials', '/app/money/gatepass', '/app/people/team', '/app/files/reports']) {
    await page.goto(url);
    await page.waitForLoadState('load');
    await page.waitForTimeout(700);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    for (const v of results.violations) {
      if (v.impact === 'critical' || v.impact === 'serious') continue;
      const key = `${v.impact} ${v.id}`;
      tally.set(key, (tally.get(key) ?? 0) + v.nodes.length);
      if ((tally.get(key) ?? 0) <= v.nodes.length) {
        console.log(`${url} ${key} x${v.nodes.length} — ${v.help}`);
        for (const n of v.nodes.slice(0, 3)) {
          console.log('   ', JSON.stringify(n.target), (n.html || '').slice(0, 140));
        }
      }
    }
  }
  console.log('\n=== TALLY ===');
  for (const [k, c] of [...tally.entries()].sort((a, b) => b[1] - a[1])) console.log(`${c}x ${k}`);
});
