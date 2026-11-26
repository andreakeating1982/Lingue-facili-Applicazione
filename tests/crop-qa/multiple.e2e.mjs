import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const base=process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.addInitScript(()=>{
  const NativeFile=window.File; window.__cropFiles=[];
  window.File=class extends NativeFile { constructor(parts,name,options){super(parts,name,options);if(name==='foto_ritagliata.png')window.__cropFiles.push(this)} };
});
let count=0;
await context.route('**/api/trpc/**',r=>{
  if(!r.request().url().includes('exercises.readPhoto')) return r.continue();
  count++;
  const text=count===1?'1. Yo ___ en Madrid.':'2. Ella ___ una manzana.';
  return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{result:{data:{json:{text}}}}])});
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(`${base}/setup?lang=es`,{waitUntil:'networkidle'});
  const image=fs.readFileSync(new URL('./fixtures/piccola.png',import.meta.url));
  await page.locator('input[type=file][multiple]').setInputFiles([{name:'prima.png',mimeType:'image/png',buffer:image},{name:'seconda.png',mimeType:'image/png',buffer:image}]);
  const dialog=page.getByRole('dialog');await dialog.waitFor({state:'visible'});
  await page.waitForFunction(()=>{const img=document.querySelector('[role=dialog] img');return img?.naturalWidth===160 && img.naturalHeight===120 && img.getBoundingClientRect().width>160;});
  const mobileSize=await dialog.locator('img').evaluate(img=>({w:img.getBoundingClientRect().width,h:img.getBoundingClientRect().height}));
  assert.ok(mobileSize.w<=390 && Math.abs(mobileSize.w/mobileSize.h-160/120)<0.02,`anteprima mobile deformata: ${JSON.stringify(mobileSize)}`);
  const right=dialog.getByRole('slider',{name:'Ridimensiona il lato destro della finestra di ritaglio'});
  const rect=await right.boundingBox(); assert.ok(rect && rect.x>=0 && rect.x<390);
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2-80,rect.y+rect.height/2,{steps:8});await page.mouse.up();
  await dialog.getByRole('button',{name:'Ritaglia',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Testo dell\'esercizio originale"]')?.value.includes('Yo ___ en Madrid'),null,{timeout:20000});
  await dialog.waitFor({state:'visible'});
  await page.waitForFunction(()=>{const img=document.querySelector('[role=dialog] img');return img?.naturalWidth===160 && img.naturalHeight===120;});
  await dialog.getByRole('button',{name:'Ruota la foto di 90 gradi a destra'}).click();
  await page.waitForFunction(()=>{const img=document.querySelector('[role=dialog] img');return img?.naturalWidth===120 && img.naturalHeight===160;});
  await dialog.getByRole('button',{name:'Ritaglia',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Testo dell\'esercizio originale"]')?.value.includes('Ella ___ una manzana'),null,{timeout:20000});
  assert.equal(count,2);
  const crops=await page.evaluate(async()=>Promise.all(window.__cropFiles.map(async f=>{const bitmap=await createImageBitmap(f);const signature=Array.from(new Uint8Array(await f.arrayBuffer()).slice(0,8));return {name:f.name,type:f.type,w:bitmap.width,h:bitmap.height,signature}})));
  assert.equal(crops.length,2);assert.ok(crops.every(f=>f.type==='image/png' && f.signature.join(',')==='137,80,78,71,13,10,26,10'));
  assert.ok(crops[0].w<155 && crops[0].w>70 && crops[0].h===120,JSON.stringify(crops[0]));
  assert.deepEqual([crops[1].w,crops[1].h],[120,160]);
  const text=await page.getByRole('textbox',{name:"Testo dell'esercizio originale"}).inputValue();
  assert.match(text,/Yo.*Madrid[\s\S]*Ella.*manzana/);assert.deepEqual(errors,[]);
  console.log('DUE FOTO IN ORDINE: ritaglio preciso, rotazione e due PNG verificati; IA simulata.');

  // Su desktop c'è spazio per il lato lungo di almeno 560 px. Il crop 100%
  // deve però mantenere 160×120 pixel, perché è solo l'anteprima a crescere.
  await page.setViewportSize({width:1440,height:900});
  await page.goto(`${base}/setup?lang=es`,{waitUntil:'networkidle'});
  await page.locator('input[type=file][multiple]').setInputFiles({name:'piccola.png',mimeType:'image/png',buffer:image});
  await dialog.waitFor({state:'visible'});
  await page.waitForFunction(()=>{const img=document.querySelector('[role=dialog] img');return img?.naturalWidth===160 && Math.max(img.getBoundingClientRect().width,img.getBoundingClientRect().height)>=559;});
  const desktopSize=await dialog.locator('img').evaluate(img=>({w:img.getBoundingClientRect().width,h:img.getBoundingClientRect().height}));
  assert.ok(Math.abs(desktopSize.w/desktopSize.h-160/120)<0.02,`anteprima desktop deformata: ${JSON.stringify(desktopSize)}`);
  await dialog.getByRole('button',{name:'Ritaglia',exact:true}).click();
  await page.waitForFunction(()=>window.__cropFiles.length===1);
  const fullCrop=await page.evaluate(async()=>{const bitmap=await createImageBitmap(window.__cropFiles[0]);return [bitmap.width,bitmap.height]});
  assert.deepEqual(fullCrop,[160,120]);
  console.log(`FOTO PICCOLA: anteprima proporzionata ${Math.round(desktopSize.w)}×${Math.round(desktopSize.h)} px; ritaglio originale 160×120 invariato.`);
} finally {await context.close();await browser.close();}

