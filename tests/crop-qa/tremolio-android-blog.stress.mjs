import { chromium, devices } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { SITE_ISOLATION_ARGS } from './site-isolation.mjs';

// Misura un gesto iniziato mentre la cornice sta ancora applicando un'altezza.
// Usa la pagina pubblica o una copia; TUTTE le API sono intercettate e nessun
// dato di studenti è letto o salvato. Emulazione non equivalente a Android reale.
const BLOG=process.env.LF_DIAG_BLOG??'https://blogdelprofessoreandreacentinaro.blogspot.com/2026/09/lingue-straniere.html';
const PROD='https://lingue-facili.easy-peasy.site';
const BASE=(process.env.CROP_QA_BASE_URL??PROD).replace(/\/$/,'');
const WIDTH=Number(process.env.LF_WIDTH??393), HEIGHT=Number(process.env.LF_HEIGHT??852), SCALE=Number(process.env.LF_SCALE??1);
const mock=x=>JSON.stringify([{result:{data:{json:x}}}]);
const words=['Today','the','small','students','carefully','read','many','interesting','books','together','at','school.'];
const exercise={type:'reorder',items:[{chips:words.map(t=>({t,role:'other'})),answer:words.join(' '),translationIt:'Oggi gli studenti leggono libri insieme.'}]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox',...SITE_ISOLATION_ARGS]});
try {
 const context=await browser.newContext({...devices['Pixel 7'],viewport:{width:WIDTH,height:HEIGHT},locale:'it-IT'});
 await context.addInitScript(({origin,scale})=>{
  if(location.origin===origin)try{localStorage.setItem('lf_access',JSON.stringify({fontScale:scale,lineHeight:1.65,ruler:false,mode:'normale'}));}catch{}
 },{origin:new URL(BASE).origin,scale:SCALE});
 await context.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(!path.includes('/api/trpc/'))return route.abort('blockedbyclient');
  const value=path.includes('exercises.get')?{id:'stress-synthetic',studentNome:'Prova',studentCognome:'Fittizia',studentClasse:'2A',studentData:'07/11/2026',lang:'en',exercise}:{ok:true};
  return route.fulfill({status:200,contentType:'application/json',body:mock(value)});
 });
 const variant=process.env.LF_CORNICE_VARIANT;
 if(BASE!==PROD && !variant)await context.route(`${PROD}/**`,route=>{
   const url=new URL(route.request().url());
   return route.fulfill({status:302,headers:{location:BASE+url.pathname+url.search}});
 });
 const page=await context.newPage(), errors=[];
 if(variant){
   // Copia il post pubblico in memoria e sostituisce SOLO il blocco cornice.
   // Il post online non viene modificato: stessa pagina/tema e origini distinte.
   const response=await context.request.get(`${BLOG}?m=1`);
   assert.ok(response.ok(),`Impossibile leggere il post: ${response.status()}`);
   const html=await response.text();
   const marker=html.indexOf('CORNICE DINAMICA');
   const start=html.lastIndexOf('<!--====',marker);
   const appUrl=html.indexOf('var APP_URL',marker);
   const scriptEnd=html.indexOf('</script>',appUrl);
   assert.ok(start>=0&&marker>start&&appUrl>marker&&scriptEnd>appUrl,'Blocco cornice non individuato');
   const raw=await fs.readFile(variant,'utf8');
   assert.match(raw,/var APP_URL = 'https?:\/\/[^']+';/);
   const replacement=raw.replace(/var APP_URL = 'https?:\/\/[^']+';/,`var APP_URL = '${BASE}/';`);
   const fixture=html.slice(0,start)+replacement+html.slice(scriptEnd+'</script>'.length);
   await page.route('**/2026/09/lingue-straniere.html*',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture}));
 }
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  if(window!==window.top){
   window.__lfChildStress=[];let last='';
   const sample=()=>{
     const el=document.querySelector('[data-drop="reorder-area"]');
     if(el){const r=el.getBoundingClientRect();const state=[Math.round(r.x*100)/100,Math.round(r.y*100)/100,Math.round(r.width*100)/100,Math.round(r.height*100)/100,scrollY];const key=state.join(',');if(key!==last){window.__lfChildStress.push({at:Date.now(),rect:state});last=key;}}
     requestAnimationFrame(sample);
   };requestAnimationFrame(sample);return;
  }
  window.__lfStress=[];
  let lastHeight=-1,lastScroll=-1;
  function trace(){
    const f=document.querySelector('.lf-cornice.lf-lingue-facili iframe');
    if(f){const r=f.getBoundingClientRect();const h=Math.round(r.height*10)/10;
      if(h!==lastHeight||scrollY!==lastScroll){window.__lfStress.push({type:'geometry',at:Date.now(),h,scroll:scrollY,top:Math.round(r.top)});lastHeight=h;lastScroll=scrollY;}}
    requestAnimationFrame(trace);
  }
  addEventListener('message',e=>{
   if(e.data?.type==='labvisivo:height')window.__lfStress.push({type:'message',at:Date.now(),h:e.data.height});
   if(e.data?.type==='labvisivo:interaction')window.__lfStress.push({type:'activity',at:Date.now(),active:e.data.active,token:!!e.data.cornice});
  });
  requestAnimationFrame(trace);
 });
 await page.goto(BLOG,{waitUntil:'domcontentloaded',timeout:45000});
 const frame=page.frameLocator('.lf-cornice.lf-lingue-facili iframe');
 await frame.getByLabel('Nome',{exact:true}).waitFor({timeout:30000});
 let child=page.frames().find(f=>f.url().startsWith(BASE));
 if(!child)throw new Error('iframe app non trovato: '+JSON.stringify(page.frames().map(f=>f.url())));
 const token=new URL(child.url()).searchParams.get('cornice');assert.ok(token);
 await child.goto(`${BASE}/exercise?id=stress-synthetic&cornice=${encodeURIComponent(token)}`);
 const bank=frame.locator('[data-drop="reorder-bank"]');
 const area=frame.locator('[data-drop="reorder-area"]');
 await bank.waitFor({timeout:20000});
 await page.waitForTimeout(3000);
 // Rendere prima visibile l'iframe nel blog: Chromium sospende rAF negli
 // iframe completamente fuori schermo, altrimenti il test non può agire.
 await page.evaluate(()=>{const f=document.querySelector('.lf-cornice.lf-lingue-facili iframe');window.scrollTo({top:Math.max(0,f.getBoundingClientRect().top+scrollY-100),behavior:'instant'});});
 await page.waitForTimeout(500);
 // Posizionare il riquadro nel viewport prima dell'interazione; lasciare ferma
 // la pagina un istante, poi un tocco che modifica il layout e un drag rapido.
 try { await area.scrollIntoViewIfNeeded({timeout:8000}); }
 catch(error) {
  const events=await page.evaluate(()=>window.__lfStress);
  const dims=await child.evaluate(()=>({innerHeight,bodyScroll:document.body.scrollHeight,bodyOffset:document.body.offsetHeight,docOffset:document.documentElement.offsetHeight,docScroll:document.documentElement.scrollHeight,rootOffset:document.getElementById('root')?.offsetHeight,htmlClass:document.documentElement.className}));
  const childEvents=await child.evaluate(()=>window.__lfChildStress??[]);
  const out=process.env.LF_STRESS_OUT??'/tmp/lf-android-blog-stress.json';
  await fs.writeFile(out,JSON.stringify({blog:page.url(),base:BASE,error:String(error),dims,events,childEvents},null,2));
  await page.screenshot({path:'/tmp/lf-android-blog-stress-failed.png',fullPage:true});
  console.error('L’area non si è stabilizzata:',JSON.stringify({dims,lastEvents:events.slice(-40),lastChildEvents:childEvents.slice(-30)},null,2));
  throw error;
 }
 await page.waitForTimeout(800);
 const frameBefore=await page.locator('.lf-cornice.lf-lingue-facili iframe').evaluate(e=>Math.round(e.getBoundingClientRect().height));
 const layoutBefore=await child.evaluate(()=>document.body.scrollHeight);
 await bank.getByRole('button',{name:'Parola Today',exact:true}).tap();
 const placed=area.getByRole('button',{name:/Parola Today,/});
 await placed.waitFor();
 // A 320px con font al 160% il banco può trovarsi molto più in basso
 // dell'area risposta. Riportare la tessera sullo schermo come farebbe
 // l'utente, altrimenti le coordinate del tocco non sono fisicamente valide.
 const placedBeforeScroll=await placed.boundingBox();
 if(placedBeforeScroll && (placedBeforeScroll.y<0 || placedBeforeScroll.y+placedBeforeScroll.height>HEIGHT)){
  await placed.scrollIntoViewIfNeeded({timeout:8000});
 }
 const layoutAfter=await child.evaluate(()=>document.body.scrollHeight);
 await page.waitForTimeout(Number(process.env.LF_DRAG_DELAY??220));
 const a=await placed.boundingBox();assert.ok(a,'tessera non visibile');
 const cdp=await context.newCDPSession(page);
 const point=(x,y)=>({x:Math.round(x),y:Math.round(y),radiusX:3,radiusY:3,force:1,id:1});
 const sx=a.x+a.width/2,sy=a.y+a.height/2;
 assert.ok(sy>0&&sy<HEIGHT,`tessera fuori viewport: ${JSON.stringify({a,sx,sy})}`);
 const start=Date.now();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(sx,sy)]});
 const isHeld=await child.evaluate(()=>document.documentElement.hasAttribute('data-lf-gesture'));
 assert.equal(isHeld,true,'Il dito non ha attivato il vero gesto sulla tessera');
 for(let i=0;i<Number(process.env.LF_GESTURE_STEPS??35);i++){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(sx+10+(i%3)*2,sy+8)]});
  await page.waitForTimeout(20);
 }
 const end=Date.now();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForTimeout(1400);
 // Una volta terminato il gesto, l'iframe deve tornare ad adattarsi senza
 // tagliare il contenuto; il blocco non può limitarsi a congelarlo per sempre.
 let finalHeight=0,finalBody=0;
 for(let i=0;i<55;i++){
  finalHeight=await page.locator('.lf-cornice.lf-lingue-facili iframe').evaluate(e=>e.getBoundingClientRect().height);
  finalBody=await child.evaluate(()=>document.body.scrollHeight);
  if(finalHeight>=finalBody-2)break;
  await page.waitForTimeout(100);
 }
 const events=await page.evaluate(()=>window.__lfStress);
 const inGesture=events.filter(e=>e.type==='geometry'&&e.at>=start&&e.at<=end);
 const beforeGesture=[...events].reverse().find(e=>e.type==='geometry'&&e.at<start);
 const changed=inGesture.filter(e=>beforeGesture&&e.h!==beforeGesture.h);
 const summary={blog:page.url(),base:BASE,width:WIDTH,scale:SCALE,frameBefore,layoutBefore,layoutAfter,finalHeight,finalBody,gestureMs:end-start,geometryDuring:inGesture,geometryChangedDuringGesture:changed.length>0,recent:events.filter(e=>e.at>start-800&&e.at<end+1800),errors};
 const out=process.env.LF_STRESS_OUT??'/tmp/lf-android-blog-stress.json';
 await fs.writeFile(out,JSON.stringify(summary,null,2));
 console.log(JSON.stringify(summary,null,2));
 if(process.env.LF_ASSERT_STABLE==='1'){
  assert.equal(changed.length,0,'La cornice cambia altezza mentre il dito trascina una tessera');
  assert.ok(finalHeight>=finalBody-2,`L'iframe resta tagliato dopo il gesto: ${finalHeight} < ${finalBody}`);
  assert.ok(events.some(e=>e.type==='activity'&&e.active&&e.token),'Manca il segnale di attività con token');
 }
 assert.deepEqual(errors,[]);
 await context.close();
} finally {await browser.close();}

