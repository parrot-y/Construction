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
for (let i=0;i<3;i++){ const s=await page.$('button:has-text("Skip for now")'); if(s){await s.click();await page.waitForTimeout(4000);}else break; }
await page.waitForTimeout(5000);
// full DOM structure dump of interactive elements with aria/href
const dump = await page.evaluate(()=>{
  const out=[];
  document.querySelectorAll('a[href],button,[role="button"],[role="tab"],[role="link"],summary').forEach(e=>{
    const r=e.getBoundingClientRect();
    if(r.width===0) return;
    out.push({x:Math.round(r.x),y:Math.round(r.y),tag:e.tagName,href:e.getAttribute('href')||'',label:(e.getAttribute('aria-label')||e.innerText||'').trim().slice(0,80)});
  });
  return out;
});
fs.writeFileSync('/tmp/refstudy/executive-elements.json', JSON.stringify(dump,null,1));
console.log(JSON.stringify(dump.filter(d=>d.x<300).slice(0,60),null,0));
await browser.close();
