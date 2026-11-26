import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
// Confronto SOLA LETTURA: nessuna richiesta API; stessi dati sintetici per la foto.
const urls={anteprima:'http://127.0.0.1:3000',produzione:'https://lingue-facili.easy-peasy.site'};
const fixture=await fs.readFile(new URL('./fixtures/testo.png',import.meta.url));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const properties=['backgroundColor','color','borderColor','borderRadius','borderWidth','boxShadow','fontFamily','fontSize','fontWeight','lineHeight','minWidth','minHeight','height','padding','outlineColor','outlineStyle','outlineWidth'];
try {
 for(const width of [320,390,1440]){
  const snapshots={};
  for(const [which,base] of Object.entries(urls)){
   const c=await browser.newContext({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600});
   await c.route('**/api/**',r=>r.abort()); const p=await c.newPage();
   await p.goto(`${base}/setup?lang=en`,{waitUntil:'domcontentloaded'});
   await p.locator('.lf-standard-toolbar button').first().waitFor(); await p.evaluate(()=>document.fonts.ready);
   const read=sel=>p.locator(sel).evaluateAll((els,props)=>els.map(el=>{const c=getComputedStyle(el);return {label:el.getAttribute('aria-label')||el.textContent.trim(),...Object.fromEntries(props.map(prop=>[prop,c[prop]]))}}),properties);
   const barra=await read('.lf-standard-toolbar button');
   await p.locator('input[type=file][multiple]').setInputFiles({name:'prova.png',mimeType:'image/png',buffer:fixture});
   await p.locator('.lf-crop-dialog').waitFor(); await p.locator('.lf-crop-dialog img').waitFor();
   const ritaglio=await read('.lf-crop-dialog button');
   snapshots[which]={barra,ritaglio};
   await c.close();
  }
  assert.deepEqual(snapshots.anteprima,snapshots.produzione,`barra o ritaglio diversi dalla produzione a ${width}px`);
  console.log(`${width}px: tutti i ${snapshots.anteprima.barra.length} pulsanti della barra e i ${snapshots.anteprima.ritaglio.length} della finestra di ritaglio hanno lo stesso stile calcolato della produzione.`);
 }
}finally{await browser.close();}

