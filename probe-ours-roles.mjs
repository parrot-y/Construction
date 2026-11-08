import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://localhost:5173';
const creds = [
  ['admin','admin@apexbuilders.co.ke'],
  ['qs','qs@apexbuilders.co.ke'],
  ['supervisor','supervisor@apexbuilders.co.ke'],
  ['executive','executive@apexbuilders.co.ke'],
  ['engineer','engineer@apexbuilders.co.ke'],
  ['tradelead','tradelead@apexbuilders.co.ke'],
  ['foreman','foreman@apexbuilders.co.ke'],
  ['worker','worker@apexbuilders.co.ke'],
  ['viewer','viewer@apexbuilders.co.ke'],
  ['client','client@apexbuilders.co.ke'],
];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
fs.mkdirSync('/tmp/ours-roles',{recursive:true});
for (const [role,email] of creds) {
  const ctx = await browser.newContext({ viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(2500);
    await page.click('button:has-text("Sign In with Credentials"), a:has-text("Sign In")').catch(()=>{});
    await page.waitForTimeout(1200);
    const em = await page.$('input[type="email"]'); const pw = await page.$('input[type="password"]');
    if (!em||!pw){ console.log(role,'NO FORM'); continue; }
    await em.fill(email); await pw.fill('Password123!');
    await page.click('button[type="submit"]').catch(async()=>{await page.keyboard.press('Enter');});
    await page.waitForTimeout(7000);
    const rail = await page.evaluate(()=>[...document.querySelectorAll('nav[aria-label="Workspace sections"] button')].map(b=>b.getAttribute('aria-label')).filter(Boolean));
    const body = await page.evaluate(()=>document.body.innerText.slice(0,1200));
    fs.writeFileSync(`/tmp/ours-roles/${role}.txt`, `RAIL: ${JSON.stringify(rail)}\n\n${body}`);
    await page.screenshot({path:`/tmp/ours-roles/${role}.png`});
    console.log(role,'rail:',JSON.stringify(rail));
  } catch(e){ console.log(role,'ERR',e.message.slice(0,100)); }
  await ctx.close();
}
await browser.close();
console.log('DONE');
