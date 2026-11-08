import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'https://console.buildsasa.com';
const SECTIONS = ['Home','Projects','Site','Money','People','Files & reports'];
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
fs.mkdirSync('/tmp/refstudy/crawl',{recursive:true});
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

async function dismissOnboarding(page){
  for(let i=0;i<6;i++){
    const clicked = await page.evaluate(()=>{
      const pats=[/skip for now/i,/got it/i,/maybe later/i,/not now/i,/close/i,/start building/i,/done/i];
      for(const p of pats){
        const b=[...document.querySelectorAll('button,a')].find(e=>p.test(e.innerText||''));
        if(b){b.click();return (b.innerText||'').slice(0,40);}
      }
      return null;
    });
    if(!clicked) break;
    await page.waitForTimeout(2500);
  }
}

for (const [role,email,pw] of creds) {
  const dir = `/tmp/refstudy/crawl/${role}`;
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
    fs.writeFileSync(`${dir}/_landing.txt`, await page.evaluate(()=>document.body.innerText.slice(0,3000)));
    await page.screenshot({path:`${dir}/_home.png`});
    for (const sec of SECTIONS) {
      try {
        const ok = await page.evaluate((label)=>{
          const b=[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')===label);
          if(b){b.click();return true;} return false;
        }, sec);
        if (!ok) { console.log(role,sec,'NO BTN'); continue; }
        await page.waitForTimeout(6000);
        const safe=sec.replace(/[^a-z]/gi,'_').toLowerCase();
        fs.writeFileSync(`${dir}/${safe}.txt`, await page.evaluate(()=>document.body.innerText.slice(0,9000)));
        await page.screenshot({path:`${dir}/${safe}.png`});
        console.log(role,sec,'ok');
      } catch(e){ console.log(role,sec,'ERR',e.message.slice(0,80)); }
    }
  } catch(e){ console.log(role,'LOGIN ERR',e.message.slice(0,100)); }
  await ctx.close();
}
await browser.close();
console.log('CRAWL DONE');
