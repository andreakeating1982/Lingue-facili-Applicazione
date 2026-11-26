import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Cornice Blogger reale su origine distinta; foto e API simulate, nessun DB.
const BASE=(process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/,'');
const BLOG='http://localhost:3000/__qa-zoom-cornice';
const source=await fs.readFile(new URL('../../cornice-dinamica/embed-lingue-facili-dedicata.html',import.meta.url),'utf8');
const fixture=await fs.readFile(new URL('./fixtures/testo.png',import.meta.url));
const pattern=/var APP_URL = 'https?:\/\/[^']+';/;
assert.match(source,pattern);
const fragment=source.replace(pattern,`var APP_URL = '${BASE}/';`);
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><header style="height:400px">Post sintetico</header>${fragment}<footer style="height:900px">Fine post</footer></body></html>`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-features=LocalNetworkAccessChecks']});
try {
 const context=await browser.newContext({viewport:{width:320,height:568},hasTouch:true,isMobile:true});
 await context.addInitScript(()=>localStorage.setItem('lf_access',JSON.stringify({fontScale:1.6,lineHeight:1.65,ruler:false,mode:'normale'})));
 await context.route('**/api/trpc/**',route=>route.abort('blockedbyclient'));
 const page=await context.newPage();await page.route(BLOG,r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(BLOG,{waitUntil:'domcontentloaded'});
 const frameElement=page.locator('iframe[title="Lingue Facili — app in cornice"]');await frameElement.waitFor();
 await page.waitForFunction(()=>document.querySelector('iframe[title="Lingue Facili — app in cornice"]')?.src.includes('cornice='));
 const frame=await (await frameElement.elementHandle()).contentFrame();assert.ok(frame);
 await frame.waitForURL(url=>url.href.startsWith(BASE),{timeout:15000});
 const token=new URL(frame.url()).searchParams.get('cornice');assert.ok(token);
 await frame.goto(`${BASE}/setup?lang=en&cornice=${encodeURIComponent(token)}`);
 await frame.locator('input[type=file][multiple]').waitFor({state:'attached'});
 await page.waitForTimeout(500);
 const scrollTo=await frameElement.evaluate(el=>scrollY+el.getBoundingClientRect().top+80);
 await page.evaluate(y=>window.scrollTo(0,y),scrollTo);
 await page.waitForTimeout(400);
 await frame.locator('input[type=file][multiple]').setInputFiles({name:'sintetica.png',mimeType:'image/png',buffer:fixture});
 const crop=frame.locator('.lf-crop-dialog');await crop.waitFor({state:'visible'});await crop.locator('img').waitFor();
 await page.waitForTimeout(900);
 const global=await crop.boundingBox();
 assert.ok(global.y>=-1 && global.y+global.height<=569,`dialogo fuori dallo schermo: ${JSON.stringify(global)}`);
 const geometry=await crop.evaluate(root=>{
  const r=el=>{const b=el.getBoundingClientRect();return{top:b.top,bottom:b.bottom,height:b.height}};
  const body=root.querySelector('[data-crop-scroll]'),img=body.querySelector('img'),title=root.querySelector('[data-slot=dialog-title]'),footer=root.querySelector('[data-crop-controls]');
  const a=r(body),b=r(img),t=r(title);return{body:a,title:t,imageVisible:Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)),buttons:[...footer.querySelectorAll('button')].map(btn=>({font:parseFloat(getComputedStyle(btn).fontSize),height:r(btn).height}))};
 });
 assert.ok(geometry.title.top>=geometry.body.top-1&&geometry.title.bottom<=geometry.body.bottom+1,`titolo tagliato: ${JSON.stringify(geometry)}`);
 assert.ok(geometry.imageVisible>=55,`foto non visibile: ${JSON.stringify(geometry)}`);
 assert.equal(geometry.buttons.length,4);
 assert.ok(geometry.buttons.every(btn=>Math.abs(btn.font-22.4)<0.05&&btn.height>=43.9),'dimensioni diverse dal widget alla scala 160%');
 const controls=crop.locator('[data-crop-controls]');
 await page.screenshot({path:'/tmp/lingue-zoom-cornice-blog-320-iniziale.png'});
 const before=await page.evaluate(()=>scrollY);
 for(let i=0;i<4;i++){
  await controls.locator(':scope > button').nth(i).focus();
  const pos=await controls.evaluate((el,index)=>{const a=el.getBoundingClientRect(),b=el.querySelectorAll(':scope > button')[index].getBoundingClientRect();return{left:a.left,right:a.right,bl:b.left,br:b.right}},i);
  assert.ok(pos.bl>=pos.left-1&&pos.br<=pos.right+1,`focus non visibile ${i}: ${JSON.stringify(pos)}`);
  const footerBox=await controls.boundingBox(),buttonBox=await controls.locator(':scope > button').nth(i).boundingBox();
  assert.ok(footerBox.y>=0 && footerBox.y+footerBox.height<=569,`footer oltre lo schermo: ${JSON.stringify(footerBox)}`);
  assert.ok(buttonBox.y>=footerBox.y-1 && buttonBox.y+buttonBox.height<=footerBox.y+footerBox.height+1,`comando tagliato verticalmente: ${JSON.stringify({footerBox,buttonBox})}`);
 }
 assert.ok(Math.abs((await page.evaluate(()=>scrollY))-before)<2,'il focus ha spostato il blog');
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/lingue-zoom-cornice-blog-320.png'});
 console.log(`CORNICE 320×568 scala 160%: finestra nello schermo, titolo visibile, ${Math.round(geometry.imageVisible)}px di foto, tutti i comandi raggiungibili e blog fermo.`);
 await context.close();
} finally {await browser.close();}

