import { chromium, devices } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { SITE_ISOLATION_ARGS } from './site-isolation.mjs';

// Riproduce la seconda pagina dentro il vero tema Blogger. La variante di
// cornice, se richiesta, è sostituita solo nella risposta di questo browser
// isolato: NON modifica il blog. API tutte simulate; nessun dato reale.
const BLOG='https://blogdelprofessoreandreacentinaro.blogspot.com/2026/09/lingue-straniere.html';
const PROD='https://lingue-facili.easy-peasy.site';
const BASE=(process.env.CROP_QA_BASE_URL??PROD).replace(/\/$/,'');
const variant=process.env.LF_CORNICE_VARIANT;
const WIDTH=Number(process.env.LF_WIDTH??393),HEIGHT=Number(process.env.LF_HEIGHT??852),SCALE=Number(process.env.LF_SCALE??1);
const browser=await chromium.launch({headless:true,args:['--no-sandbox',...SITE_ISOLATION_ARGS]});
try {
 const context=await browser.newContext({...devices['Pixel 7'],viewport:{width:WIDTH,height:HEIGHT},locale:'it-IT'});
 await context.addInitScript(({origin,scale})=>{
  if(location.origin===origin)try{localStorage.setItem('lf_access',JSON.stringify({fontScale:scale,lineHeight:1.65,ruler:false,mode:'normale'}));}catch{}
 },{origin:new URL(BASE).origin,scale:SCALE});
 const response=x=>JSON.stringify([{result:{data:{json:x}}}]);
 await context.route('**/api/**',r=>{
   if(!new URL(r.request().url()).pathname.includes('/api/trpc/'))return r.abort('blockedbyclient');
   return r.fulfill({status:200,contentType:'application/json',body:response({description:'Riordina le frasi del testo.'})});
 });
 const page=await context.newPage(),errors=[];
 if(variant){
   const r=await context.request.get(`${BLOG}?m=1`);assert.ok(r.ok());
   const html=await r.text(),marker=html.indexOf('CORNICE DINAMICA');
   const start=html.lastIndexOf('<!--====',marker),app=html.indexOf('var APP_URL',marker),end=html.indexOf('</script>',app);
   assert.ok(start>=0&&app>marker&&end>app,'Non trovo la cornice del post pubblico');
   const raw=await fs.readFile(variant,'utf8');
   const APP_URL_RE=/var APP_URL = 'https?:\/\/[^']+';/;
   assert.ok(APP_URL_RE.test(raw),'Non trovo APP_URL');
   const modified=raw.replace(APP_URL_RE,`var APP_URL = '${BASE}/';`);
   assert.ok(modified.includes(`var APP_URL = '${BASE}/';`),'APP_URL non aggiornato');
   const fixture=html.slice(0,start)+modified+html.slice(end+'</script>'.length);
   await page.route('**/2026/09/lingue-straniere.html*',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture}));
 }
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
   if(window!==window.top)return;
   window.__setupStress=[];let last='';
   function sample(){
     const f=document.querySelector('.lf-cornice.lf-lingue-facili iframe');
     if(f){const r=f.getBoundingClientRect(),h=Math.round(r.height*10)/10,key=`${h}/${scrollY}`;
       if(key!==last){window.__setupStress.push({type:'geometry',at:Date.now(),h,scroll:scrollY,top:Math.round(r.top)});last=key;}}
     requestAnimationFrame(sample);
   }
   addEventListener('message',e=>{
    if(e.data?.type==='labvisivo:height')window.__setupStress.push({type:'height',at:Date.now(),h:e.data.height,token:!!e.data.cornice});
    if(e.data?.type==='labvisivo:interaction')window.__setupStress.push({type:'activity',at:Date.now(),active:e.data.active,token:!!e.data.cornice});
   });
   requestAnimationFrame(sample);
 });
 await page.goto(BLOG,{waitUntil:'domcontentloaded',timeout:45000});
 const frame=page.frameLocator('.lf-cornice.lf-lingue-facili iframe');
 await frame.getByLabel('Nome',{exact:true}).waitFor({timeout:30000});
 const child=page.frames().find(f=>f.url().startsWith(BASE));assert.ok(child);
 await page.evaluate(()=>{const f=document.querySelector('.lf-cornice.lf-lingue-facili iframe');window.scrollTo({top:Math.max(0,f.getBoundingClientRect().top+scrollY-100),behavior:'instant'});});
 await frame.getByLabel('Cognome').fill('Fittizio');
 await frame.getByLabel('Nome',{exact:true}).fill('Esempio');
 await frame.getByLabel('Classe').fill('2A');
 await frame.getByRole('button',{name:"Entra e prepara l'esercizio"}).tap();
 const radio=frame.getByRole('radio',{name:'INGLESE'});
 await radio.waitFor();
 await page.waitForTimeout(2500);
 await radio.scrollIntoViewIfNeeded();await page.waitForTimeout(500);
 const iframe=page.locator('.lf-cornice.lf-lingue-facili iframe');
 const before=await iframe.evaluate(e=>e.getBoundingClientRect().height);
 await radio.tap();
 const text=frame.getByRole('textbox',{name:"Testo dell'esercizio originale"});
 await text.waitFor();
 const bodyAfter=await child.evaluate(()=>document.body.scrollHeight);
 await page.waitForTimeout(Number(process.env.LF_HOLD_DELAY??220));
 const box=await radio.boundingBox();assert.ok(box);
 const cdp=await context.newCDPSession(page);
 const x=box.x+box.width/2,y=box.y+box.height/2;
 assert.ok(y>0&&y<HEIGHT,`Radio fuori schermo: ${JSON.stringify(box)}`);
 const p={x:Math.round(x),y:Math.round(y),radiusX:3,radiusY:3,force:1,id:1};
 const start=Date.now();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
 await page.waitForTimeout(Number(process.env.LF_HOLD_MS??1400));
 const end=Date.now();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForTimeout(1800);
 let finalHeight=0,finalBody=0;
 for(let i=0;i<45;i++){
   finalHeight=await iframe.evaluate(e=>e.getBoundingClientRect().height);finalBody=await child.evaluate(()=>document.body.scrollHeight);
   if(finalHeight>=finalBody-2)break;
   await page.waitForTimeout(100);
 }
 const events=await page.evaluate(()=>window.__setupStress);
 const previous=[...events].reverse().find(e=>e.type==='geometry'&&e.at<start);
 const during=events.filter(e=>e.type==='geometry'&&e.at>=start&&e.at<=end);
 const changed=during.filter(e=>previous&&e.h!==previous.h);
 const summary={base:BASE,blog:page.url(),width:WIDTH,scale:SCALE,before,bodyAfter,finalHeight,finalBody,heldMs:end-start,geometryDuring:during,geometryChangedDuringHold:changed.length>0,recent:events.filter(e=>e.at>start-900&&e.at<end+1700),errors};
 await fs.writeFile(process.env.LF_SETUP_OUT??'/tmp/lf-android-setup-stress.json',JSON.stringify(summary,null,2));
 console.log(JSON.stringify(summary,null,2));
 if(process.env.LF_ASSERT_STABLE==='1'){
   assert.equal(changed.length,0,'La cornice si è ridimensionata durante il tocco nella seconda pagina');
   assert.ok(finalHeight>=finalBody-2,`La cornice non si è riadattata: ${finalHeight} < ${finalBody}`);
   assert.ok(events.some(e=>e.type==='activity'&&e.active&&e.token),'Il token è stato perso durante la navigazione');
 }
 assert.deepEqual(errors,[]);
 await context.close();
} finally {await browser.close();}

