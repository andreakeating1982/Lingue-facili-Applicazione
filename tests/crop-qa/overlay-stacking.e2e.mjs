import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Due immagini sintetiche, OCR simulato e nessuna scrittura nel database.
const BASE=(process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/,'');
const photo=await fs.readFile(new URL('./fixtures/testo.png',import.meta.url));
const json=result=>JSON.stringify([{result:{data:{json:result}}}]);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
let reads=0;
await context.route('**/api/trpc/**',route=>{
  if(route.request().url().includes('exercises.readPhoto')){
    reads++;
    return route.fulfill({status:200,contentType:'application/json',body:json({text:`${reads}. She ___ an apple.`})});
  }
  return route.abort('blockedbyclient');
});
const page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(`${BASE}/setup?lang=es`,{waitUntil:'networkidle'});
  await page.locator('input[type=file][multiple]').setInputFiles([
    {name:'prima.png',mimeType:'image/png',buffer:photo},
    {name:'seconda.png',mimeType:'image/png',buffer:photo},
  ]);
  const crop=page.locator('[role="dialog"][data-state="open"]');
  let priorImage=null;
  for(let n=1;n<=2;n++){
    await crop.waitFor({state:'visible'});
    await page.waitForFunction(previous=>{
      const img=document.querySelector('[role="dialog"][data-state="open"] img');
      return img?.complete && img.naturalWidth>0 && img.currentSrc!==previous;
    },priorImage,{timeout:15000});
    priorImage=await crop.locator('img').getAttribute('src');
    assert.ok(priorImage);
    if(n===2){
      // Riproduce in modo deterministico il raro ordine DOM osservato quando
      // Radix riapre il portale durante la chiusura della foto precedente:
      // overlay aggiunto dopo il contenuto. Non forza clic né altera il crop.
      await page.waitForTimeout(300);
      await page.evaluate(()=>{
        const overlay=document.querySelector('[data-slot="dialog-overlay"][data-state="open"]');
        if(!overlay)throw new Error('overlay del ritaglio assente');
        document.body.appendChild(overlay);
      });
      const check=await crop.evaluate(dialog=>{
        const overlay=document.querySelector('[data-slot="dialog-overlay"][data-state="open"]');
        const button=[...dialog.querySelectorAll('button')].find(el=>el.textContent.trim()==='Ritaglia');
        const b=button.getBoundingClientRect(),top=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
        return {contentZ:Number(getComputedStyle(dialog).zIndex),overlayZ:Number(getComputedStyle(overlay).zIndex),overlayAfter:!!(dialog.compareDocumentPosition(overlay)&Node.DOCUMENT_POSITION_FOLLOWING),buttonOnTop:top===button||button.contains(top)};
      });
      assert.ok(check.overlayAfter,'lo scenario deve riprodurre overlay rimontato dopo il contenuto');
      assert.ok(check.contentZ>check.overlayZ,`il dialogo non sovrasta l'overlay: ${JSON.stringify(check)}`);
      assert.ok(check.buttonOnTop,`il pulsante di ritaglio è coperto: ${JSON.stringify(check)}`);
    }
    // Interazioni reali, mai forzate: mouse sulla prima foto, tocco sulla
    // seconda. Un altro elemento che intercetta il puntatore fa fallire il test.
    const cropButton=crop.getByRole('button',{name:'Ritaglia',exact:true});
    if(n===1) await cropButton.click({timeout:8000});
    else await cropButton.tap({timeout:8000});
    await page.waitForFunction(count=>(document.querySelector('textarea[aria-label="Testo dell\'esercizio originale"]')?.value.match(/___/g)?.length??0)>=count,n,{timeout:15000});
  }
  assert.equal(reads,2,'entrambe le foto devono essere lette');
  assert.deepEqual(errors,[]);
  console.log('DUE FOTO: anche se il fondo viene rimontato dopo il dialogo, il secondo ritaglio rimane visibile e cliccabile.');
} catch(error){
  await page.screenshot({path:'/tmp/lingue-overlay-stacking-failed.png'}).catch(()=>{});
  throw error;
} finally {await context.close();await browser.close();}

