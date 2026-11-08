import { chromium } from 'playwright-core';
import fs from 'node:fs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.newContext({ viewport:{width:1440,height:900} });
const page = await ctx.newPage();
await page.goto('https://console.buildsasa.com/', {waitUntil:'domcontentloaded',timeout:30000});
await page.waitForTimeout(2500);
await page.click('button:has-text("contractor or service provider")').catch(()=>{});
await page.waitForTimeout(2000);
await page.fill('input[placeholder*="company"], input[type="text"]','lovablehem2@gmail.com');
await page.fill('input[type="password"]','kgzgc3ur');
await page.click('button:has-text("Enter Workspace")').catch(()=>{});
await page.waitForTimeout(12000);
for (let i=0;i<3;i++){
  const skip = await page.$('button:has-text("Skip for now")');
  if (skip) { await skip.click(); await page.waitForTimeout(4000); } else break;
}
await page.waitForTimeout(5000);
await page.screenshot({path:'/tmp/refstudy/executive-home.png'});
const nav = await page.evaluate(()=>{
  const els=[...document.querySelectorAll('a,button,[role="tab"],[role="link"]')];
  const seen=new Set(); const out=[];
  for(const e of els){const t=(e.innerText||'').trim().split('\n')[0]; if(t&&t.length<40&&!seen.has(t)){seen.add(t);out.push(t);}}
  return out.slice(0,80);
});
console.log('NAV:', JSON.stringify(nav));
const text = await page.evaluate(()=>document.body.innerText.slice(0,6000));
fs.writeFileSync('/tmp/refstudy/executive-home-text.txt', text);
console.log(text.slice(0,3000));
await browser.close();
