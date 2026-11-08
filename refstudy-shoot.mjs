import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'https://console.buildsasa.com';
const creds = [
  ['executive','lovablehem2@gmail.com','kgzgc3ur'],
  ['pm','leomanianew99@gmail.com','4d7c7kbk'],
  ['engineer','vidonyi99999@gmail.com','x0bhh7dv'],
  ['superintendent','jessicamarlin890@gmail.com','3q3ezwza'],
  ['tradelead','vidonyi999@gmail.com','6v3eqh1j'],
  ['foreman','lovablehem1@gmail.com','iwc9t3z9'],
  ['worker','chrishnalee89@gmail.com','dttv9ako'],
  ['viewer','stevenzaramlee99@gmail.com','b1yxkv9g'],
];

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
for (const [role,email,pw] of creds) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.click('button:has-text("contractor or service provider")').catch(()=>{});
    await page.waitForTimeout(2000);
    const emailInput = await page.$('input[placeholder*="company"], input[type="text"]');
    const passInput = await page.$('input[type="password"]');
    if (!emailInput || !passInput) { console.log(role,'NO FORM'); continue; }
    await emailInput.fill(email);
    await passInput.fill(pw);
    await page.click('button:has-text("Enter Workspace")').catch(async()=>{ await page.keyboard.press('Enter'); });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `/tmp/refstudy/${role}-dash.png` });
    const text = await page.evaluate(() => document.body.innerText.slice(0, 8000));
    fs.writeFileSync(`/tmp/refstudy/${role}-text.txt`, text);
    console.log(role, '->', page.url());
  } catch(e){ console.log(role,'ERR',e.message.slice(0,120)); }
  await ctx.close();
}
await browser.close();
