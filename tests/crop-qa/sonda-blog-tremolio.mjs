import { chromium, devices } from 'playwright';
import fs from 'node:fs/promises';
import { SITE_ISOLATION_ARGS } from './site-isolation.mjs';

// Diagnosi su contenuto pubblico: intercetta tutte le API, non usa dati reali.
const BLOG = process.env.LF_DIAG_BLOG ?? 'https://blogdelprofessoreandreacentinaro.blogspot.com/2026/09/lingue-straniere.html';
const base = process.env.CROP_QA_BASE_URL ?? 'https://lingue-facili.easy-peasy.site';
const synthetic = value => JSON.stringify([{result:{data:{json:value}}}]);
const browser = await chromium.launch({headless:true,args:['--no-sandbox',...SITE_ISOLATION_ARGS]});
try {
 const context = await browser.newContext({...devices['Pixel 7'], viewport:{width:393,height:852}, locale:'it-IT'});
 await context.route('**/api/**', route=>{
   const path=new URL(route.request().url()).pathname;
   if (path.includes('/api/trpc/')) return route.fulfill({status:200,contentType:'application/json',body:synthetic(path.includes('describeAdaptation')?{description:'Riordina le parole nelle frasi.'}:{ok:true})});
   return route.abort('blockedbyclient');
 });
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(() => {
   if (window !== window.top) return;
   window.__lfTrace = {messages:[], frames:[], errors:[]};
   addEventListener('message',e=>{
     if(e.data?.type==='labvisivo:height') window.__lfTrace.messages.push({height:e.data.height,origin:e.origin,time:performance.now(),scroll:scrollY});
   });
   const sample=()=>{
     const iframe=[...document.querySelectorAll('iframe')].find(f=>f.src.includes('lingue-facili.easy-peasy.site'));
     if(!iframe)return;
     const r=iframe.getBoundingClientRect();
     window.__lfTrace.frames.push({time:performance.now(),height:r.height,top:r.top,scroll:scrollY,width:r.width});
   };
   setInterval(sample,100);
 });
 await page.goto(BLOG,{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForTimeout(7000);
 const summary=await page.evaluate(()=>({title:document.title,url:location.href,iframes:[...document.querySelectorAll('iframe')].map(f=>({src:f.src,title:f.title,rect:{w:f.getBoundingClientRect().width,h:f.getBoundingClientRect().height,top:f.getBoundingClientRect().top}})),height:document.documentElement.scrollHeight,text:document.body.innerText.slice(0,500),trace:window.__lfTrace}));
 await fs.writeFile('/tmp/lingue-blog-probe.json',JSON.stringify({summary,errors},null,2));
 console.log(JSON.stringify({title:summary.title,url:summary.url,iframes:summary.iframes,pageHeight:summary.height,text:summary.text,errors},null,2));
} finally {await browser.close();}

