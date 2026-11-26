import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Collaudo della pagina temporanea realmente condivisa, su due origini HTTPS
// distinte. L'esempio di riordino non usa servizi e tutte le API sono bloccate.
const HOST=(process.env.LF_DEMO_BLOG??'https://3010-irez2b7mzfn5d088ttmhq.sandbox.easy-peasy.ai').replace(/\/$/,'');
const APP=(process.env.LF_DEMO_APP??'https://3011-irez2b7mzfn5d088ttmhq.sandbox.easy-peasy.ai').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  let api=0;
  await context.route('**/api/**',r=>{api++;return r.abort('blockedbyclient');});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${HOST}/?modo=riordino`,{waitUntil:'domcontentloaded',timeout:45000});
  const frame=page.frameLocator('.lf-cornice.lf-lingue-facili iframe');
  const bank=frame.locator('[data-drop="reorder-bank"]');
  const area=frame.locator('[data-drop="reorder-area"]');
  await bank.waitFor({timeout:30000});
  const child=page.frames().find(f=>f.url().startsWith(`${APP}/anteprima-riordino`));
  assert.ok(child,'Iframe del riordino non trovato');
  assert.notEqual(new URL(child.url()).origin,new URL(page.url()).origin);
  await child.evaluate(()=>document.fonts.ready);
  await bank.getByRole('button',{name:'Parola often',exact:true}).click();
  const source=bank.getByRole('button',{name:'Parola She',exact:true});
  await source.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const from=await source.boundingBox(),target=await area.boundingBox();
  assert.ok(from&&target,'Tessera o area non trovate');
  assert.ok(from.y>=0&&from.y+from.height<=900&&target.y>=0&&target.y+target.height<=900,
    `Gli elementi non sono entrambi visibili: ${JSON.stringify({from,target})}`);
  await page.evaluate(()=>{
    window.__desktopSamples=[];
    window.__desktopTimer=setInterval(()=>window.__desktopSamples.push({at:Date.now(),h:document.querySelector('.lf-cornice iframe').getBoundingClientRect().height}),20);
  });
  const x=from.x+from.width/2,y=from.y+from.height/2;
  const tx=target.x+target.width/2,ty=target.y+target.height/2;
  await page.mouse.move(x,y);
  const start=Date.now();
  await page.mouse.down();
  assert.equal(await child.evaluate(()=>document.documentElement.hasAttribute('data-lf-gesture')),true,'Il mouse non ha avviato un gesto reale');
  for(let i=1;i<=16;i++){
    await page.mouse.move(x+(tx-x)*i/16,y+(ty-y)*i/16);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(450);
  const end=Date.now();
  await page.mouse.up();
  await page.waitForTimeout(1800);
  const samples=await page.evaluate(()=>{clearInterval(window.__desktopTimer);return window.__desktopSamples;});
  assert.ok(new Set(samples.filter(s=>s.at>=start&&s.at<=end).map(s=>s.h)).size<=1,'La cornice si è ridimensionata durante il trascinamento del mouse');
  assert.equal(await area.getByRole('button',{name:/Parola She,/}).count(),1,'La parola non è arrivata nell’area risposta');
  assert.equal(await area.locator('[data-pos]').count(),2,'Il gesto ha perso o duplicato una parola');
  const iframe=page.locator('.lf-cornice iframe');
  let fit=false;
  for(let i=0;i<40;i++){
    const [h,b]=await Promise.all([iframe.evaluate(e=>e.getBoundingClientRect().height),child.evaluate(()=>document.body.scrollHeight)]);
    if(h>=b-2){fit=true;break;}
    await page.waitForTimeout(100);
  }
  assert.equal(fit,true,'La cornice non si è riadattata dopo il mouse');
  assert.equal(api,0);assert.deepEqual(errors,[]);
  console.log('DESKTOP: cornice su origini HTTPS distinte stabile durante il mouse; parole e altezza corrette; nessuna API.');
  await context.close();
} finally {await browser.close();}

