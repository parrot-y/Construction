import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'https://console.buildsasa.com';
// role -> sections to enter, then click every visible subtab
const TARGETS = [
  ['executive','lovablehem2@gmail.com','kgzgc3ur', ['Projects','Site','Money','People','Files & reports']],
  ['pm','leomanianew99@gmail.com','4d7c7kbk', ['Projects','Site','Money','People','Files & reports']],
  ['engineer','vidonyi99999@gmail.com','x0bhh7dv', ['Projects','Site','Money','People']],
];
fs.mkdirSync('/tmp/refstudy/subtabs',{recursive:true});
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

async function dismissOnboarding(page){
  for(let i=0;i<6;i++){
    const clicked = await page.evaluate(()=>{
      const pats=[/skip for now/i,/got it/i,/maybe later/i,/not now/i,/close/i,/start building/i,/done/i];
      for(const p of pats){
        const b=[...document.querySelectorAll('button,a')].find(e=>p.test(e.innerText||''));
        if(b){b.click();return true;}
      }
      return false;
    });
    if(!clicked) break;
    await page.waitForTimeout(2500);
  }
}

for (const [role,email,pw,sections] of TARGETS) {
  const dir = `/tmp/refstudy/subtabs/${role}`;
  fs.mkdirSync(dir,{recursive:true});
  const ctx = await browser.newContext({ viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(2500);
    await page.click('button:has-text("contractor or service provider")').catch(()=>{});
    await page.waitForTimeout(2000);
    await page.fill('input[placeholder*="company"], input[type="text"]',email);
    await page.fill('input[type="password"]',pw);
    await page.click('button:has-text("Enter Workspace")').catch(()=>{});
    await page.waitForTimeout(11000);
    await dismissOnboarding(page);
    await page.waitForTimeout(4000);
    for (const sec of sections) {
      const secSafe = sec.replace(/[^a-z]/gi,'_').toLowerCase();
      // enter section
      await page.evaluate((label)=>{
        const b=[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')===label);
        if(b) b.click();
      }, sec);
      await page.waitForTimeout(5000);
      // find subtab row: buttons after the prompt that aren't sidebar/topbar — heuristic: all buttons whose text matches known subtab-ish labels inside main content
      const tabs = await page.evaluate(()=>{
        const main = document.querySelector('main') || document.body;
        const out=[];
        main.querySelectorAll('button,[role="tab"]').forEach(b=>{
          const r=b.getBoundingClientRect();
          const t=(b.innerText||'').trim();
          if(r.width>0 && t && t.length<40 && r.y<300) out.push(t.split('\n')[0]);
        });
        return [...new Set(out)];
      });
      fs.writeFileSync(`${dir}/${secSafe}-tabs.json`, JSON.stringify(tabs));
      console.log(role, sec, 'tabs:', JSON.stringify(tabs.slice(0,15)));
      // click each candidate subtab (skip filters/New etc.)
      const skip = /^(New|Filters|Export|All|Active|At Risk|Planning|Closing|Archived|This week|Last 2 weeks|7D|30D|QTD|YTD|Financial|Operational|By Project|By Region|Custom|Scheduled|Materials|Equipment|All statuses|draft|sent|paid|overdue|Architectural|Mechanical|Structural|Electrical|Policies|Templates|Certifications|Insurance|Company-wide.*|Day shift|General)$/i;
      for (const t of tabs) {
        if (skip.test(t)) continue;
        const tSafe = t.replace(/[^a-z0-9]+/gi,'_').toLowerCase();
        const clicked = await page.evaluate((label)=>{
          const main = document.querySelector('main') || document.body;
          const b=[...main.querySelectorAll('button,[role="tab"]')].find(e=>(e.innerText||'').trim().split('\n')[0]===label);
          if(b){b.click();return true;} return false;
        }, t);
        if (!clicked) continue;
        await page.waitForTimeout(4000);
        fs.writeFileSync(`${dir}/${secSafe}--${tSafe}.txt`, await page.evaluate(()=>document.body.innerText.slice(0,9000)));
        await page.screenshot({path:`${dir}/${secSafe}--${tSafe}.png`});
      }
    }
  } catch(e){ console.log(role,'ERR',e.message.slice(0,120)); }
  await ctx.close();
}
await browser.close();
console.log('SUBTAB CRAWL DONE');
