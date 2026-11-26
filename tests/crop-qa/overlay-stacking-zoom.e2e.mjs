import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
// Foto e OCR sintetici: nessun salvataggio o modifica del database.
const BASE=(process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/,'');
const fixture=await fs.readFile(new URL('./fixtures/testo.png',import.meta.url));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true});
await ctx.addInitScript(()=>localStorage.setItem('lf_access',JSON.stringify({fontScale:1.6,lineHeight:1.65,ruler:false,mode:'normale'})));
let nRead=0;
await ctx.route('**/api/trpc/**',route=>{
 if(!route.request().url().includes('exercises.readPhoto'))return route.abort('blockedbyclient');
 nRead++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{result:{data:{json:{text:`${nRead}. Yo ___ feliz.`}}}}])});
});
const page=await ctx.newPage();
try{
 await page.goto(`${BASE}/setup?lang=es`,{waitUntil:'networkidle'});
 await page.locator('input[type=file][multiple]').setInputFiles([{name:'1.png',mimeType:'image/png',buffer:fixture},{name:'2.png',mimeType:'image/png',buffer:fixture}]);
 let prior=null;
 for(let n=1;n<=2;n++){
  const crop=page.locator('[role="dialog"][data-state="open"]');await crop.waitFor({state:'visible'});
  await page.waitForFunction(old=>{const img=document.querySelector('[role="dialog"][data-state="open"] img');return img?.complete&&img.naturalWidth>0&&img.currentSrc!==old},prior,{timeout:15000});
  prior=await crop.locator('img').getAttribute('src');await page.waitForTimeout(300);
  // Riproduce l'ordine DOM talvolta generato dalla riapertura rapida Radix.
  if(n===2)await page.evaluate(()=>{const overlay=document.querySelector('[data-slot="dialog-overlay"][data-state="open"]');document.body.appendChild(overlay)});
  const footer=crop.locator('[data-crop-controls]'),btn=crop.getByRole('button',{name:'Ritaglia',exact:true});
  assert.equal(await footer.locator(':scope > button').count(),4);
  // Come nel widget originale, i pulsanti vanno a capo senza fascia separata.
  // Il click/tocco deve rimanere reale anche se l'overlay viene rimontato.
  const hit=await btn.evaluate(el=>{let r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {buttonOnTop:hit===el||el.contains(hit),x:r.x,right:r.right,y:r.y,bottom:r.bottom}});
  assert.ok(hit.buttonOnTop,`comando coperto: ${JSON.stringify(hit)}`);
  assert.ok(hit.x>=0&&hit.right<=320&&hit.y>=0&&hit.bottom<=568,`comando fuori schermo: ${JSON.stringify(hit)}`);
  if(n===2)await page.screenshot({path:'/tmp/lingue-zoom-foto2-tap.png'});
  await btn.tap({timeout:8000});
  await page.waitForFunction(count=>(document.querySelector('textarea[aria-label="Testo dell\'esercizio originale"]')?.value.match(/___/g)?.length??0)>=count,n,{timeout:15000});
 }
 assert.equal(nRead,2);console.log('ZOOM 160%: due foto e due tocchi riusciti anche con overlay rimontato dopo il dialogo.');
}finally{await ctx.close();await browser.close()}

