import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { SITE_ISOLATION_ARGS } from './site-isolation.mjs';

// Simula domini diversi come nel blog reale. Tutte le API usano dati fittizi.
const BASE=(process.env.CROP_QA_BASE_URL??'http://127.0.0.1:3000').replace(/\/$/,'');
// localhost e 127.0.0.1 simulano origini distinte, entrambe loopback.
// Il browser di prova disabilita soltanto Local Network Access, altrimenti il
// blog intercettato non può caricare l'app locale; non testa tale policy.
const BLOG='http://localhost:3000/__blog_cornice';
const source=process.env.LF_CORNICE_VARIANT??new URL('../../cornice-dinamica/CODICE-3-BLOGGER-ESATTO.html',import.meta.url);
const src=await fs.readFile(source,'utf8');
assert.match(src,/var APP_URL = 'https?:\/\/[^']+';/);
const fragment=src.replace(/var APP_URL = 'https?:\/\/[^']+';/,`var APP_URL = '${BASE}/exercise?id=mock-origini';`);
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"></head><body style="margin:0"><h1>Blog simulato</h1>${fragment}</body></html>`;
const words=['Today','the','small','students','carefully','read','many','interesting','books','together','at','school.'];
const exercise={type:'reorder',items:[{chips:words.map(t=>({t,role:'other'})),answer:words.join(' ')},{chips:[{t:'She',role:'other'},{t:'reads.',role:'other'}],answer:'She reads.'}]};
const response=x=>JSON.stringify([{result:{data:{json:x}}}]);
const browser=await chromium.launch({headless:true,args:['--no-sandbox',...SITE_ISOLATION_ARGS,'--disable-features=LocalNetworkAccessChecks']});
try {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  await context.route('**/api/trpc/**',route=>{
    const path=new URL(route.request().url()).pathname;
    const data=path.includes('exercises.get')?{id:'mock-origini',studentNome:'Prova',studentCognome:'Sintetica',studentClasse:'2A',studentData:'07/11/2026',lang:'en',exercise}:{ok:true};
    return route.fulfill({status:200,contentType:'application/json',body:response(data)});
  });
  const page=await context.newPage();
  await page.addInitScript(()=>{if(window===window.top){window.__events=[];window.addEventListener('message',e=>{if(e.data?.type==='labvisivo:height')window.__events.push({origin:e.origin,height:e.data.height,token:e.data.cornice,t:Date.now()})});}});
  await page.route(BLOG,route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  const errors=[];const failures=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
  await page.goto(BLOG,{waitUntil:'domcontentloaded'});
  const frame=page.frameLocator('.lf-iframe');
  const area=frame.locator('[data-drop="reorder-area"]');
  const bank=frame.locator('[data-drop="reorder-bank"]');
  try { await bank.waitFor({timeout:20000}); }
  catch(err) {
    console.error('Diagnosi origini distinte:',JSON.stringify({frames:page.frames().map(f=>f.url()),failures,errors,dom:(await page.content()).slice(-1800)}));
    throw err;
  }
  const child=page.frames().find(f=>f.url().includes('mock-origini'));
  assert.ok(child,'iframe dell’app non trovato');
  assert.notEqual(new URL(child.url()).origin,new URL(page.url()).origin,'il test richiede origini distinte');
  assert.equal(await page.evaluate(()=>document.querySelector('.lf-iframe').contentDocument),null,'il genitore non deve leggere il DOM cross-origin');
  await child.evaluate(()=>document.fonts.ready);
  const height=()=>page.locator('.lf-iframe').evaluate(el=>el.getBoundingClientRect().height);
  const bodyHeight=()=>child.evaluate(()=>document.body.scrollHeight);
  const waitForFit=async()=>{
    for(let i=0;i<35;i++){
      const [h,b]=await Promise.all([height(),bodyHeight()]);
      if(h>=b-2)return {iframe:h,body:b};
      await page.waitForTimeout(200);
    }
    assert.fail(`iframe troppo basso: ${await height()} < ${await bodyHeight()}`);
  };
  await waitForFit();
  for(const word of words.slice(0,8))await bank.getByRole('button',{name:`Parola ${word}`,exact:true}).tap();
  const full=await waitForFit();
  await page.waitForTimeout(700);
  // Durante il trascinamento il documento e la cornice restano fermi.
  await page.evaluate(()=>{window.__samples=[];window.__sampleTimer=setInterval(()=>window.__samples.push({h:document.querySelector('.lf-iframe').getBoundingClientRect().height,t:Date.now()}),30)});
  await child.evaluate(()=>{window.__orders=[];const node=document.querySelector('[data-drop="reorder-area"]');const observer=new MutationObserver(()=>window.__orders.push([...node.querySelectorAll('[data-pos]')].map(e=>e.textContent.trim()).join('|')));observer.observe(node,{childList:true,subtree:true});});
  const from=area.getByRole('button',{name:/Parola Today,/});
  await from.scrollIntoViewIfNeeded();
  const a=await from.boundingBox(),b=await area.locator('[data-pos]').nth(3).boundingBox();
  assert.ok(a&&b);
  const cdp=await context.newCDPSession(page);
  const point=(x,y)=>({x:Math.round(x),y:Math.round(y),radiusX:2,radiusY:2,force:1,id:1});
  const sx=a.x+a.width/2,sy=a.y+a.height/2,tx=b.x+b.width*.8,ty=b.y+b.height/2;
  const begin=Date.now();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(sx,sy)]});
  for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(sx+(tx-sx)*i/12,sy+(ty-sy)*i/12)]});
  for(let i=0;i<25;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(tx+i%2,ty)]});await page.waitForTimeout(20)}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const end=Date.now();
  await page.waitForTimeout(1600);
  const samples=await page.evaluate(()=>{clearInterval(window.__sampleTimer);return window.__samples});
  assert.ok(new Set(samples.filter(s=>s.t>=begin&&s.t<=end).map(s=>s.h)).size<=1,'la cornice si muove durante il drag');
  const orders=await child.evaluate(()=>window.__orders);
  assert.ok(orders.length<=1,`parole riordinate ripetutamente durante il gesto: ${JSON.stringify(orders)}`);
  assert.notEqual((await area.locator('[data-pos]').first().innerText()).trim(),'Today','il trascinamento non ha spostato la tessera');
  assert.equal(await area.locator('[data-pos]').count(),8);
  await frame.getByRole('button',{name:'Svuota',exact:true}).tap();
  for(const word of words)await bank.getByRole('button',{name:`Parola ${word}`,exact:true}).tap();
  await frame.getByRole('button',{name:'CHECK',exact:true}).tap();
  await frame.getByRole('button',{name:'AVANTI',exact:true}).tap();
  await bank.getByRole('button',{name:'Parola She',exact:true}).waitFor({timeout:8000});
  await waitForFit();
  // Dare alla cornice il tempo di ridursi dopo il passaggio da una frase
  // lunga a una breve e controllare che non continui a oscillare.
  await page.waitForTimeout(2200);
  const next={iframe:await height(),body:await bodyHeight()};
  assert.ok(next.iframe>=next.body-2,'la cornice taglia il secondo item');
  assert.ok(next.iframe<full.iframe,'la cornice non si riduce al cambio item');
  const events=await page.evaluate(()=>window.__events);
  assert.ok(events.some(e=>e.origin===new URL(BASE).origin&&e.token),'mancano messaggi con origine e token attesi');
  assert.deepEqual(errors,[]);
  console.log(`CORNICE CROSS-ORIGIN: tocchi, drag stabile e cambio esercizio OK; misure ${JSON.stringify({full,next})}; API simulate, nessun dato reale.`);
  await context.close();
} finally {await browser.close();}

