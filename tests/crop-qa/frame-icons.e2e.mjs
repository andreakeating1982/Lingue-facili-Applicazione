import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Test della cornice del progetto o dell'HTML estratto dal DOCX. Nessun blog
// viene pubblicato e nessun dato viene scritto. Le regole ostili simulano
// alcuni temi Blogger che sovrascrivono SVG, senza intaccare altre cornici.
const BASE=(process.env.CROP_QA_BASE_URL??'http://127.0.0.1:3000').replace(/\/$/,'');
const source=process.env.CORNICE_SOURCE??new URL('../../cornice-dinamica/embed-lingue-facili-dedicata.html',import.meta.url);
const raw=await fs.readFile(source,'utf8');
assert.match(raw,/allow="camera; microphone"/);
const srcPattern=/var APP_URL = 'https?:\/\/[^']+';/;assert.match(raw,srcPattern);
const fragment=raw.replace(srcPattern,`var APP_URL = '${BASE}/';`);
const hostile=`<style>.article-content button{color:#fff!important}.article-content svg{width:9px!important;height:9px!important;opacity:.2!important;visibility:hidden!important;stroke:#fff!important;fill:#fff!important;color:#fff!important}</style>`;
const other=`<div class="lf-cornice not-lingue"><div class="lf-testata"><div class="lf-controlli"><button class="lf-btn" aria-label="altra app"><svg width="16" height="16"><path d="M1 1L10 10"></path></svg></button></div></div></div>`;
const body=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${hostile}</head><body style="margin:0"><div class="article-content">${fragment}${other}</div></body></html>`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-features=LocalNetworkAccessChecks']});
try{
 for(const width of [320,390,1440]){
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
  await ctx.route('**/api/trpc/**',r=>r.abort('blockedbyclient'));
  const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://localhost:3000/__qa-frame-icons',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body}));
  await page.goto('http://localhost:3000/__qa-frame-icons',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>document.fonts.ready);
  const frame=page.locator('.lf-cornice.lf-lingue-facili');await frame.waitFor({state:'visible'});
  const iframe=frame.locator('iframe');assert.equal(await iframe.getAttribute('allow'),'camera; microphone');
  await page.waitForFunction(()=>document.querySelector('.lf-lingue-facili iframe')?.src.includes('cornice='));
  const token=new URL(await iframe.getAttribute('src')).searchParams.get('cornice');assert.ok(token);
  const full=frame.getByRole('button',{name:'Apri a schermo intero'}),reload=frame.getByRole('button',{name:"Ricarica l'app"});
  assert.equal(await full.isVisible(),true);assert.equal(await reload.isVisible(),true);
  for(const [btn,n] of [[full,4],[reload,2]]){
   const result=await btn.evaluate(el=>{
    const b=el.getBoundingClientRect(),s=el.querySelector('svg'),r=s.getBoundingClientRect(),cs=getComputedStyle(s),bs=getComputedStyle(el),hit=getComputedStyle(el,'::before'),label=el.querySelector('.lf-lbl');
    const above=document.elementFromPoint(b.left+b.width/2,b.top-3);
    const below=document.elementFromPoint(b.left+b.width/2,b.bottom+3);
    return {button:{width:b.width,height:b.height,background:bs.backgroundColor,border:bs.borderTopColor,radius:bs.borderTopLeftRadius,fontSize:bs.fontSize},hit:{top:parseFloat(hit.top),bottom:parseFloat(hit.bottom),above:above?.closest('.lf-btn')===el,below:below?.closest('.lf-btn')===el},label:{text:label.textContent,visible:getComputedStyle(label).display!=='none'},svg:{width:r.width,height:r.height,display:cs.display,visibility:cs.visibility,opacity:cs.opacity,color:cs.color,fill:cs.fill},paths:[...s.children].map(p=>({tag:p.localName,children:p.children.length,stroke:getComputedStyle(p).stroke,strokeWidth:getComputedStyle(p).strokeWidth,fill:getComputedStyle(p).fill,length:p.getTotalLength()}))};
   });
   assert.ok(result.button.height>=31 && result.button.height<=34,`pulsante non compatto: ${JSON.stringify(result)}`);
   assert.equal(result.button.background,'rgb(253, 251, 248)');assert.equal(result.button.border,'rgb(222, 219, 214)');assert.equal(result.button.radius,'10px');assert.equal(result.button.fontSize,'12px');
   assert.ok(result.button.height-result.hit.top-result.hit.bottom>=44 && result.hit.above && result.hit.below,`bersaglio tattile non esteso ${JSON.stringify(result)}`);
   assert.ok(result.label.visible && ['Schermo intero','Ricarica'].includes(result.label.text),'le etichette della foto devono rimanere visibili');
   assert.ok(Math.abs(result.svg.width-16)<0.1 && Math.abs(result.svg.height-16)<0.1,JSON.stringify(result));
   assert.equal(result.svg.display,'block');assert.equal(result.svg.visibility,'visible');assert.equal(result.svg.opacity,'1');
   assert.equal(result.svg.color,'rgb(46, 32, 24)');assert.equal(result.svg.fill,'none');
   assert.equal(result.paths.length,n);assert.ok(result.paths.every(p=>p.tag==='path'&&p.children===0&&p.length>0&&p.stroke==='rgb(46, 32, 24)'&&p.strokeWidth==='2px'&&p.fill==='none'),`tratti SVG non visibili: ${JSON.stringify(result.paths)}`);
  }
  // Serializzare e rileggere in HTML deve mantenere i path come fratelli:
  // la causa del guasto era la trasformazione di <path/> in tag annidati.
  const roundtrip=await frame.evaluate(root=>{const d=document.createElement('div');d.innerHTML=root.outerHTML;return [...d.querySelectorAll('.lf-controlli svg')].map(svg=>({direct:svg.querySelectorAll(':scope > path').length,nested:svg.querySelectorAll('path path').length}));});
  assert.deepEqual(roundtrip,[{direct:4,nested:0},{direct:2,nested:0}]);
  const foreign=page.locator('.not-lingue svg');assert.equal(await foreign.evaluate(el=>getComputedStyle(el).opacity),'0.2','la correzione deve essere isolata alla cornice Lingue Facili');
  const header=await frame.locator('.lf-testata').evaluate(el=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};
   return {h:rect(el),t:rect(el.querySelector('.lf-titolo')),buttons:[...el.querySelectorAll('.lf-btn')].map(rect)};
  });
  assert.ok(header.buttons.every(b=>b.left>=header.h.left-1&&b.right<=header.h.right+1),'comandi fuori cornice');
  assert.ok(header.buttons.every(b=>b.left>=header.h.left-1&&b.right<=header.h.right+1),'pulsanti tagliati');
  assert.ok(Math.abs(header.buttons[0].top-header.buttons[1].top)<1,'i due pulsanti devono restare sulla stessa riga');
  if(width>=600) assert.ok(header.buttons.every(b=>b.top<header.t.bottom&&b.bottom>header.t.top),'titolo e pulsanti dovrebbero essere allineati su desktop');
  await frame.locator('.lf-testata').screenshot({path:`/tmp/lingue-frame-foto-${width}-${process.env.CORNICE_SOURCE?'docx':'progetto'}.png`});
  // Ricarica solo l'iframe e mantiene pagina e token: attende la navigazione reale.
  await page.evaluate(()=>window.__sentinella='blog-intatto');
  const navigated=page.waitForEvent('framenavigated',{predicate:f=>f.parentFrame()===page.mainFrame()&&f.url().startsWith(BASE),timeout:15000});
  const reloadBox=await reload.boundingBox();
  // Un tocco 3px sotto il pulsante visibile deve colpire l'area estesa.
  if(width<600) await page.touchscreen.tap(reloadBox.x+reloadBox.width/2,reloadBox.y+reloadBox.height+3);
  else await page.mouse.click(reloadBox.x+reloadBox.width/2,reloadBox.y+reloadBox.height+3);
  await navigated;
  assert.equal(await page.evaluate(()=>window.__sentinella),'blog-intatto');
  assert.equal(new URL(await iframe.getAttribute('src')).searchParams.get('cornice'),token);
  // Fullscreen: usare la zona tattile estesa sopra il pulsante visibile.
  const fullBox=await full.boundingBox();
  if(width<600) await page.touchscreen.tap(fullBox.x+fullBox.width/2,fullBox.y-3);
  else await page.mouse.click(fullBox.x+fullBox.width/2,fullBox.y-3);
  await page.waitForFunction(()=>document.fullscreenElement?.classList.contains('lf-lingue-facili'),null,{timeout:6000});
  await full.click();await page.waitForFunction(()=>!document.fullscreenElement,null,{timeout:6000});
  assert.deepEqual(errors,[]);
  console.log(`CORNICE ${width}px: pulsanti compatti come la foto, etichette e icone da 16px visibili, tocco esteso a 44px, isolamento, ricarica e schermo intero OK.`);
  await ctx.close();
 }
}finally{await browser.close()}

