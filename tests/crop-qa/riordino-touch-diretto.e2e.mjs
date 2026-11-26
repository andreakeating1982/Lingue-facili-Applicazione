import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const BASE=(process.env.CROP_QA_BASE_URL??'http://127.0.0.1:3000').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 let calls=0;await context.route('**/api/**',r=>{calls++;return r.abort('blockedbyclient')});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${BASE}/anteprima-riordino`,{waitUntil:'networkidle'});
 const bank=page.locator('[data-drop="reorder-bank"]'),area=page.locator('[data-drop="reorder-area"]');
 for(const word of ['She','often','eats','apples.'])await bank.getByRole('button',{name:`Parola ${word}`,exact:true}).tap();
 assert.equal(await area.locator('[data-pos]').count(),4);
 await area.scrollIntoViewIfNeeded();
 const cdp=await context.newCDPSession(page);
 const p=(x,y)=>({x:Math.round(x),y:Math.round(y),radiusX:2,radiusY:2,force:1,id:1});
 async function dragTo(source,target,holdMs=0){
  const a=await source.boundingBox(),b=await target.boundingBox();assert.ok(a&&b);
  const sx=a.x+a.width/2,sy=a.y+a.height/2,tx=b.x+b.width*.8,ty=b.y+b.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p(sx,sy)]});
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p(sx+(tx-sx)*i/8,sy+(ty-sy)*i/8)]});
  if(holdMs)await page.waitForTimeout(holdMs);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 await dragTo(area.getByRole('button',{name:/Parola She,/}),area.getByRole('button',{name:/Parola often,/}));
 assert.equal(await area.locator('[data-pos]').count(),4);
 // Secondo gesto ravvicinato e lungo: il timer del primo non deve trasformarlo
 // in un clic che rimuove la parola anziché spostarla.
 await dragTo(area.getByRole('button',{name:/Parola She,/}),area.getByRole('button',{name:/Parola apples\.,/}),700);
 assert.equal(await area.locator('[data-pos]').count(),4);
 assert.equal(await bank.getByRole('button',{name:'Parola She',exact:true}).count(),0);
 assert.equal(await area.getByRole('button',{name:/Parola She,/}).count(),1);
 assert.equal(await page.locator('html').getAttribute('data-lf-gesture'),null);
 assert.equal(await page.locator('body > .chip-word[aria-hidden=true]').count(),0);
 assert.equal(calls,0);assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/lf-riordino-touch-diretto.png',fullPage:true});
 console.log('RIORDINO DIRETTO: due trascinamenti tattili ravvicinati, il secondo lungo, senza perdita o rimozione involontaria della parola; nessuna API.');
 await context.close();
} finally {await browser.close();}

