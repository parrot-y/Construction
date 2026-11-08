import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();
await page.goto('https://console.buildsasa.com/', {waitUntil:'domcontentloaded',timeout:30000});
await page.waitForTimeout(3000);
console.log(await page.evaluate(()=>document.body.innerText.slice(0,2500)));
console.log('---INPUTS---');
console.log(await page.evaluate(()=>[...document.querySelectorAll('input,button,a')].map(e=>`${e.tagName}:${e.type||''}:${(e.innerText||e.placeholder||'').slice(0,60)}`).join('\n')));
await browser.close();
