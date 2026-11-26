import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/trpc/**',r=>{if(r.request().url().includes('exercises.readPhoto'))return r.abort('failed');return r.continue();});
try{
 await page.goto(`${process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000'}/setup?lang=es`,{waitUntil:'networkidle'});
 await page.locator('input[type=file]').first().setInputFiles({name:'esercizio.png',mimeType:'image/png',buffer:fs.readFileSync(new URL('./fixtures/testo.png',import.meta.url))});
 await page.getByRole('dialog').waitFor();
 await page.getByRole('button',{name:'Ritaglia',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Testo dell\'esercizio originale"]')?.value.length>10,null,{timeout:90000});
 const text=await page.getByRole('textbox',{name:"Testo dell'esercizio originale"}).inputValue();
 assert.match(text,/Madrid|manzana/i);console.log('OCR locale dopo errore IA OK:',text.replace(/\s+/g,' ').slice(0,180));
 console.log('Eccezioni JavaScript:',JSON.stringify(errors));
}finally{await context.close();await browser.close()}

