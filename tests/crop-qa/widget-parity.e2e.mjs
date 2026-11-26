import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Confronto diretto con il widget pubblico associato al repository sorgente
// (HEAD 5d7824409c4e445c077123b699b10f2191ff4d9d). Solo foto sintetica,
// tutte le API bloccate: nessun salvataggio su nessuna delle due app.
const BASE=(process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/,'');
const WIDGET=(process.env.CROP_REFERENCE_URL ?? 'https://espressioni-monomi-polinomi.easy-peasy.site').replace(/\/$/,'');
const photo=await fs.readFile(new URL('./fixtures/testo.png',import.meta.url));
const cases=[
  {width:320,height:568,scale:0.8}, {width:320,height:568,scale:1}, {width:320,height:568,scale:1.6},
  {width:390,height:844,scale:1}, {width:390,height:844,scale:1.6}, {width:568,height:320,scale:1.6},
  {width:1440,height:900,scale:0.8}, {width:1440,height:900,scale:1}, {width:1440,height:900,scale:1.6},
];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});

async function capture(spec,scenario){
 const context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},hasTouch:scenario.width<600,isMobile:scenario.width<600,ignoreHTTPSErrors:true});
 await context.addInitScript(({key,scale})=>localStorage.setItem(key,JSON.stringify({fontScale:scale,lineHeight:1.65,ruler:false,mode:'normale'})),{key:spec.key,scale:scenario.scale});
 await context.route('**/api/**',route=>route.abort('blockedbyclient'));
 const page=await context.newPage();
 try {
  await page.goto(spec.url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator(spec.input).last().waitFor({state:'attached',timeout:30000});
  await page.locator(spec.input).last().setInputFiles({name:'foto-sintetica.png',mimeType:'image/png',buffer:photo});
  const crop=page.locator('.lf-crop-dialog');await crop.waitFor({state:'visible'});
  await page.waitForFunction(()=>{const i=document.querySelector('.lf-crop-dialog img');return i?.complete&&i.naturalWidth>0});
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
  const result=await crop.evaluate(dialog=>{
   const base=dialog.getBoundingClientRect();
   const box=el=>{const b=el.getBoundingClientRect();return{x:b.x-base.x,y:b.y-base.y,width:b.width,height:b.height}};
   const metric=el=>{const s=getComputedStyle(el);return {box:box(el),font:parseFloat(s.fontSize),lineHeight:parseFloat(s.lineHeight),background:s.backgroundColor,color:s.color,display:s.display,align:s.textAlign,transform:s.textTransform}};
   const title=dialog.querySelector('[data-slot=dialog-title]'),footer=dialog.querySelector('[data-crop-controls]');
   return {dialog:{width:base.width,height:base.height},title:{text:title.textContent.trim(),...metric(title)},image:metric(dialog.querySelector('img')),footer:metric(footer),buttons:[...footer.querySelectorAll(':scope > button')].map(el=>({text:el.textContent.trim(),...metric(el),minHeight:parseFloat(getComputedStyle(el).minHeight),padding:getComputedStyle(el).padding,icon:el.querySelector('svg')?box(el.querySelector('svg')):null}))};
  });
  if(scenario.scale===1 && [320,390,1440].includes(scenario.width)){
   await crop.screenshot({path:`/tmp/lingue-widget-parita-${spec.name}-${scenario.width}.png`});
  }
  return result;
 }finally{await context.close()}
}
function near(actual,expected,label,tolerance=2.1){assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: ${actual} invece di ${expected}`)}
function rectNear(actual,expected,label,tolerance=2.1){for(const k of ['x','y','width','height'])near(actual[k],expected[k],`${label}.${k}`,tolerance)}
try{
 for(const s of cases){
  const reference=await capture({name:'originale',key:'wms_access',url:`${WIDGET}/espressione?cognome=QA&nome=Test&classe=2A&data=07%2F11%2F2026`,input:'input[type=file]'},s);
  const current=await capture({name:'lingue',key:'lf_access',url:`${BASE}/setup?lang=en`,input:'input[type=file][multiple]'},s);
  const label=`${s.width}×${s.height} scala ${s.scale}`;
  // A font elevato su telefono la disposizione si adatta deliberatamente,
  // perché nel sorgente le parole escono dai pulsanti. Il confronto resta
  // puntuale sulla scala, colori, titoli e funzioni condivise.
  const adapted=s.scale>1 && s.width<500;
  near(current.dialog.width,reference.dialog.width,`${label} dialogo.width`);near(current.dialog.height,reference.dialog.height,`${label} dialogo.height`);
  assert.equal(current.title.text,reference.title.text);assert.equal(current.title.align,reference.title.align);assert.equal(current.title.transform,reference.title.transform);
  near(current.title.font,reference.title.font,`${label} titolo font`,0.05);rectNear(current.title.box,reference.title.box,`${label} titolo`);
  assert.equal(current.footer.display,reference.footer.display);assert.equal(current.footer.background,reference.footer.background);
  if(!adapted){rectNear(current.footer.box,reference.footer.box,`${label} barra`);rectNear(current.image.box,reference.image.box,`${label} foto`,3.1);}
  assert.equal(current.buttons.length,4);assert.deepEqual(current.buttons.map(x=>x.text),reference.buttons.map(x=>x.text));
  for(let i=0;i<4;i++){
   const a=current.buttons[i],b=reference.buttons[i],name=`${label} ${a.text}`;
   near(a.font,b.font,`${name} font`,0.05);near(a.lineHeight,b.lineHeight,`${name} interlinea`,0.05);near(a.minHeight,b.minHeight,`${name} target`,0.05);
   assert.equal(a.color,b.color,`${name} colore testo`);assert.equal(a.background,b.background,`${name} sfondo`);
   if(!adapted){assert.equal(a.padding,b.padding,`${name} padding`);rectNear(a.box,b.box,name);}
   assert.equal(!!a.icon,!!b.icon,`${name} icona`);if(a.icon&&!adapted)rectNear(a.icon,b.icon,`${name} icona`);
  }
  console.log(`RIFERIMENTO ${label}: stile, testo e dimensioni confrontati${adapted?'; layout adattato per evitare sbordamenti':' e disposizione uguale al widget'}.`);
 }
}finally{await browser.close()}

