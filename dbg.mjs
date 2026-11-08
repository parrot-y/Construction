import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await (await b.newContext()).newPage();
p.on('pageerror', e => console.log('ERR', e.message.slice(0,300)));
await p.goto('http://localhost:5173', {waitUntil:'networkidle', timeout:30000}).catch(e=>console.log('nav',e.message.slice(0,100)));
await p.waitForTimeout(3000);
console.log(await p.evaluate(()=>document.body.innerText.slice(0,800)));
console.log('INPUTS:', await p.evaluate(()=>document.querySelectorAll('input').length));
await b.close();
