import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { SITE_ISOLATION_ARGS } from './site-isolation.mjs';

// Testa l'annullamento di un gesto interrotto, senza generazione né database.
const BASE=(process.env.CROP_QA_BASE_URL??'http://127.0.0.1:3000').replace(/\/$/,'');
const BLOG='http://localhost:3000/__qa_perdita_focus';
const raw=await fs.readFile(new URL('../../cornice-dinamica/CODICE-3-ANTI-TREMOLIO-ANDROID.html',import.meta.url),'utf8');
const fragment=raw.replace(/var APP_URL = 'https?:\/\/[^']+';/,`var APP_URL = '${BASE}/anteprima-riordino';`);
const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><body style="margin:0"><div style="height:120px">Blog simulato</div>${fragment}<div style="height:1000px">Fine</div></body>`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox',...SITE_ISOLATION_ARGS,'--disable-features=LocalNetworkAccessChecks']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 let api=0;await context.route('**/api/**',r=>{api++;return r.abort('blockedbyclient')});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(BLOG,r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
 await page.goto(BLOG,{waitUntil:'domcontentloaded'});
 const frame=page.frameLocator('.lf-cornice.lf-lingue-facili iframe');
 const bank=frame.locator('[data-drop="reorder-bank"]'),area=frame.locator('[data-drop="reorder-area"]');
 await bank.waitFor({timeout:20000});
 const child=page.frames().find(f=>f.url().includes('/anteprima-riordino'));assert.ok(child);
 for(const w of ['She','often','eats','apples.'])await bank.getByRole('button',{name:`Parola ${w}`,exact:true}).tap();
 assert.equal(await area.locator('[data-pos]').count(),4);
 const source=area.getByRole('button',{name:/Parola She,/});await source.scrollIntoViewIfNeeded();
 const box=await source.boundingBox();assert.ok(box);
 const cdp=await context.newCDPSession(page);
 const p=(x,y)=>({x:Math.round(x),y:Math.round(y),radiusX:3,radiusY:3,force:1,id:1});
 const x=box.x+box.width/2,y=box.y+box.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p(x,y)]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p(x+20,y+8)]});
 await child.waitForFunction(()=>document.documentElement.hasAttribute('data-lf-gesture'));
 await child.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await child.waitForFunction(()=>!document.documentElement.hasAttribute('data-lf-gesture'));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForTimeout(500);
 assert.equal(await area.locator('[data-pos]').count(),4,'Un gesto annullato non deve spostare o perdere parole');
 assert.equal(await child.locator('body>.chip-word[aria-hidden=true]').count(),0,'Fantasma non rimosso');
 await area.getByRole('button',{name:/Parola She,/}).tap();
 assert.equal(await bank.getByRole('button',{name:'Parola She',exact:true}).count(),1,'La parola non è più utilizzabile');
 assert.equal(api,0);assert.deepEqual(errors,[]);
 console.log('PERDITA FOCUS: il gesto si annulla senza perdere parole, il fantasma scompare e il tocco successivo funziona.');
 await context.close();
}finally{await browser.close();}

