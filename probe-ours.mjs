import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('PAGE ERR:', e.message.slice(0, 300)));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3000);
await page.click('button:has-text("Sign In with Credentials"), a:has-text("Sign In")').catch(()=>{});
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/ours-login.png' });
// login as admin
const email = await page.$('input[type="email"], input[name="email"], input[placeholder*="@"]');
const pass = await page.$('input[type="password"]');
console.log('inputs:', !!email, !!pass);
if (email && pass) {
  await email.fill('admin@apexbuilders.co.ke');
  await pass.fill('Password123!');
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').catch(async () => { await page.keyboard.press('Enter'); });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: '/tmp/ours-admin-home.png' });
  const text = await page.evaluate(() => document.body.innerText.slice(0, 5000));
  fs.writeFileSync('/tmp/ours-admin-home.txt', text);
  console.log('URL:', page.url());
  console.log(text.slice(0, 2000));
}
await browser.close();
