import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { SITE_ISOLATION_ARGS } from './site-isolation.mjs';
const BASE=(process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/,'');
const source=process.env.LF_CORNICE_VARIANT??new URL('../../cornice-dinamica/CODICE-3-BLOGGER-ESATTO.html', import.meta.url);
const src=await fs.readFile(source,'utf8');
const fragment=src.replace(/var APP_URL = 'https?:\/\/[^']+';/,`var APP_URL = '${BASE}/exercise?id=mock-mobile';`);
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"></head><body style="margin:0;padding-top:35px"><h2>Pagina blog simulata</h2>${fragment}</body></html>`;
const words=['Today','the','small','students','carefully','read','many','interesting','books','together','at','school.'];
const exercise={type:'reorder',items:[{chips:words.map(t=>({t,role:'other'})),answer:words.join(' '),translationIt:'Oggi gli studenti leggono insieme.'},{chips:[{t:'She',role:'other'},{t:'reads.',role:'other'}],answer:'She reads.'}]};
const mock=x=>JSON.stringify([{result:{data:{json:x}}}]);
const browser=await chromium.launch({headless:true,args:['--no-sandbox',...SITE_ISOLATION_ARGS]});
try {
 for(const [width,scale] of [[390,1],[320,1.6]]) {
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true});
  await context.addInitScript(({scale})=>localStorage.setItem('lf_access',JSON.stringify({fontScale:scale,lineHeight:1.65,ruler:false,mode:'normale'})),{scale});
  await context.route('**/api/trpc/**',route=>{const path=new URL(route.request().url()).pathname;if(path.includes('exercises.get'))return route.fulfill({status:200,contentType:'application/json',body:mock({id:'mock-mobile',studentNome:'Prova',studentCognome:'Sintetica',studentClasse:'2A',studentData:'07/11/2026',lang:'en',exercise})});return route.fulfill({status:200,contentType:'application/json',body:mock({ok:true})});});
  const page=await context.newPage();
  await page.addInitScript(()=>{if(window===window.top){window.__heightMessages=[];window.addEventListener('message',e=>{if(e.data?.type==='labvisivo:height')window.__heightMessages.push({h:e.data.height,t:Date.now()})});}});
  await page.route('**/__blog_test',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${BASE}/__blog_test`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.lf-iframe')?.src.includes('mock-mobile'));
  const frame=page.frameLocator('.lf-iframe');const bank=frame.locator('[data-drop="reorder-bank"]');const area=frame.locator('[data-drop="reorder-area"]');
  await bank.waitFor({timeout:20000});
  // Rispondi a tocchi veri, non a click sintetici.
  for(const word of words.slice(0,8)) await bank.getByRole('button',{name:`Parola ${word}`,exact:true}).tap();
  assert.equal(await area.locator('[data-pos]').count(),8);
  // Il nome dei comandi deve restare su una riga, anche con zoom elevato;
  // i pulsanti possono andare a capo come blocchi, non spezzare le parole.
  for(const label of ['CHECK','Svuota']){
    const el=frame.getByRole('button',{name:label,exact:true});
    const measure=await el.evaluate(button=>{const span=button.querySelector('span');const text=document.createRange();text.selectNodeContents(span);const b=button.getBoundingClientRect(),r=text.getBoundingClientRect();return {lines:text.getClientRects().length,left:r.left-b.left,right:b.right-r.right,buttonWidth:b.width,parentWidth:button.parentElement.getBoundingClientRect().width}});
    assert.equal(measure.lines,1,`${label}: testo spezzato ${JSON.stringify(measure)}`);
    assert.ok(measure.left>=-1&&measure.right>=-1&&measure.buttonWidth<=measure.parentWidth+1,`${label}: deborda ${JSON.stringify(measure)}`);
  }
  // Dopo tocchi rapidi l'iframe deve adattarsi al contenuto senza tagli.
  try { await page.waitForFunction(()=>{const f=document.querySelector('.lf-iframe'); return f?.contentDocument && f.getBoundingClientRect().height >= f.contentDocument.body.scrollHeight - 2;},null,{timeout:7000}); }
  catch(e) {console.log('IFRAME INSUFFICIENTE',width,JSON.stringify(await page.evaluate(()=>({h:document.querySelector('.lf-iframe').getBoundingClientRect().height,body:document.querySelector('.lf-iframe').contentDocument.body.scrollHeight,messages:window.__heightMessages}))));throw e;}
  await page.evaluate(()=>{window.__heightHistory=[];window.__histTimer=setInterval(()=>window.__heightHistory.push({h:document.querySelector('.lf-iframe').getBoundingClientRect().height,y:scrollY,t:Date.now()}),50)});
  const child=page.frames().find(f=>f.url().includes('mock-mobile')); assert.ok(child);
  await child.evaluate(()=>{window.__orders=[];const area=document.querySelector('[data-drop="reorder-area"]');const obs=new MutationObserver(()=>window.__orders.push([...area.querySelectorAll('[data-pos]')].map(e=>e.textContent.trim()).join('|')));obs.observe(area,{childList:true,subtree:true});window.__pointer=[];['pointermove','pointerup','pointercancel'].forEach(t=>window.addEventListener(t,e=>window.__pointer.push({type:t,x:e.clientX,y:e.clientY}),true));});
  const chip=area.getByRole('button',{name:/Parola Today,/});await chip.scrollIntoViewIfNeeded();
  const rect=await chip.boundingBox();const target=area.locator('[data-pos]').nth(3);const dest=await target.boundingBox();assert.ok(rect&&dest);
  const client=await context.newCDPSession(page);
  const point=(x,y)=>({x:Math.round(x),y:Math.round(y),radiusX:2,radiusY:2,force:1,id:1});
  const x1=rect.x+rect.width/2,y1=rect.y+rect.height/2,x2=dest.x+dest.width*.8,y2=dest.y+dest.height/2;
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(x1,y1)]});
  const gestureStart=Date.now();
  for(let i=1;i<=10;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(x1+(x2-x1)*i/10,y1+(y2-y1)*i/10)]});
  for(let i=0;i<30;i++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(x2+(i%2),y2)]});await page.waitForTimeout(20)}
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const gestureEnd=Date.now();
  await page.waitForTimeout(1500);
  const data=await child.evaluate(()=>({orders:window.__orders,pointer:window.__pointer,placed:[...document.querySelectorAll('[data-pos]')].map(e=>e.textContent.trim()),ghost:!!document.querySelector('body>.chip-word[aria-hidden=true]'),height:{body:document.body.scrollHeight,root:document.documentElement.scrollHeight,viewport:innerHeight}}));
  const hist=await page.evaluate(()=>{clearInterval(window.__histTimer);return window.__heightHistory});
  await page.screenshot({path:`/tmp/lingue-reorder-diagnosi-${width}.png`});
  const heightsDuring=[...new Set(hist.filter(h=>h.t>=gestureStart && h.t<=gestureEnd).map(h=>h.h))];
  console.log('DIAG',width,scale,JSON.stringify({orders:data.orders,placed:data.placed,height:data.height,iframeHeights:[...new Set(hist.map(h=>h.h))],heightsDuring,errors}));
  assert.ok(heightsDuring.length<=1,`la cornice ha cambiato altezza mentre si trascina: ${JSON.stringify(heightsDuring)}`);
  assert.ok(data.orders.length<=1,`il DOM ha oscillato durante il gesto: ${JSON.stringify(data.orders)}`);
  assert.equal(data.placed.length,8);assert.equal(new Set(data.placed).size,8);assert.notEqual(data.placed[0],'Today','la parola non si è spostata');assert.equal(data.ghost,false);assert.deepEqual(errors,[]);
  // La tessera già inserita può tornare al banco con un semplice tocco.
  await area.getByRole('button',{name:/Parola Today,/}).tap();
  assert.equal(await bank.getByRole('button',{name:'Parola Today',exact:true}).count(),1);
  await frame.getByRole('button',{name:'Svuota',exact:true}).tap();
  assert.equal(await area.locator('[data-pos]').count(),0);
  // Trascina davvero dal banco all'area risposta (390px, con entrambi visibili).
  if(width===390){
    await bank.getByRole('button',{name:'Parola the',exact:true}).tap();
    const from=bank.getByRole('button',{name:'Parola Today',exact:true});
    await from.scrollIntoViewIfNeeded();
    const b=await from.boundingBox(),a=await area.boundingBox();assert.ok(b&&a);
    const sx=b.x+b.width/2,sy=b.y+b.height/2,tx=a.x+a.width/2,ty=a.y+a.height/2;
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(sx,sy)]});
    for(let i=1;i<=10;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(sx+(tx-sx)*i/10,sy+(ty-sy)*i/10)]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await area.getByRole('button',{name:/Parola Today,/}).waitFor({timeout:5000});
    await frame.getByRole('button',{name:'Svuota',exact:true}).tap();
  }
  // Due frasi complete: cambio pagina senza perdere parole, tagliare l'iframe
  // o toccare il database; tutte le chiamate sono intercettate.
  for(const word of words)await bank.getByRole('button',{name:`Parola ${word}`,exact:true}).tap();
  assert.equal(await area.locator('[data-pos]').count(),words.length);
  await frame.getByRole('button',{name:'CHECK',exact:true}).tap();
  await frame.getByRole('button',{name:'AVANTI',exact:true}).tap();
  await frame.getByRole('button',{name:'Parola She',exact:true}).waitFor({timeout:8000});
  assert.equal(await bank.locator('[role=button]').count(),2);
  await page.waitForFunction(()=>{const f=document.querySelector('.lf-iframe');return f?.contentDocument&&f.getBoundingClientRect().height>=f.contentDocument.body.scrollHeight-2;},null,{timeout:7000});
  console.log(`RIORDINO ${width}px: tocchi, drag, ritorno al banco, frase corretta e secondo item OK.`);
  await context.close();
 }
} finally {await browser.close();}

