import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// L'hook di trascinamento è condiviso con le attività salvate in passato:
// controllare che i loro gesti continuino a funzionare, senza API o DB reali.
const BASE=(process.env.CROP_QA_BASE_URL??'http://127.0.0.1:3000').replace(/\/$/,'');
const response=x=>JSON.stringify([{result:{data:{json:x}}}]);
const matchIt={type:'matchIt',pairs:[{en:'cat',it:'gatto'},{en:'dog',it:'cane'},{en:'book',it:'libro'}]};
const match={type:'match',pairs:[
  {word:'cat',it:'gatto',emoji:'g',imagePrompt:'gatto disegnato',imageUrl:'data:image/gif;base64,R0lGODlhAQABAAAAACw='},
  {word:'dog',it:'cane',emoji:'c',imagePrompt:'cane disegnato',imageUrl:'data:image/gif;base64,R0lGODlhAQABAAAAACw='},
  {word:'book',it:'libro',emoji:'l',imagePrompt:'libro disegnato',imageUrl:'data:image/gif;base64,R0lGODlhAQABAAAAACw='}
]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for(const [kind,exercise] of [['matchIt',matchIt],['match',match]]){
  const context=await browser.newContext({viewport:{width:390,height:900},hasTouch:true,isMobile:true});
  await context.route('**/api/trpc/**',route=>{
   const data=route.request().url().includes('exercises.get')?{id:`fittizio-${kind}`,studentNome:'Prova',studentCognome:'Sintetica',studentClasse:'2A',studentData:'07/11/2026',lang:'en',exercise}:{ok:true};
   return route.fulfill({status:200,contentType:'application/json',body:response(data)});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${BASE}/exercise?id=fittizio-${kind}`,{waitUntil:'networkidle'});
  const source=kind==='matchIt'?page.getByRole('button',{name:/Italiano [A-F]: gatto/}):page.getByRole('button',{name:'Parola cat',exact:true});
  const target=kind==='matchIt'?page.locator('[data-en-card="0"]'):page.locator('[data-card="0"]');
  await source.waitFor({timeout:10000});await source.scrollIntoViewIfNeeded();
  const a=await source.boundingBox(),b=await target.boundingBox();assert.ok(a&&b);
  assert.ok(b.y>=0&&b.y+b.height<=900,'il bersaglio deve essere visibile per il gesto tattile');
  const cdp=await context.newCDPSession(page);
  const point=(x,y)=>({x:Math.round(x),y:Math.round(y),radiusX:2,radiusY:2,force:1,id:1});
  const sx=a.x+a.width/2,sy=a.y+a.height/2,tx=b.x+b.width/2,ty=b.y+b.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(sx,sy)]});
  for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(sx+(tx-sx)*i/12,sy+(ty-sy)*i/12)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await target.waitFor({state:'visible'});
  await page.waitForFunction(selector=>document.querySelector(selector)?.disabled,kind==='matchIt'?'[data-en-card="0"]':'[data-card="0"]',{timeout:5000});
  assert.equal(await page.locator('html').getAttribute('data-lf-gesture'),null,'il lock del gesto deve essere rilasciato');
  // Una seconda coppia si può abbinare anche con due semplici tocchi.
  if(kind==='matchIt'){
   await page.getByRole('button',{name:/Italiano [A-F]: cane/}).tap();
   await page.locator('[data-en-card="1"]').tap();
   assert.equal(await page.locator('[data-en-card="1"]').isDisabled(),true);
  } else {
   await page.getByRole('button',{name:'Parola dog',exact:true}).tap();
   await page.locator('[data-card="1"]').tap();
   assert.equal(await page.locator('[data-card="1"]').isDisabled(),true);
  }
  assert.deepEqual(errors,[]);
  console.log(`COMPATIBILITÀ ${kind}: trascinamento e tocco funzionano negli esercizi salvati (API simulate).`);
  await context.close();
 }
} finally {await browser.close();}

