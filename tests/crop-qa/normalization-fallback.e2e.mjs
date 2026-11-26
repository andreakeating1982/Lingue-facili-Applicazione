import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const base=process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:393,height:780},isMobile:true,hasTouch:true});
// Simula un browser che non supporta la normalizzazione tramite ImageBitmap.
await context.addInitScript(()=>{window.createImageBitmap=undefined});
const page=await context.newPage();
try {
  await page.goto(`${base}/setup?lang=es`,{waitUntil:'networkidle'});
  await page.locator('input[type=file]').first().setInputFiles({name:'foto.png',mimeType:'image/png',buffer:fs.readFileSync(new URL('./fixtures/testo.png',import.meta.url))});
  const dialog=page.getByRole('dialog');
  await dialog.waitFor({state:'visible',timeout:15000});
  await page.waitForFunction(()=>document.querySelector('[role=dialog] img')?.naturalWidth===900);
  assert.equal(await page.getByRole('button',{name:'Ruota la foto di 90 gradi a sinistra'}).count(),1);
  assert.equal(await page.getByRole('button',{name:'Ritaglia',exact:true}).count(),1);
  await page.getByRole('button',{name:'Chiudi',exact:true}).click();
  await dialog.waitFor({state:'detached'});
  console.log('NORMALIZZAZIONE NON DISPONIBILE: foto originale aperta, rotazione e chiusura disponibili.');
} finally {await context.close();await browser.close();}

